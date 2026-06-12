import { NextRequest, NextResponse } from "next/server";
import { loadRoomById, resolveRoomAgents } from "@/lib/roomLoader";
import { getAgentResponse } from "@/lib/aiClient";
import { DebateMessage } from "@/lib/types";

// Force-dynamic to ensure streaming works in production environments without caching
export const dynamic = "force-dynamic";

/**
 * POST /api/debate
 *
 * Runs a sequential multi-agent debate and streams the results back to the client
 * as they generate using Server-Sent Events (SSE).
 *
 * Body: { ideaText: string, roomId: string, apiKey?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { ideaText, roomId, apiKey } = body;

    // Resolve API key flexibly (body, Authorization header, or environment variable)
    let finalApiKey = apiKey;
    if (!finalApiKey) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        finalApiKey = authHeader.substring(7);
      }
    }
    if (!finalApiKey) {
      finalApiKey = process.env.NVIDIA_API_KEY;
    }

    // Validate inputs
    if (!finalApiKey || typeof finalApiKey !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid NVIDIA API Key. Please provide one in the body, headers, or environment." },
        { status: 400 }
      );
    }
    if (!ideaText || typeof ideaText !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid ideaText" },
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

    console.log(`[debate-stream] Starting debate in "${room.name}" with ${agents.length} agents`);

    const encoder = new TextEncoder();
    const transcript: DebateMessage[] = [];

    // Create a ReadableStream to stream the events to the client
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (const agent of agents) {
            console.log(`[debate-stream] Agent "${agent.name}" (${agent.id}) is typing...`);

            // 1. Send status event: Agent started typing/deliberating
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "status",
                  agentId: agent.id,
                  status: "typing",
                  name: agent.name,
                })}\n\n`
              )
            );

            // 2. Fetch LLM response
            const response = await getAgentResponse(
              finalApiKey,
              agent,
              ideaText,
              transcript, // Pass growing transcript so agents react to each other
              1 // Round 1
            );

            const message: DebateMessage = {
              agentId: agent.id,
              agentName: agent.name,
              avatarEmoji: agent.avatar_emoji,
              content: response,
              round: 1,
              timestamp: Date.now(),
            };

            // Keep track in running transcript
            transcript.push(message);

            console.log(`[debate-stream] ${agent.avatar_emoji} ${agent.name}: "${response.substring(0, 50)}..."`);

            // 3. Send final message event: Agent completed response
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "message",
                  message,
                })}\n\n`
              )
            );
          }

          console.log(`[debate-stream] Sequential debate complete. Sending end event.`);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "end",
                agentCount: agents.length,
              })}\n\n`
            )
          );
        } catch (streamError) {
          console.error("[debate-stream] Error during stream processing:", streamError);
          const errorMsg = streamError instanceof Error ? streamError.message : "Internal stream generation error";
          
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: errorMsg,
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[debate] Top-level route error:", error);
    const message = error instanceof Error ? error.message : "Unknown route error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
