import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const strategy = url.searchParams.get("strategy");
    const result = url.searchParams.get("result");

    // Build where clause
    const where: any = {
      userId: session.user.id,
    };

    if (strategy) {
      where.strategy = strategy;
    }

    if (result) {
      where.result = result;
    }

    // Fetch call logs
    const callLogs = await prisma.callLog.findMany({
      where,
      orderBy: {
        startedAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const totalCount = await prisma.callLog.count({
      where,
    });

    return NextResponse.json({
      success: true,
      callLogs,
      totalCount,
      hasMore: offset + limit < totalCount,
    });
  } catch (error: any) {
    console.error("Call logs API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch call logs" },
      { status: 500 }
    );
  }
}
