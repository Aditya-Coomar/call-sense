import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio webhook
    const formData = await request.formData();

    // Extract webhook parameters
    const urlParams = new URL(request.url).searchParams;
    const strategy = urlParams.get("strategy");
    const callLogId = urlParams.get("callLogId");

    // Extract recording data from Twilio webhook
    const recordingUrl = formData.get("RecordingUrl") as string;
    const recordingSid = formData.get("RecordingSid") as string;
    const recordingDuration = formData.get("RecordingDuration") as string;
    const callSid = formData.get("CallSid") as string;

    console.log("Recording webhook received:", {
      strategy,
      callLogId,
      recordingSid,
      recordingUrl,
      duration: recordingDuration,
      callSid,
    });

    if (!callLogId || !strategy) {
      console.error("Missing required parameters in recording webhook");
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    // Find the call log
    const callLog = await prisma.callLog.findUnique({
      where: { id: callLogId },
    });

    if (!callLog) {
      console.error("Call log not found:", callLogId);
      return NextResponse.json(
        { error: "Call log not found" },
        { status: 404 }
      );
    }

    // Update call log to indicate analysis is in progress
    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        result: "in-progress",
      },
    });

    // Process recording based on strategy
    switch (strategy) {
      case "huggingface":
        await processHuggingFaceRecording(recordingUrl, callLogId);
        break;

      case "gemini":
        await processGeminiRecording(recordingUrl, callLogId);
        break;

      default:
        console.warn(`Unknown strategy for recording processing: ${strategy}`);
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Recording webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function processHuggingFaceRecording(
  recordingUrl: string,
  callLogId: string
) {
  try {
    console.log("Processing HuggingFace recording:", {
      recordingUrl,
      callLogId,
    });

    // Import HuggingFace analyzer
    const { huggingFaceAMDAnalyzer } = await import(
      "@/lib/integrations/huggingface"
    );

    // Download recording with Twilio authentication
    const authenticatedUrl = `${recordingUrl}.wav`;
    console.log("Downloading recording from:", authenticatedUrl);

    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;

    const authHeader =
      "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const audioResponse = await fetch(authenticatedUrl, {
      headers: {
        Authorization: authHeader,
      },
    });

    if (!audioResponse.ok) {
      throw new Error(
        `Failed to download recording: ${audioResponse.status} ${audioResponse.statusText}`
      );
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    console.log("Downloaded audio buffer:", audioBuffer.length, "bytes");

    // Process audio with HuggingFace ML service
    const result = await huggingFaceAMDAnalyzer.analyzeAudio({
      audioData: audioBuffer,
      format: "wav",
      callLogId,
    });

    console.log("HuggingFace analysis result:", result);

    // Update call log with results
    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        result: result.label, // HuggingFace returns 'label' field
        confidence: result.confidence,
        endedAt: new Date(),
      },
    });

    console.log("HuggingFace AMD processing complete:", {
      callLogId,
      label: result.label,
      confidence: result.confidence,
    });
  } catch (error: any) {
    console.error("HuggingFace recording processing error:", error);

    // Update call log with error
    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        result: "error",
        error: error.message,
        endedAt: new Date(),
      },
    });
  }
}

async function processGeminiRecording(recordingUrl: string, callLogId: string) {
  try {
    console.log("Processing Gemini recording:", { recordingUrl, callLogId });

    // Import Gemini analyzer
    const { geminiAMDAnalyzer } = await import("@/lib/integrations/gemini");

    // Download the recording first
    const authenticatedUrl = `${recordingUrl}.wav`;
    console.log("Downloading recording from:", authenticatedUrl);

    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;

    const authHeader =
      "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const audioResponse = await fetch(authenticatedUrl, {
      headers: {
        Authorization: authHeader,
      },
    });

    if (!audioResponse.ok) {
      throw new Error(
        `Failed to download recording: ${audioResponse.status} ${audioResponse.statusText}`
      );
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    console.log("Downloaded audio buffer:", audioBuffer.length, "bytes");

    // Analyze with Gemini
    const result = await geminiAMDAnalyzer.analyzeAudio({
      audioData: audioBuffer,
      duration: 10, // Estimate - could be parsed from webhook
      format: "wav",
      callLogId,
    });

    console.log("Gemini analysis result:", result);

    // Update call log with results
    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        result: result.label,
        confidence: result.confidence,
        endedAt: new Date(),
      },
    });

    console.log("Gemini AMD processing complete:", {
      callLogId,
      label: result.label,
      confidence: result.confidence,
      reasoning: result.reasoning,
    });
  } catch (error: any) {
    console.error("Gemini recording processing error:", error);

    // Update call log with error
    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        result: "error",
        error: error.message,
        endedAt: new Date(),
      },
    });
  }
}

// Handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Recording webhook endpoint is accessible",
    timestamp: new Date().toISOString(),
  });
}
