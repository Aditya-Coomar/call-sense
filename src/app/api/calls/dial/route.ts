import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTwilioClient } from "@/lib/integrations/twilio";
import { z } from "zod";

const DialRequestSchema = z.object({
  targetNumber: z.string().min(1, "Phone number is required"),
  strategy: z.enum(["twilio", "jambonz", "huggingface", "gemini"]),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { targetNumber, strategy } = DialRequestSchema.parse(body);

    // Normalize phone number
    const normalizedNumber = targetNumber.startsWith("+")
      ? targetNumber
      : `+1${targetNumber.replace(/\D/g, "")}`;

    // Create call log entry
    const callLog = await prisma.callLog.create({
      data: {
        userId: session.user.id,
        targetNumber: normalizedNumber,
        strategy,
        result: "pending",
        startedAt: new Date(),
      },
    });

    // Initiate call based on strategy
    let twilioCall;
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio-calls`;

    try {
      switch (strategy) {
        case "twilio":
          twilioCall = await initiateTwilioNativeAMD(
            normalizedNumber,
            callbackUrl,
            callLog.id
          );
          break;

        case "jambonz":
          twilioCall = await initiateJambonzAMD(
            normalizedNumber,
            callbackUrl,
            callLog.id
          );
          break;

        case "huggingface":
          twilioCall = await initiateHuggingFaceAMD(
            normalizedNumber,
            callbackUrl,
            callLog.id
          );
          break;

        case "gemini":
          twilioCall = await initiateGeminiAMD(
            normalizedNumber,
            callbackUrl,
            callLog.id
          );
          break;

        default:
          throw new Error(`Unsupported strategy: ${strategy}`);
      }

      // Update call log with Twilio SID
      await prisma.callLog.update({
        where: { id: callLog.id },
        data: {
          // Store Twilio call SID in a metadata field if needed
          error: null,
        },
      });

      return NextResponse.json({
        success: true,
        call: {
          id: callLog.id,
          targetNumber: normalizedNumber,
          strategy,
          twilioSid: twilioCall.sid,
        },
      });
    } catch (twilioError: any) {
      // Update call log with error
      await prisma.callLog.update({
        where: { id: callLog.id },
        data: {
          result: "error",
          error: twilioError.message,
          endedAt: new Date(),
        },
      });

      throw twilioError;
    }
  } catch (error: any) {
    console.error("Dial API error:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to initiate call" },
      { status: 500 }
    );
  }
}

// Twilio Native AMD Implementation
async function initiateTwilioNativeAMD(
  targetNumber: string,
  callbackUrl: string,
  callLogId: string
) {
  const twilioClient = getTwilioClient();
  return await twilioClient.calls.create({
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: targetNumber,
    url: `${callbackUrl}?strategy=twilio&callLogId=${callLogId}`,
    statusCallback: `${callbackUrl}?strategy=twilio&callLogId=${callLogId}`,
    statusCallbackEvent: [
      "initiated",
      "ringing",
      "answered",
      "completed",
      "busy",
      "no-answer",
      "canceled",
      "failed",
    ],
    machineDetection: "Enable",
    machineDetectionTimeout: 30,
    timeout: 20, // Ring for 20 seconds before timing out
    record: false,
  });
}

// Jambonz SIP-Enhanced AMD Implementation
async function initiateJambonzAMD(
  targetNumber: string,
  callbackUrl: string,
  callLogId: string
) {
  // Import Jambonz client and utilities
  const {
    jambonzClient,
    createJambonzAMDApplication,
    formatPhoneNumberForJambonz,
  } = await import("@/lib/integrations/jambonz");

  console.log("Initiating Jambonz AMD call:", {
    targetNumber,
    callLogId,
    strategy: "jambonz",
  });

  // Format phone number for Jambonz E.164 requirements
  let formattedNumber: string;
  try {
    formattedNumber = formatPhoneNumberForJambonz(targetNumber);
  } catch (formatError: any) {
    console.error("Phone number format error:", formatError);
    throw new Error(`Invalid phone number for Jambonz: ${formatError.message}`);
  }

  // Use the configured Jambonz phone number as the from number
  const jambonzFromNumber = process.env.JAMBONZ_PHONE_NUMBER || "+917903550110";
  let formattedFromNumber: string;
  try {
    formattedFromNumber = formatPhoneNumberForJambonz(jambonzFromNumber);
  } catch (formatError: any) {
    console.error("From number format error:", formatError);
    throw new Error(
      `Invalid from phone number for Jambonz: ${formatError.message}`
    );
  }

  // Create Jambonz call request
  const callRequest = {
    from: formattedFromNumber,
    to: formattedNumber,
    call_hook: {
      url: `${callbackUrl}?strategy=jambonz&callLogId=${callLogId}`,
      method: "POST" as const,
    },
    call_status_hook: {
      url: `${callbackUrl}?strategy=jambonz&callLogId=${callLogId}`,
      method: "POST" as const,
    },
    tag: {
      strategy: "jambonz",
      callLogId: callLogId,
      amdEnabled: true,
      originalTargetNumber: targetNumber,
      formattedTargetNumber: formattedNumber,
    },
  };

  console.log("Jambonz call request:", callRequest);

  // Create the call via Jambonz API - NO FALLBACK
  const jambonzCall = await jambonzClient.createCall(callRequest);

  console.log("Jambonz call created successfully:", jambonzCall);

  // Return a Twilio-compatible response for consistency
  return {
    sid: jambonzCall.call_sid || jambonzCall.sid,
    status: jambonzCall.call_status,
    from: jambonzCall.from,
    to: jambonzCall.to,
  };
}

// Hugging Face ML AMD Implementation
async function initiateHuggingFaceAMD(
  targetNumber: string,
  callbackUrl: string,
  callLogId: string
) {
  console.log("Initiating Hugging Face AMD call:", {
    targetNumber,
    callLogId,
    strategy: "huggingface",
  });

  // Test ML service connection first
  const { huggingFaceAMDAnalyzer } = await import(
    "@/lib/integrations/huggingface"
  );
  const serviceHealthy = await huggingFaceAMDAnalyzer.testConnection();

  if (!serviceHealthy) {
    console.warn(
      "HuggingFace ML service not available, call will still proceed with recording"
    );
  }

  const twilioClient = getTwilioClient();
  return await twilioClient.calls.create({
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: targetNumber,
    url: `${callbackUrl}?strategy=huggingface&callLogId=${callLogId}`,
    statusCallback: `${callbackUrl}?strategy=huggingface&callLogId=${callLogId}`,
    statusCallbackEvent: [
      "initiated",
      "ringing",
      "answered",
      "completed",
      "busy",
      "no-answer",
      "canceled",
      "failed",
    ],
    timeout: 30, // Timeout for ML processing
    record: true, // Record for ML analysis
    recordingStatusCallback: `${callbackUrl}/recording?strategy=huggingface&callLogId=${callLogId}`,
    recordingStatusCallbackEvent: ["completed"],
  });
}

// Gemini 2.5 Flash AMD Implementation
async function initiateGeminiAMD(
  targetNumber: string,
  callbackUrl: string,
  callLogId: string
) {
  console.log("Initiating Gemini AMD call:", {
    targetNumber,
    callLogId,
    strategy: "gemini",
  });

  // Test Gemini service connection first
  const { geminiAMDAnalyzer } = await import("@/lib/integrations/gemini");
  const geminiHealthy = await geminiAMDAnalyzer.testConnection();

  if (!geminiHealthy) {
    console.warn(
      "Gemini API not available, call will still proceed with recording"
    );
  }

  const twilioClient = getTwilioClient();
  return await twilioClient.calls.create({
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: targetNumber,
    url: `${callbackUrl}?strategy=gemini&callLogId=${callLogId}`,
    statusCallback: `${callbackUrl}?strategy=gemini&callLogId=${callLogId}`,
    statusCallbackEvent: [
      "initiated",
      "ringing",
      "answered",
      "completed",
      "busy",
      "no-answer",
      "canceled",
      "failed",
    ],
    timeout: 30, // Timeout for AI processing
    record: true, // Record for AI analysis
    recordingStatusCallback: `${callbackUrl}/recording?strategy=gemini&callLogId=${callLogId}`,
    recordingStatusCallbackEvent: ["completed"],
  });
}
