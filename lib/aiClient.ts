import { AgentProfile, DebateMessage, ProviderConfig } from "./types";
import { renderSystemPrompt } from "./agentLoader";

const NIM_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.NIM_MODEL || "meta/llama-3.3-70b-instruct";
const MAX_TOKENS = 300;
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

  if (providerConfig) {
    const { provider, baseUrl, apiKey: configKey, modelName } = providerConfig;
    if (provider === "nvidia") {
      url = NIM_API_URL;
      authHeader = `Bearer ${configKey || apiKey}`;
      model = modelName || DEFAULT_MODEL;
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

  return { url, authHeader, model };
}

/**
 * Build the OpenAI-compatible messages array for an agent's API call.
 */
function buildMessages(
  agent: AgentProfile,
  idea: string,
  priorMessages: DebateMessage[],
  round: number
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
        "\n\nNow give your reaction. You may respond to the idea directly, or react to what another panelist said. Keep it to 2-4 sentences.";
    } else {
      userContent +=
        "\n\nYou are the first panelist to react. Give your honest reaction in 2-4 sentences.";
    }

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
      "\n\nNow it's your turn for a cross-reaction. Respond to something another panelist said — agree, push back, or add nuance. Keep it to 1-3 sentences.";

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
  providerConfig?: ProviderConfig
): Promise<string> {
  const messages = buildMessages(agent, idea, priorMessages, round);
  const { url, authHeader, model } = getRequestConfig(apiKey, providerConfig);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      model: model,
      messages,
      temperature: TEMPERATURE,
      top_p: TOP_P,
      max_tokens: MAX_TOKENS,
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
  providerConfig?: ProviderConfig
): Promise<ReadableStream<Uint8Array>> {
  const messages = buildMessages(agent, idea, priorMessages, round);
  const { url, authHeader, model } = getRequestConfig(apiKey, providerConfig);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      model: model,
      messages,
      temperature: TEMPERATURE,
      top_p: TOP_P,
      max_tokens: MAX_TOKENS,
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
  providerConfig?: ProviderConfig
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

  const userMessage = `Here is the idea that was debated:\n\n"${idea}"\n\nHere is the full debate transcript:\n\n${transcriptLines.join("\n")}\n\nNow produce the verdict JSON.`;

  const { url, authHeader, model } = getRequestConfig(apiKey, providerConfig);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: TEMPERATURE,
      top_p: TOP_P,
      max_tokens: 500,
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
