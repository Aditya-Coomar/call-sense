import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateJambonzResponse } from "@/lib/integrations/jambonz";

export async function POST(request: NextRequest) {
  try {
    // Parse JSON body from Jambonz
    const body = await request.json();

    // Extract parameters from URL and body
    const urlParams = new URL(request.url).searchParams;
    const strategy = urlParams.get("strategy") || "jambonz";
    const callLogId = urlParams.get("callLogId");

    console.log("Jambonz webhook received:", {
      strategy,
      callLogId,
      body,
      event: body.type,
      amdType: body.amd_type,
    });

    if (!callLogId) {
      console.error("No callLogId provided in Jambonz webhook");
      return NextResponse.json(generateJambonzResponse("hangup"), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Find the call log
    const callLog = await prisma.callLog.findUnique({
      where: { id: callLogId },
    });

    if (!callLog) {
      console.error("Call log not found:", callLogId);
      return NextResponse.json(generateJambonzResponse("hangup"), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();

    // Process Jambonz AMD events
    const eventType = body.type;

    switch (eventType) {
      case "amd_human_detected":
        // Human detected
        const humanResult = {
          result: "human",
          confidence: 0.92,
          latencyMs: Date.now() - startTime,
        };

        await updateCallLog(callLogId, {
          result: humanResult.result,
          confidence: humanResult.confidence,
          latencyMs: humanResult.latencyMs,
        });

        console.log("Jambonz AMD: Human detected", {
          callLogId,
          reason: body.reason,
          greeting: body.greeting,
          language: body.language,
        });

        return NextResponse.json(
          generateJambonzResponse("connect", callLogId),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );

      case "amd_machine_detected":
        // Machine/voicemail detected
        const machineResult = {
          result: "machine",
          confidence: 0.95,
          latencyMs: Date.now() - startTime,
        };

        await updateCallLog(callLogId, {
          result: machineResult.result,
          confidence: machineResult.confidence,
          latencyMs: machineResult.latencyMs,
        });

        console.log("Jambonz AMD: Machine detected", {
          callLogId,
          reason: body.reason,
          hint: body.hint,
          transcript: body.transcript,
          language: body.language,
        });

        return NextResponse.json(generateJambonzResponse("hangup"), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      case "amd_no_speech_detected":
        // No speech detected
        await updateCallLog(callLogId, {
          result: "no-speech",
          confidence: 0.8,
          latencyMs: Date.now() - startTime,
        });

        console.log("Jambonz AMD: No speech detected", { callLogId });

        return NextResponse.json(generateJambonzResponse("hangup"), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      case "amd_decision_timeout":
        // Timeout - treat as human
        await updateCallLog(callLogId, {
          result: "undecided",
          confidence: 0.6,
          latencyMs: Date.now() - startTime,
        });

        console.log("Jambonz AMD: Decision timeout", { callLogId });

        return NextResponse.json(
          generateJambonzResponse("connect", callLogId),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );

      case "amd_machine_stopped_speaking":
        // Machine finished greeting - good for voicemail systems
        console.log("Jambonz AMD: Machine stopped speaking", { callLogId });

        // Don't update final result here, just log the event
        return NextResponse.json(generateJambonzResponse("continue"), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      case "amd_tone_detected":
        // Beep detected - definitely a machine
        await updateCallLog(callLogId, {
          result: "machine",
          confidence: 0.98,
          latencyMs: Date.now() - startTime,
        });

        console.log("Jambonz AMD: Tone/beep detected", { callLogId });

        return NextResponse.json(generateJambonzResponse("hangup"), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      case "amd_error":
        // AMD error occurred
        await updateCallLog(callLogId, {
          result: "error",
          error: body.error || "AMD processing error",
          latencyMs: Date.now() - startTime,
        });

        console.error("Jambonz AMD error:", { callLogId, error: body.error });

        return NextResponse.json(generateJambonzResponse("hangup"), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      case "amd_stopped":
        // AMD was stopped
        console.log("Jambonz AMD: AMD stopped", { callLogId });

        return NextResponse.json(generateJambonzResponse("continue"), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      default:
        console.log("Unhandled Jambonz AMD event:", eventType, body);

        return NextResponse.json(generateJambonzResponse("continue"), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Jambonz webhook error:", error);
    return NextResponse.json(generateJambonzResponse("hangup"), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function updateCallLog(callLogId: string, updates: any) {
  try {
    await prisma.callLog.update({
      where: { id: callLogId },
      data: updates,
    });
  } catch (error) {
    console.error("Failed to update call log:", error);
  }
}

// Handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Jambonz webhook endpoint is accessible",
    timestamp: new Date().toISOString(),
  });
}
