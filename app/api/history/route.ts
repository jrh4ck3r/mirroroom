import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/history
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      // Get single debate detail
      const stmt = db.prepare("SELECT * FROM debates WHERE id = ?");
      const row = stmt.get(id) as any;

      if (!row) {
        return NextResponse.json({ error: "Debate not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        debate: {
          id: row.id,
          createdAt: row.created_at,
          ideaText: row.idea_text,
          roomId: row.room_id,
          roomName: row.room_name,
          transcript: JSON.parse(row.transcript),
          verdict: JSON.parse(row.verdict),
          rebuttalText: row.rebuttal_text || null,
          rebuttalTranscript: row.rebuttal_transcript ? JSON.parse(row.rebuttal_transcript) : null,
          finalVerdict: row.final_verdict ? JSON.parse(row.final_verdict) : null,
        },
      });
    } else {
      // Get all debates (summary list for docket browser)
      const stmt = db.prepare("SELECT id, created_at, idea_text, room_id, room_name, verdict FROM debates ORDER BY created_at DESC");
      const rows = stmt.all() as any[];

      const debates = rows.map((row) => {
        let score = 0;
        let category = "MIXED";
        try {
          const parsedVerdict = JSON.parse(row.verdict);
          score = parsedVerdict.overallScore || 0;
          category = score >= 70 ? "HIGH SUPPORT" : score >= 40 ? "MIXED / POLARIZED" : "LOW APPEAL";
        } catch (e) {
          console.error("Failed to parse verdict score for history item:", row.id, e);
        }

        // Truncate idea text
        const ideaText = row.idea_text || "";
        const truncatedIdea = ideaText.length > 100 ? ideaText.substring(0, 100) + "..." : ideaText;

        return {
          id: row.id,
          createdAt: row.created_at,
          ideaText: truncatedIdea,
          roomId: row.room_id,
          roomName: row.room_name,
          score,
          category,
        };
      });

      return NextResponse.json({ success: true, debates });
    }
  } catch (error) {
    console.error("[history-api] GET Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

// POST /api/history
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { ideaText, roomId, roomName, transcript, verdict } = body;

    if (!ideaText || !roomId || !roomName || !transcript || !verdict) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const transcriptStr = JSON.stringify(transcript);
    const verdictStr = JSON.stringify(verdict);

    const stmt = db.prepare(`
      INSERT INTO debates (id, created_at, idea_text, room_id, room_name, transcript, verdict)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, createdAt, ideaText, roomId, roomName, transcriptStr, verdictStr);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("[history-api] POST Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

// PUT /api/history
export async function PUT(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, rebuttalText, rebuttalTranscript, finalVerdict } = body;

    if (!id || !rebuttalText || !rebuttalTranscript || !finalVerdict) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const rebuttalTranscriptStr = JSON.stringify(rebuttalTranscript);
    const finalVerdictStr = JSON.stringify(finalVerdict);

    const stmt = db.prepare(`
      UPDATE debates 
      SET rebuttal_text = ?, rebuttal_transcript = ?, final_verdict = ?
      WHERE id = ?
    `);

    const result = stmt.run(rebuttalText, rebuttalTranscriptStr, finalVerdictStr, id);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Debate updated with rebuttal round" });
  } catch (error) {
    console.error("[history-api] PUT Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

// DELETE /api/history
export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clear = searchParams.get("clear");

    if (clear === "true") {
      // Clear all history
      const stmt = db.prepare("DELETE FROM debates");
      stmt.run();
      return NextResponse.json({ success: true, message: "All history cleared" });
    }

    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    // Delete single debate
    const stmt = db.prepare("DELETE FROM debates WHERE id = ?");
    const result = stmt.run(id);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Debate deleted successfully" });
  } catch (error) {
    console.error("[history-api] DELETE Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
