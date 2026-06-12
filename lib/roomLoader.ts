import fs from "fs";
import path from "path";
import { RoomPreset, AgentProfile } from "./types";
import { loadAllAgents } from "./agentLoader";

const ROOMS_DIR = path.join(process.cwd(), "rooms");

/**
 * Load all room preset JSON files from /rooms.
 */
export function loadAllRooms(): RoomPreset[] {
  const files = fs.readdirSync(ROOMS_DIR).filter((f) => f.endsWith(".json"));
  const rooms: RoomPreset[] = [];

  for (const file of files) {
    const filePath = path.join(ROOMS_DIR, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as RoomPreset;

    if (!data.id || !data.name || !data.agent_ids) {
      console.warn(`Invalid room file ${file}: missing id, name, or agent_ids`);
      continue;
    }

    rooms.push(data);
  }

  return rooms;
}

/**
 * Load a single room by id.
 */
export function loadRoomById(roomId: string): RoomPreset | undefined {
  const rooms = loadAllRooms();
  return rooms.find((r) => r.id === roomId);
}

/**
 * Resolve a room preset to its full list of AgentProfile objects.
 * Validates that all referenced agent_ids actually exist.
 * Returns the agents in the order specified by the room preset.
 */
export function resolveRoomAgents(room: RoomPreset): AgentProfile[] {
  const allAgents = loadAllAgents();
  const resolved: AgentProfile[] = [];
  const missing: string[] = [];

  for (const agentId of room.agent_ids) {
    const agent = allAgents.get(agentId);
    if (agent) {
      resolved.push(agent);
    } else {
      missing.push(agentId);
    }
  }

  if (missing.length > 0) {
    console.warn(
      `Room "${room.id}" references unknown agent(s): ${missing.join(", ")}`
    );
  }

  return resolved;
}
