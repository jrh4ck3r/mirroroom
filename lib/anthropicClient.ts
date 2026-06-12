import { AgentProfile, DebateMessage } from "./types";
import { renderSystemPrompt } from "./agentLoader";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 300; // Keep responses punchy: 2-4 sentences

/**
 * Build the messages array for an agent's API call.
 * Includes the idea prompt and any prior debate messages as context
 * so agents can reference what others have said.
 */
function buildMessages(
  idea: string,
  priorMessages: DebateMessage[],
  round: number
): Array<{ role: "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

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
 * Call Claude with a single agent's persona to get their reaction.
 * Returns the raw text response.
 *
 * @param apiKey - User's Anthropic API key (passed from client, never stored)
 * @param agent - The agent profile to use
 * @param idea - The idea being debated
 * @param priorMessages - Messages from agents who have already spoken
 * @param round - 1 for initial reactions, 2 for cross-reactions
 */
export async function getAgentResponse(
  apiKey: string,
  agent: AgentProfile,
  idea: string,
  priorMessages: DebateMessage[],
  round: number
): Promise<string> {
  const systemPrompt = renderSystemPrompt(agent);
  const messages = buildMessages(idea, priorMessages, round);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Anthropic API error (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();

  // Extract text from the response content blocks
  const textBlocks = data.content?.filter(
    (block: { type: string }) => block.type === "text"
  );
  if (!textBlocks || textBlocks.length === 0) {
    throw new Error("No text content in Anthropic response");
  }

  return textBlocks.map((b: { text: string }) => b.text).join("");
}

/**
 * Stream an agent's response from Claude.
 * Returns a ReadableStream that emits text chunks as they arrive.
 */
export async function streamAgentResponse(
  apiKey: string,
  agent: AgentProfile,
  idea: string,
  priorMessages: DebateMessage[],
  round: number
): Promise<ReadableStream<Uint8Array>> {
  const systemPrompt = renderSystemPrompt(agent);
  const messages = buildMessages(idea, priorMessages, round);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Anthropic API error (${response.status}): ${errorBody}`
    );
  }

  if (!response.body) {
    throw new Error("No response body from Anthropic streaming API");
  }

  return response.body;
}

/**
 * Generate the final verdict by sending the full transcript to Claude.
 * Returns raw JSON string for parsing by the caller.
 */
export async function generateVerdict(
  apiKey: string,
  idea: string,
  messages: DebateMessage[]
): Promise<string> {
  const transcriptLines = messages.map(
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

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Anthropic API error (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();
  const textBlocks = data.content?.filter(
    (block: { type: string }) => block.type === "text"
  );
  if (!textBlocks || textBlocks.length === 0) {
    throw new Error("No text content in verdict response");
  }

  return textBlocks.map((b: { text: string }) => b.text).join("");
}
