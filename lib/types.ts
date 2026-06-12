/**
 * Core type definitions for MirrorRoom agent profiles and room presets.
 * These types mirror the JSON schemas in /agents and /rooms.
 */

export interface AgentProfile {
  id: string;
  name: string;
  avatar_emoji: string;
  age: number;
  ethnicity: string;
  religion: string;
  occupation: string;
  location: string;
  income_bracket: string;
  political_lean: string;
  personality_traits: string[];
  core_belief: string;
  speaking_style: string;
  system_prompt_template: string;
}

export interface RoomPreset {
  id: string;
  name: string;
  description: string;
  agent_ids: string[];
}

/** A single message in the debate transcript */
export interface DebateMessage {
  agentId: string;
  agentName: string;
  avatarEmoji: string;
  content: string;
  round: number; // 1 = initial reaction, 2 = cross-reaction
  timestamp: number;
}

/** The verdict produced after all agents have debated */
export interface Verdict {
  overallScore: number; // 0-100
  topConcerns: string[];
  topSupport: string[];
  mostPolarizingPair: {
    agent1: string;
    agent2: string;
    reason: string;
  };
  summary: string;
}

/** Debate session state */
export interface DebateSession {
  id: string;
  idea: string;
  roomId: string;
  agents: AgentProfile[];
  messages: DebateMessage[];
  verdict: Verdict | null;
  status: "idle" | "debating" | "cross-reacting" | "generating-verdict" | "complete";
}

/** Config settings for local/custom LLM providers */
export interface ProviderConfig {
  provider: "nvidia" | "ollama" | "lm-studio" | "custom";
  baseUrl?: string;
  apiKey?: string;
  modelName?: string;
}
