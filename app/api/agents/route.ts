import { NextResponse } from "next/server";
import { loadAllAgentsArray } from "@/lib/agentLoader";

/**
 * GET /api/agents
 * Returns all available agent profiles.
 * Omits system_prompt_template from the response to avoid leaking prompt internals to the client.
 */
export async function GET() {
  try {
    const agents = loadAllAgentsArray().map(({ system_prompt_template, ...rest }) => rest);
    return NextResponse.json({ agents });
  } catch (error) {
    console.error("[agents] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
