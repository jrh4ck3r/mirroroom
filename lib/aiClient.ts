import { AgentProfile, DebateMessage, ProviderConfig } from "./types";
import { renderSystemPrompt } from "./agentLoader";

const NIM_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.NIM_MODEL || "meta/llama-3.3-70b-instruct";
const MAX_TOKENS = 400;
const TEMPERATURE = 0.7;
const TOP_P = 0.9;

/** OpenAI-compatible message shape */
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Dynamically resolves target request endpoint, authorization headers,
 * and model names based on the provider config settings.
 */
function getRequestConfig(apiKey: string, providerConfig?: ProviderConfig) {
  let url = NIM_API_URL;
  let authHeader = `Bearer ${apiKey}`;
  let model = DEFAULT_MODEL;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (providerConfig) {
    const { provider, baseUrl, apiKey: configKey, modelName } = providerConfig;
    if (provider === "nvidia") {
      url = NIM_API_URL;
      authHeader = `Bearer ${configKey || apiKey}`;
      model = modelName || DEFAULT_MODEL;
    } else if (provider === "openrouter") {
      url = "https://openrouter.ai/api/v1/chat/completions";
      authHeader = `Bearer ${configKey || apiKey}`;
      model = modelName || "meta-llama/llama-3.3-70b-instruct";
      headers["HTTP-Referer"] = "https://github.com/jrh4ck3r/mirroroom";
      headers["X-Title"] = "MirrorRoom";
    } else if (provider === "ollama") {
      const base = (baseUrl || "http://localhost:11434/v1").replace(/\/$/, "");
      url = `${base}/chat/completions`;
      authHeader = `Bearer ${configKey || "dummy_key"}`;
      model = modelName || "llama3.1:70b";
    } else if (provider === "lm-studio") {
      const base = (baseUrl || "http://localhost:1234/v1").replace(/\/$/, "");
      url = `${base}/chat/completions`;
      authHeader = `Bearer ${configKey || "dummy_key"}`;
      model = modelName || ""; // LM studio can pick whatever default model is loaded
    } else if (provider === "custom") {
      const base = (baseUrl || "").replace(/\/$/, "");
      url = `${base}/chat/completions`;
      authHeader = `Bearer ${configKey || apiKey || "dummy_key"}`;
      model = modelName || DEFAULT_MODEL;
    }
  }

  headers["Authorization"] = authHeader;

  return { url, headers, model };
}

/**
 * Build the OpenAI-compatible messages array for an agent's API call.
 */
function buildMessages(
  agent: AgentProfile,
  idea: string,
  priorMessages: DebateMessage[],
  round: number,
  rebuttalText?: string
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  // System prompt: the agent's rendered persona
  messages.push({
    role: "system",
    content: renderSystemPrompt(agent),
  });

  if (round === 1) {
    // First round: present the idea, include any prior agent responses as context
    let userContent = `Here is the idea being presented to the panel:\n\n"${idea}"`;

    if (priorMessages.length > 0) {
      userContent += "\n\nHere is what other panelists have said so far:\n";
      for (const msg of priorMessages) {
        userContent += `\n${msg.avatarEmoji} ${msg.agentName}: "${msg.content}"`;
      }
      userContent +=
        "\n\nNow give your reaction. You may respond to the idea directly, or react to what another panelist said. Keep your response concise — 2-4 sentences maximum. Do not exceed this even if you have more to say.";
    } else {
      userContent +=
        "\n\nYou are the first panelist to react. Give your honest reaction. Keep your response concise — 2-4 sentences maximum. Do not exceed this even if you have more to say.";
    }

    messages.push({ role: "user", content: userContent });
  } else if (round === 3) {
    // Rebuttal round
    let userContent = `The panel was asked to react to this idea:\n\n"${idea}"\n\nHere is the full transcript of the previous panel discussion:\n`;
    for (const msg of priorMessages.filter((m) => m.round < 3)) {
      userContent += `\n${msg.avatarEmoji} ${msg.agentName}: "${msg.content}"`;
    }

    // Identify this agent's own previous response(s)
    const ownMessages = priorMessages.filter((m) => m.agentId === agent.id && m.round < 3);
    if (ownMessages.length > 0) {
      userContent += `\n\nYour own previous statement was: "${ownMessages[ownMessages.length - 1].content}"`;
    }

    userContent += `\n\nThe person who presented the idea has responded to the panel's feedback. Here is their rebuttal:\n\n"${rebuttalText}"\n\n`;
    userContent += `React to their rebuttal honestly in 2-4 sentences. You may change your position if they made a compelling point, or hold firm if you're not convinced. Be specific about what changed your mind or what still concerns you. Keep your response concise — 2-4 sentences maximum. Do not exceed this even if you have more to say.`;

    messages.push({ role: "user", content: userContent });
  } else {
    // Cross-reaction round: agents respond to the full transcript
    let userContent = `The panel was asked to react to this idea:\n\n"${idea}"\n\nHere is the full first round of reactions:\n`;
    for (const msg of priorMessages.filter((m) => m.round === 1)) {
      userContent += `\n${msg.avatarEmoji} ${msg.agentName}: "${msg.content}"`;
    }

    // Include any cross-reactions that have already happened in this round
    const crossReactions = priorMessages.filter((m) => m.round === 2);
    if (crossReactions.length > 0) {
      userContent += "\n\nCross-reactions so far:\n";
      for (const msg of crossReactions) {
        userContent += `\n${msg.avatarEmoji} ${msg.agentName}: "${msg.content}"`;
      }
    }

    userContent +=
      "\n\nNow it's your turn for a cross-reaction. Respond to something another panelist said — agree, push back, or add nuance. Keep your response concise — 1-3 sentences maximum. Do not exceed this even if you have more to say.";

    messages.push({ role: "user", content: userContent });
  }

  return messages;
}

/**
 * Call the selected API provider with a single agent's persona to get their reaction.
 * Returns the raw text response.
 */
export async function getAgentResponse(
  apiKey: string,
  agent: AgentProfile,
  idea: string,
  priorMessages: DebateMessage[],
  round: number,
  providerConfig?: ProviderConfig,
  rebuttalText?: string
): Promise<string> {
  const messages = buildMessages(agent, idea, priorMessages, round, rebuttalText);
  const { url, headers, model } = getRequestConfig(apiKey, providerConfig);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model,
      messages,
      temperature: TEMPERATURE,
      top_p: TOP_P,
      max_tokens: providerConfig?.maxTokens || MAX_TOKENS,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `LLM API error (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();

  // OpenAI-compatible response shape
  const choice = data.choices?.[0];
  if (!choice || !choice.message?.content) {
    throw new Error("No content in LLM API response");
  }

  return choice.message.content;
}

/**
 * Stream an agent's response from LLM API.
 * Returns a ReadableStream of SSE chunks in OpenAI streaming format.
 */
export async function streamAgentResponse(
  apiKey: string,
  agent: AgentProfile,
  idea: string,
  priorMessages: DebateMessage[],
  round: number,
  providerConfig?: ProviderConfig,
  rebuttalText?: string
): Promise<ReadableStream<Uint8Array>> {
  const messages = buildMessages(agent, idea, priorMessages, round, rebuttalText);
  const { url, headers, model } = getRequestConfig(apiKey, providerConfig);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model,
      messages,
      temperature: TEMPERATURE,
      top_p: TOP_P,
      max_tokens: providerConfig?.maxTokens || MAX_TOKENS,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `LLM API error (${response.status}): ${errorBody}`
    );
  }

  if (!response.body) {
    throw new Error("No response body from LLM streaming API");
  }

  return response.body;
}

/**
 * Generate the final verdict by sending the full transcript to the LLM.
 * Returns raw JSON string for parsing by the caller.
 */
export async function generateVerdict(
  apiKey: string,
  idea: string,
  debateMessages: DebateMessage[],
  providerConfig?: ProviderConfig,
  rebuttalText?: string
): Promise<string> {
  const transcriptLines = debateMessages.map(
    (m) =>
      `[Round ${m.round}] ${m.avatarEmoji} ${m.agentName}: "${m.content}"`
  );

  const systemPrompt = `You are an impartial analyst summarizing a panel debate. Based on the transcript provided, produce a JSON object with exactly these fields:
- "overallScore": a number from 0-100 representing overall positive reception
- "topConcerns": an array of exactly 3 strings, each a concise concern raised
- "topSupport": an array of exactly 3 strings, each a concise point of support
- "mostPolarizingPair": an object with "agent1" (name), "agent2" (name), and "reason" (one sentence why they disagreed)
- "summary": a 2-3 sentence overall summary of the panel's reception

Return ONLY the JSON object, no markdown formatting, no explanation.`;

  let userMessage = `Here is the idea that was debated:\n\n"${idea}"\n\n`;
  if (rebuttalText) {
    userMessage += `Here is the user's rebuttal to the panel's initial feedback:\n\n"${rebuttalText}"\n\n`;
  }
  userMessage += `Here is the full debate transcript:\n\n${transcriptLines.join("\n")}\n\nNow produce the verdict JSON.`;

  const { url, headers, model } = getRequestConfig(apiKey, providerConfig);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: TEMPERATURE,
      top_p: TOP_P,
      max_tokens: providerConfig?.maxTokens ? Math.max(providerConfig.maxTokens * 2, 800) : 800,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `LLM API error (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice || !choice.message?.content) {
    throw new Error("No content in verdict response");
  }

  return choice.message.content;
}
