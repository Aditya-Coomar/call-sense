import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTwilioClient } from "@/lib/integrations/twilio";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { callId } = await params;

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

    // For now, we'll just update the call log as canceled
    // In a full implementation, we would need to store the Twilio call SID
    // and use it to actually hang up the active call

    await prisma.callLog.update({
      where: { id: callId },
      data: {
        result: "canceled",
        endedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Call canceled successfully",
    });
  } catch (error: any) {
    console.error("Hangup API error:", error);
    return NextResponse.json(
      { error: "Failed to hang up call" },
      { status: 500 }
    );
  }
}
