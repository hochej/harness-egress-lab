import { claudeCodeProfile } from "./claude-code.js";
import type { HarnessProfile } from "./types.js";

const profiles = [claudeCodeProfile] as const;

export function listProfiles(): HarnessProfile[] {
  return [...profiles];
}

export function getProfile(name: string): HarnessProfile {
  const profile = profiles.find((entry) => entry.name === name);
  if (!profile) {
    throw new Error(
      `Unknown profile '${name}'. Available profiles: ${profiles.map((entry) => entry.name).join(", ")}`,
    );
  }
  return profile;
}
