import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify } from "yaml";
import { slugify, timestampId } from "./ids.js";
import { getVoicePaths, resolveRepoRoot } from "./paths.js";
import { voiceSampleSchema } from "./schemas.js";
import type { VoiceSample } from "./types.js";

export type AddSampleInput = {
  sourcePath: string;
  label: string;
  weight: number;
  repoRoot?: string;
};

export async function addVoiceSample(input: AddSampleInput): Promise<VoiceSample> {
  const repoRoot = input.repoRoot ?? resolveRepoRoot();
  const paths = getVoicePaths(repoRoot);
  await mkdir(paths.samplesDir, { recursive: true });

  const sourcePath = path.resolve(input.sourcePath);
  const id = `${timestampId()}-${slugify(input.label)}`;
  const samplePath = path.join(paths.samplesDir, `${id}.md`);
  const metadataPath = path.join(paths.samplesDir, `${id}.yml`);
  const sample: VoiceSample = {
    id,
    label: input.label,
    weight: input.weight,
    sourcePath: toPortableRepoPath(sourcePath, repoRoot),
    samplePath: toPortableRepoPath(samplePath, repoRoot),
    metadataPath: toPortableRepoPath(metadataPath, repoRoot),
    addedAt: new Date().toISOString()
  };

  voiceSampleSchema.parse(sample);
  await copyFile(sourcePath, samplePath);
  await writeFile(metadataPath, stringify(sample), "utf8");

  return sample;
}

function toPortableRepoPath(filePath: string, repoRoot: string): string {
  const relativePath = path.relative(repoRoot, filePath);
  if (
    relativePath &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  ) {
    return relativePath.split(path.sep).join("/");
  }
  return filePath;
}
