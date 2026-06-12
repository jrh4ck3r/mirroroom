import { NextRequest, NextResponse } from "next/server";
import { loadRoomById } from "@/lib/roomLoader";
import { resolveRoomAgents } from "@/lib/roomLoader";
import { getAgentResponse } from "@/lib/anthropicClient";
import { DebateMessage } from "@/lib/types";

/**
 * POST /api/debate/test
 *
 * Minimal test endpoint: takes an API key, idea, and room ID,
 * picks the first agent in the room, and calls Claude once.
 *
 * Body: { apiKey: string, idea: string, roomId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, idea, roomId } = body;

    // Validate inputs
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid apiKey" },
        { status: 400 }
      );
    }
    if (!idea || typeof idea !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid idea" },
        { status: 400 }
      );
    }
    if (!roomId || typeof roomId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid roomId" },
        { status: 400 }
      );
    }

    // Load room and resolve agents
    const room = loadRoomById(roomId);
    if (!room) {
      return NextResponse.json(
        { error: `Room "${roomId}" not found` },
        { status: 404 }
      );
    }

    const agents = resolveRoomAgents(room);
    if (agents.length === 0) {
      return NextResponse.json(
        { error: `Room "${roomId}" has no valid agents` },
        { status: 404 }
      );
    }

    // Pick the first agent and call Claude
    const firstAgent = agents[0];
    const priorMessages: DebateMessage[] = [];

    console.log(`[test] Calling Claude as "${firstAgent.name}" (${firstAgent.id})...`);

    const response = await getAgentResponse(
      apiKey,
      firstAgent,
      idea,
      priorMessages,
      1 // Round 1 — initial reaction
    );

    console.log(`[test] Got response from "${firstAgent.name}": ${response.substring(0, 100)}...`);

    return NextResponse.json({
      success: true,
      agent: {
        id: firstAgent.id,
        name: firstAgent.name,
        avatar_emoji: firstAgent.avatar_emoji,
        occupation: firstAgent.occupation,
        location: firstAgent.location,
      },
      room: {
        id: room.id,
        name: room.name,
        totalAgents: agents.length,
      },
      response,
    });
  } catch (error) {
    console.error("[test] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
