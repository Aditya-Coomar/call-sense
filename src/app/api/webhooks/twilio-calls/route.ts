import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTwilioSignature } from "@/lib/integrations/twilio";

// Helper function to generate TwiML response
function generateCallTwiML(action: string, callLogId?: string): string {
  switch (action) {
    case "connect":
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Human detected. Connecting you now.</Say>
    <Dial timeout="30">
        <Number>+1234567890</Number>
    </Dial>
</Response>`;

    case "hangup":
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Voicemail detected. Goodbye.</Say>
    <Hangup/>
</Response>`;

    case "stream":
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Start>
        <Stream url="wss://your-websocket-endpoint.com/stream/${callLogId}" />
    </Start>
    <Say voice="alice">Hello, please hold while we connect you.</Say>
    <Pause length="10"/>
</Response>`;

    default:
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Hello, analyzing your call.</Say>
    <Pause length="5"/>
</Response>`;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get webhook signature for validation
    const signature = request.headers.get("x-twilio-signature") || "";
    const url = request.url;

    // Parse form data
    const formData = await request.formData();
    const params: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    // Validate webhook signature in production
    if (process.env.NODE_ENV === "production" && signature) {
      if (!validateTwilioSignature(signature, url, params)) {
        console.error("Invalid Twilio webhook signature");
        return new NextResponse("Unauthorized", { status: 401 });
      }
    }

    // Extract parameters from URL and form data
    const urlParams = new URL(request.url).searchParams;
    const strategy = urlParams.get("strategy") || "twilio";
    const callLogId = urlParams.get("callLogId");

    console.log("Call webhook received:", {
      strategy,
      callLogId,
      callStatus: params.CallStatus,
      answeringMachineDetection: params.AnsweringMachineDetectionStatus,
      from: params.From,
      to: params.To,
    });

    if (!callLogId) {
      console.error("No callLogId provided in webhook");
      return new NextResponse(generateCallTwiML("hangup"), {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Find the call log
    const callLog = await prisma.callLog.findUnique({
      where: { id: callLogId },
    });

    if (!callLog) {
      console.error("Call log not found:", callLogId);
      return new NextResponse(generateCallTwiML("hangup"), {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const startTime = Date.now();

    // Process based on call status
    const callStatus = params.CallStatus;
    const amdStatus = params.AnsweringMachineDetectionStatus;

    switch (callStatus) {
      case "initiated":
        // Call has been initiated
        await updateCallLog(callLogId, {
          result: "initiated",
        });
        break;

      case "ringing":
        // Call is ringing
        await updateCallLog(callLogId, {
          result: "ringing",
        });
        break;

      case "answered":
        // Call was answered, process AMD result
        const result = await processAMDResult(
          strategy,
          params,
          startTime,
          callLogId
        );

        await updateCallLog(callLogId, {
          result: result.result,
          confidence: result.confidence,
          latencyMs: result.latencyMs,
        });

        // Return appropriate TwiML based on AMD result
        if (result.result === "human") {
          return new NextResponse(generateCallTwiML("connect", callLogId), {
            status: 200,
            headers: { "Content-Type": "text/xml" },
          });
        } else if (result.result === "machine") {
          return new NextResponse(generateCallTwiML("hangup"), {
            status: 200,
            headers: { "Content-Type": "text/xml" },
          });
        } else {
          // For HuggingFace and Gemini strategies, start streaming
          if (strategy === "huggingface" || strategy === "gemini") {
            return new NextResponse(generateCallTwiML("stream", callLogId), {
              status: 200,
              headers: { "Content-Type": "text/xml" },
            });
          } else {
            // Default to treating as human
            return new NextResponse(generateCallTwiML("connect", callLogId), {
              status: 200,
              headers: { "Content-Type": "text/xml" },
            });
          }
        }

      case "busy":
        // Line is busy
        await updateCallLog(callLogId, {
          result: "busy",
          endedAt: new Date(),
        });
        break;

      case "no-answer":
        // No one answered the call
        await updateCallLog(callLogId, {
          result: "no-answer",
          endedAt: new Date(),
        });
        break;

      case "failed":
        // Call failed
        await updateCallLog(callLogId, {
          result: "failed",
          endedAt: new Date(),
        });
        break;

      case "canceled":
        // Call was canceled
        await updateCallLog(callLogId, {
          result: "canceled",
          endedAt: new Date(),
        });
        break;

      case "in-progress":
        // Call is in progress (answered and connected)
        await updateCallLog(callLogId, {
          result: "in-progress",
        });
        break;

      case "completed":
        // Call completed - keep existing result
        await updateCallLog(callLogId, {
          result: callLog.result || "completed",
          endedAt: new Date(),
        });
        break;

      default:
        console.log("Unhandled call status:", callStatus);
        // Update with unknown status for debugging
        await updateCallLog(callLogId, {
          result: `unknown-${callStatus}`,
          endedAt: new Date(),
        });
    }

    // Return empty TwiML response
    return new NextResponse(generateCallTwiML("default"), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Call webhook error:", error);
    return new NextResponse(generateCallTwiML("hangup"), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}

async function processAMDResult(
  strategy: string,
  params: Record<string, string>,
  startTime: number,
  callLogId: string
) {
  const latencyMs = Date.now() - startTime;

  switch (strategy) {
    case "twilio":
      return processTwilioNativeAMD(params, latencyMs);

    case "jambonz":
      return processJambonzAMD(params, latencyMs);

    case "huggingface":
      return processHuggingFaceAMD(params, latencyMs, callLogId);

    case "gemini":
      return processGeminiAMD(params, latencyMs, callLogId);

    default:
      return {
        result: "undecided",
        confidence: 0.5,
        latencyMs,
      };
  }
}

function processTwilioNativeAMD(
  params: Record<string, string>,
  latencyMs: number
) {
  const amdStatus = params.AnsweringMachineDetectionStatus;

  switch (amdStatus) {
    case "human":
      return {
        result: "human",
        confidence: 0.85,
        latencyMs,
      };
    case "machine_start":
    case "machine_end_beep":
    case "machine_end_silence":
      return {
        result: "machine",
        confidence: 0.9,
        latencyMs,
      };
    default:
      return {
        result: "undecided",
        confidence: 0.6,
        latencyMs,
      };
  }
}

function processJambonzAMD(params: Record<string, string>, latencyMs: number) {
  // Enhanced Jambonz processing with DetectMessageEnd
  const amdStatus = params.AnsweringMachineDetectionStatus;

  switch (amdStatus) {
    case "human":
      return {
        result: "human",
        confidence: 0.92,
        latencyMs,
      };
    case "machine_start":
    case "machine_end_beep":
    case "machine_end_silence":
      return {
        result: "machine",
        confidence: 0.95,
        latencyMs,
      };
    default:
      return {
        result: "undecided",
        confidence: 0.7,
        latencyMs,
      };
  }
}

async function processHuggingFaceAMD(
  params: Record<string, string>,
  latencyMs: number,
  callLogId: string
) {
  // This would integrate with the Python ML service
  // For now, return pending to trigger audio streaming
  return {
    result: "pending",
    confidence: 0.5,
    latencyMs,
  };
}

async function processGeminiAMD(
  params: Record<string, string>,
  latencyMs: number,
  callLogId: string
) {
  // This would integrate with Gemini 2.5 Flash API
  // For now, return pending to trigger audio streaming
  return {
    result: "pending",
    confidence: 0.5,
    latencyMs,
  };
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

// Handle recording webhooks for ML strategies
export async function handleRecordingWebhook(
  request: NextRequest,
  strategy: string,
  callLogId: string
) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    const recordingUrl = params.RecordingUrl;
    const recordingSid = params.RecordingSid;

    if (!recordingUrl) {
      console.error("No recording URL provided");
      return;
    }

    console.log("Processing recording for strategy:", strategy, {
      callLogId,
      recordingSid,
      recordingUrl,
    });

    // Process the recording based on strategy
    let result;
    const startTime = Date.now();

    if (strategy === "huggingface") {
      result = await processHuggingFaceRecording(recordingUrl, callLogId);
    } else if (strategy === "gemini") {
      result = await processGeminiRecording(recordingUrl, callLogId);
    } else {
      result = { result: "undecided", confidence: 0.5 };
    }

    const latencyMs = Date.now() - startTime;

    // Update call log with ML result
    await updateCallLog(callLogId, {
      result: result.result,
      confidence: result.confidence,
      latencyMs,
      endedAt: new Date(),
    });

    console.log("Recording processed:", {
      callLogId,
      result: result.result,
      confidence: result.confidence,
      latencyMs,
    });
  } catch (error) {
    console.error("Recording webhook error:", error);
  }
}

async function processHuggingFaceRecording(
  recordingUrl: string,
  callLogId: string
) {
  // This would call the Python ML service
  // For now, simulate ML processing
  try {
    // In production, this would:
    // 1. Download the recording from Twilio
    // 2. Send it to the Python ML service
    // 3. Get the prediction result

    // Simulated result for now
    return {
      result: Math.random() > 0.5 ? "human" : "machine",
      confidence: 0.88,
    };
  } catch (error) {
    console.error("HuggingFace processing error:", error);
    return { result: "undecided", confidence: 0.5 };
  }
}

async function processGeminiRecording(recordingUrl: string, callLogId: string) {
  // This would call Gemini 2.5 Flash API
  // For now, simulate AI processing
  try {
    // In production, this would:
    // 1. Download the recording from Twilio
    // 2. Send it to Gemini API for analysis
    // 3. Parse the AI response

    // Simulated result for now
    return {
      result: Math.random() > 0.4 ? "human" : "machine",
      confidence: 0.91,
    };
  } catch (error) {
    console.error("Gemini processing error:", error);
    return { result: "undecided", confidence: 0.5 };
  }
}
