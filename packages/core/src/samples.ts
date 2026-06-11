import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify } from "yaml";
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
  await readFile(sourcePath, "utf8");

  const id = `${timestampId()}-${slugify(input.label)}`;
  const samplePath = path.join(paths.samplesDir, `${id}.md`);
  const metadataPath = path.join(paths.samplesDir, `${id}.yml`);
  const sample: VoiceSample = {
    id,
    label: input.label,
    weight: input.weight,
    sourcePath,
    samplePath,
    metadataPath,
    addedAt: new Date().toISOString()
  };

  voiceSampleSchema.parse(sample);
  await copyFile(sourcePath, samplePath);
  await writeFile(metadataPath, stringify(sample), "utf8");

  return sample;
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || "sample";
}

function timestampId(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

