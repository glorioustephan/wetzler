import { existsSync, statSync } from "node:fs";
import path from "node:path";

export type VoicePaths = {
  repoRoot: string;
  valeConfigPath: string;
  profilePath: string;
  stylesPath: string;
  samplesDir: string;
  proposalsDir: string;
  acceptVocabularyPath: string;
  rejectVocabularyPath: string;
};

export function resolveRepoRoot(startPath = process.cwd()): string {
  const envRoot = process.env.WRITING_VOICE_ROOT;
  if (envRoot && envRoot.trim()) {
    const resolvedEnvRoot = path.resolve(envRoot);
    if (!isVoiceRepoRoot(resolvedEnvRoot)) {
      throw new Error(`WRITING_VOICE_ROOT does not contain voice/profile.yml and .vale.ini: ${resolvedEnvRoot}`);
    }
    return resolvedEnvRoot;
  }

  const root = findVoiceRepoRoot(startPath);
  if (!root) {
    throw new Error(`Unable to find writing voice root from ${path.resolve(startPath)}.`);
  }
  return root;
}

export function resolveRepoRootForPath(targetPath: string): string {
  const envRoot = process.env.WRITING_VOICE_ROOT;
  if (envRoot && envRoot.trim()) {
    return resolveRepoRoot();
  }

  const resolvedTarget = path.resolve(targetPath);
  const startPath = pathLooksLikeDirectory(resolvedTarget) ? resolvedTarget : path.dirname(resolvedTarget);
  const root = findVoiceRepoRoot(startPath);
  if (!root) {
    throw new Error(`Unable to find writing voice root for ${resolvedTarget}. Use --repo-root or WRITING_VOICE_ROOT.`);
  }
  return root;
}

function pathLooksLikeDirectory(targetPath: string): boolean {
  if (existsSync(targetPath)) {
    return statSync(targetPath).isDirectory();
  }
  return targetPath.endsWith(path.sep);
}

export function isVoiceRepoRoot(repoRoot: string): boolean {
  const profilePath = path.join(repoRoot, "voice", "profile.yml");
  const valeConfigPath = path.join(repoRoot, ".vale.ini");
  return existsSync(profilePath) && existsSync(valeConfigPath);
}

function findVoiceRepoRoot(startPath: string): string | null {
  let current = path.resolve(startPath);
  while (true) {
    if (isVoiceRepoRoot(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function getVoicePaths(repoRoot = resolveRepoRoot()): VoicePaths {
  return {
    repoRoot,
    valeConfigPath: path.join(repoRoot, ".vale.ini"),
    profilePath: path.join(repoRoot, "voice", "profile.yml"),
    stylesPath: path.join(repoRoot, "styles"),
    samplesDir: path.join(repoRoot, "voice", "samples"),
    proposalsDir: path.join(repoRoot, "voice", "proposals"),
    acceptVocabularyPath: path.join(
      repoRoot,
      "styles",
      "config",
      "vocabularies",
      "Voice",
      "accept.txt"
    ),
    rejectVocabularyPath: path.join(
      repoRoot,
      "styles",
      "config",
      "vocabularies",
      "Voice",
      "reject.txt"
    )
  };
}
