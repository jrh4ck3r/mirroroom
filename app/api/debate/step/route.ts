import { NextRequest, NextResponse } from "next/server";
import { loadAgentById } from "@/lib/agentLoader";
import { getAgentResponse } from "@/lib/aiClient";
import { DebateMessage } from "@/lib/types";

/**
 * POST /api/debate/step
 *
 * Runs a single agent's response in the debate.
 * Receives the idea, the specific agent ID, and the running transcript of prior messages.
 *
 * Body: { apiKey: string, providerConfig?: any, ideaText: string, agentId: string, priorMessages: DebateMessage[], round?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, providerConfig, ideaText, agentId, priorMessages, round = 1, rebuttalText, customAgent } = body;

    // Resolve API key flexibly (body, Authorization header, or environment variable)
    let finalApiKey = apiKey;

    // Prioritize providerConfig.apiKey if defined on override config
    if (providerConfig?.apiKey) {
      finalApiKey = providerConfig.apiKey;
    }

    // If local provider (Ollama or LM Studio), set dummy key to satisfy validation if missing
    if (providerConfig && (providerConfig.provider === "ollama" || providerConfig.provider === "lm-studio")) {
      if (!finalApiKey) finalApiKey = "dummy_key";
    }

    if (!finalApiKey) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        finalApiKey = authHeader.substring(7);
      }
    }
    if (!finalApiKey) {
      if (providerConfig?.provider === "openrouter") {
        finalApiKey = process.env.OPENROUTER_API_KEY;
      } else {
        finalApiKey = process.env.NVIDIA_API_KEY;
      }
    }

    // Validate inputs
    if (!finalApiKey || typeof finalApiKey !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid API Key. Please configure it in Settings." },
        { status: 400 }
      );
    }
    if (!ideaText || typeof ideaText !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid ideaText" },
        { status: 400 }
      );
    }
    if (!agentId || typeof agentId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid agentId" },
        { status: 400 }
      );
    }
    if (!priorMessages || !Array.isArray(priorMessages)) {
      return NextResponse.json(
        { error: "Missing or invalid priorMessages array" },
        { status: 400 }
      );
    }

    // Load agent profile
    let agent = customAgent;
    if (!agent && agentId) {
      agent = loadAgentById(agentId);
    }

    if (!agent) {
      return NextResponse.json(
        { error: `Agent profile not found` },
        { status: 404 }
      );
    }

    console.log(`[debate-step] Calling LLM for agent "${agent.name}" (${agent.id}) via provider "${providerConfig?.provider || "nvidia"}"`);

    // Clean prior messages for getAgentResponse context
    const cleanPriorMessages: DebateMessage[] = priorMessages.map((m: any) => ({
      agentId: m.agentId || "",
      agentName: m.agentName || m.name || "",
      avatarEmoji: m.avatarEmoji || "",
      content: m.content || m.response || "",
      round: m.round || 1,
      timestamp: m.timestamp || Date.now(),
      modelLabel: m.modelLabel || "",
    }));

    // Generate response
    const response = await getAgentResponse(
      finalApiKey,
      agent,
      ideaText,
      cleanPriorMessages,
      round,
      providerConfig,
      rebuttalText
    );

    let modelLabel = "";
    if (providerConfig) {
      const p = providerConfig.provider;
      const m = providerConfig.modelName || (p === "nvidia" ? "meta/llama-3.3-70b-instruct" : p === "ollama" ? "llama3.1:70b" : p === "lm-studio" ? "Default Model" : p === "openrouter" ? "meta-llama/llama-3.3-70b-instruct" : "Model");
      const formattedProvider = p === "nvidia" ? "Nvidia" : p === "openrouter" ? "OpenRouter" : p === "ollama" ? "Ollama" : p === "lm-studio" ? "LM Studio" : "Custom";
      modelLabel = `${m} (${formattedProvider})`;
    } else {
      modelLabel = "meta/llama-3.3-70b-instruct (Nvidia)";
    }

    const message: DebateMessage = {
      agentId: agent.id,
      agentName: agent.name,
      avatarEmoji: agent.avatar_emoji,
      content: response,
      round,
      timestamp: Date.now(),
      modelLabel,
    };

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("[debate-step] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
