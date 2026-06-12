import { NextRequest, NextResponse } from "next/server";
import { generateVerdict } from "@/lib/aiClient";
import { DebateMessage } from "@/lib/types";

/**
 * POST /api/verdict
 *
 * Generates an analytical summary and scorecard for a given idea and debate transcript.
 *
 * Body: { apiKey: string, ideaText: string, transcript: any[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, ideaText, transcript } = body;

    // Validate inputs
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid apiKey" },
        { status: 400 }
      );
    }
    if (!ideaText || typeof ideaText !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid ideaText" },
        { status: 400 }
      );
    }
    if (!transcript || !Array.isArray(transcript)) {
      return NextResponse.json(
        { error: "Missing or invalid transcript" },
        { status: 400 }
      );
    }

    // Map client transcript to DebateMessage objects
    const debateMessages: DebateMessage[] = transcript.map((m: any, index: number) => ({
      agentId: m.agentId || `agent-${index}`,
      agentName: m.name || m.agentName || "Panelist",
      avatarEmoji: m.avatarEmoji || "👤",
      content: m.response || m.content || "",
      round: m.round || 1,
      timestamp: m.timestamp || Date.now(),
    }));

    console.log(`[verdict] Generating verdict for idea: "${ideaText.substring(0, 80)}..."`);
    const rawVerdict = await generateVerdict(apiKey, ideaText, debateMessages);

    // Clean up response: sometimes LLMs return JSON wrapped in markdown codeblocks
    let cleanedVerdict = rawVerdict.trim();
    if (cleanedVerdict.startsWith("```json")) {
      cleanedVerdict = cleanedVerdict.substring(7);
    } else if (cleanedVerdict.startsWith("```")) {
      cleanedVerdict = cleanedVerdict.substring(3);
    }
    if (cleanedVerdict.endsWith("```")) {
      cleanedVerdict = cleanedVerdict.substring(0, cleanedVerdict.length - 3);
    }
    cleanedVerdict = cleanedVerdict.trim();

    try {
      const parsedVerdict = JSON.parse(cleanedVerdict);
      return NextResponse.json({ verdict: parsedVerdict });
    } catch (parseError) {
      console.error("[verdict] Failed to parse verdict JSON:", cleanedVerdict, parseError);
      return NextResponse.json(
        { error: "NIM returned a non-JSON verdict. Raw response: " + rawVerdict },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[verdict] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
