import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { getVoicePaths, resolveRepoRoot } from "./paths.js";
import { voiceProfileSchema } from "./schemas.js";
import type { VoiceProfile } from "./types.js";

export async function loadVoiceProfile(repoRoot = resolveRepoRoot()): Promise<VoiceProfile> {
  const paths = getVoicePaths(repoRoot);
  const rawProfile = await readFile(paths.profilePath, "utf8");
  const parsed: unknown = parse(rawProfile);
  return voiceProfileSchema.parse(parsed);
}

