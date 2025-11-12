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
    statusCallbackEvent: ["initiated", "answered", "completed"],
    machineDetection: "Enable",
    machineDetectionTimeout: 30,
    record: false,
  });
}

// Jambonz SIP-Enhanced AMD Implementation
async function initiateJambonzAMD(
  targetNumber: string,
  callbackUrl: string,
  callLogId: string
) {
  // For now, fallback to Twilio native with different settings
  // In production, this would route through Jambonz SIP infrastructure
  const twilioClient = getTwilioClient();
  return await twilioClient.calls.create({
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: targetNumber,
    url: `${callbackUrl}?strategy=jambonz&callLogId=${callLogId}`,
    statusCallback: `${callbackUrl}?strategy=jambonz&callLogId=${callLogId}`,
    statusCallbackEvent: ["initiated", "answered", "completed"],
    machineDetection: "DetectMessageEnd",
    machineDetectionTimeout: 45,
    record: false,
  });
}

// Hugging Face ML AMD Implementation
async function initiateHuggingFaceAMD(
  targetNumber: string,
  callbackUrl: string,
  callLogId: string
) {
  const twilioClient = getTwilioClient();
  return await twilioClient.calls.create({
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: targetNumber,
    url: `${callbackUrl}?strategy=huggingface&callLogId=${callLogId}`,
    statusCallback: `${callbackUrl}?strategy=huggingface&callLogId=${callLogId}`,
    statusCallbackEvent: ["initiated", "answered", "completed"],
    record: true, // Record for ML analysis
    recordingStatusCallback: `${callbackUrl}/recording?strategy=huggingface&callLogId=${callLogId}`,
  });
}

// Gemini 2.5 Flash AMD Implementation
async function initiateGeminiAMD(
  targetNumber: string,
  callbackUrl: string,
  callLogId: string
) {
  const twilioClient = getTwilioClient();
  return await twilioClient.calls.create({
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: targetNumber,
    url: `${callbackUrl}?strategy=gemini&callLogId=${callLogId}`,
    statusCallback: `${callbackUrl}?strategy=gemini&callLogId=${callLogId}`,
    statusCallbackEvent: ["initiated", "answered", "completed"],
    record: true, // Record for AI analysis
    recordingStatusCallback: `${callbackUrl}/recording?strategy=gemini&callLogId=${callLogId}`,
  });
}
