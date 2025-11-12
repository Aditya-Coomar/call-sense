import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const callId = params.callId;

    if (!callId) {
      return NextResponse.json(
        { error: "Call ID is required" },
        { status: 400 }
      );
    }

    // Fetch call log
    const callLog = await prisma.callLog.findFirst({
      where: {
        id: callId,
        userId: session.user.id,
      },
    });

    if (!callLog) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // Determine status message and completion state
    let status = "";
    let completed = false;

    switch (callLog.result) {
      case "pending":
        status = "Call initiated. Waiting for answer...";
        break;
      case "initiated":
        status = "Dialing...";
        break;
      case "human":
        status = "Human detected! Call connected.";
        completed = true;
        break;
      case "machine":
        status = "Voicemail detected. Call ended.";
        completed = true;
        break;
      case "undecided":
        status = "Detection inconclusive. Treated as human.";
        completed = true;
        break;
      case "no-answer":
        status = "No answer received.";
        completed = true;
        break;
      case "busy":
        status = "Line busy.";
        completed = true;
        break;
      case "failed":
        status = "Call failed.";
        completed = true;
        break;
      case "canceled":
        status = "Call canceled.";
        completed = true;
        break;
      case "error":
        status = `Call error: ${callLog.error || "Unknown error"}`;
        completed = true;
        break;
      default:
        status = "Processing...";
    }

    return NextResponse.json({
      success: true,
      status,
      completed,
      result: callLog.result,
      confidence: callLog.confidence,
      latencyMs: callLog.latencyMs,
      startedAt: callLog.startedAt,
      endedAt: callLog.endedAt,
      strategy: callLog.strategy,
      targetNumber: callLog.targetNumber,
    });
  } catch (error: any) {
    console.error("Call status API error:", error);
    return NextResponse.json(
      { error: "Failed to get call status" },
      { status: 500 }
    );
  }
}
