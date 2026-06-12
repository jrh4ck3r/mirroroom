import fs from "fs";
import path from "path";
import { AgentProfile } from "./types";

const AGENTS_DIR = path.join(process.cwd(), "agents");

/**
 * Recursively discover all agent JSON files under /agents.
 * Walks subdirectories (e.g. agents/malaysia/, agents/global/) so that
 * contributors can organize agents however they like.
 */
function discoverAgentFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...discoverAgentFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Load and parse a single agent JSON file.
 * Throws if the file is malformed or missing required fields.
 */
function parseAgentFile(filePath: string): AgentProfile {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as AgentProfile;

  // Basic validation — ensure the critical fields exist
  if (!data.id || !data.name || !data.system_prompt_template) {
    throw new Error(
      `Invalid agent file ${filePath}: missing id, name, or system_prompt_template`
    );
  }

  return data;
}

/**
 * Load all agent profiles from the /agents directory.
 * Returns a Map keyed by agent id for O(1) lookup.
 */
export function loadAllAgents(): Map<string, AgentProfile> {
  const agentFiles = discoverAgentFiles(AGENTS_DIR);
  const agents = new Map<string, AgentProfile>();

  for (const file of agentFiles) {
    const agent = parseAgentFile(file);
    if (agents.has(agent.id)) {
      console.warn(
        `Duplicate agent id "${agent.id}" found — later file overwrites earlier one.`
      );
    }
    agents.set(agent.id, agent);
  }

  return agents;
}

/**
 * Load a single agent by id.
 * Convenience wrapper around loadAllAgents().
 */
export function loadAgentById(agentId: string): AgentProfile | undefined {
  const agents = loadAllAgents();
  return agents.get(agentId);
}

/**
 * Get all agents as a plain array (useful for listing in UI).
 */
export function loadAllAgentsArray(): AgentProfile[] {
  return Array.from(loadAllAgents().values());
}

/**
 * Render an agent's system_prompt_template by substituting {{field}} placeholders
 * with the agent's own data. This is the prompt sent to Claude.
 */
export function renderSystemPrompt(agent: AgentProfile): string {
  let prompt = agent.system_prompt_template;

  // Replace all {{field}} placeholders with the corresponding agent field
  prompt = prompt.replace(/\{\{(\w+)\}\}/g, (match, field: string) => {
    const value = agent[field as keyof AgentProfile];
    if (value === undefined) {
      console.warn(`Template field "{{${field}}}" not found on agent "${agent.id}"`);
      return match; // Leave placeholder as-is if field doesn't exist
    }
    // Arrays get joined into a comma-separated string
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    return String(value);
  });

  return prompt;
}
