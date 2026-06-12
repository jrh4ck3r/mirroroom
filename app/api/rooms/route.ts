import { NextResponse } from "next/server";
import { loadAllRooms } from "@/lib/roomLoader";

/**
 * GET /api/rooms
 * Returns all available room presets.
 */
export async function GET() {
  try {
    const rooms = loadAllRooms();
    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("[rooms] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
