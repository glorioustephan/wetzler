import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import fg from "fast-glob";
import { parse, stringify } from "yaml";
import { slugify, timestampId } from "./ids.js";
import { getVoicePaths, resolveRepoRoot } from "./paths.js";
import { loadVoiceProfile } from "./profile.js";
import { voiceUpdateProposalSchema } from "./schemas.js";
import { lintMarkdown } from "./vale.js";
import type {
  ProfileProposalChanges,
  ValeRuleProposal,
  VocabularyProposalChanges,
  VoiceProfile,
  VoiceUpdateProposal,
  VoiceUpdateValidation,
} from "./types.js";

type SampleMetrics = {
  source: string;
  wordCount: number;
  sentenceCount: number;
  averageSentenceWords: number;
  paragraphCount: number;
  averageParagraphWords: number;
  codeFenceCount: number;
  inlineCodeCount: number;
  firstPersonCount: number;
  contractionCount: number;
  concreteDetailCount: number;
};

type PlannedWrite = {
  filePath: string;
  contents: string;
};

type PreparedWrite = PlannedWrite & {
  tempPath: string;
  previousContents: string | null;
};

export type CreateProposalInput = {
  sampleGlobs: string[];
  rationale?: string;
  repoRoot?: string;
};

export async function createVoiceUpdateProposal(
  input: CreateProposalInput,
): Promise<VoiceUpdateProposal> {
  const repoRoot = input.repoRoot ?? resolveRepoRoot();
  const paths = getVoicePaths(repoRoot);
  await mkdir(paths.proposalsDir, { recursive: true });

  const sources = await fg(input.sampleGlobs, {
    cwd: repoRoot,
    absolute: true,
    onlyFiles: true,
  });
  if (sources.length === 0) {
    throw new Error(
      `No samples matched: ${input.sampleGlobs.join(", ")}. Add samples first or check the glob path.`,
    );
  }
  const [profile, sampleMetrics] = await Promise.all([
    loadVoiceProfile(repoRoot),
    analyzeSamples(sources),
  ]);
  const observations = summarizeSamples(sampleMetrics);
  const id = `${timestampId()}-${slugify(input.rationale ?? "voice-update")}`;
  const proposal: VoiceUpdateProposal = {
    id,
    status: "proposed",
    createdAt: new Date().toISOString(),
    sources,
    rationale:
      input.rationale ??
      "Review-gated proposal generated from samples. Fill changes before accepting.",
    observations,
    changes: {
      profile: suggestProfileChanges(profile, sampleMetrics),
      vocabulary: emptyVocabularyChanges(),
      rules: [],
    },
  };

  voiceUpdateProposalSchema.parse(proposal);
  await writeProposal(paths.proposalsDir, proposal);
  return proposal;
}

export async function acceptVoiceUpdateProposal(
  proposalId: string,
  repoRoot = resolveRepoRoot(),
): Promise<VoiceUpdateProposal> {
  const paths = getVoicePaths(repoRoot);
  const proposal = await readProposal(paths.proposalsDir, proposalId);
  if (proposal.status === "accepted") {
    return proposal;
  }

  const validation = await validateVoiceUpdateProposal(proposalId, repoRoot);
  if (!validation.ok) {
    throw new Error(
      `Voice update proposal ${proposalId} failed validation: ${validation.errors.join("; ")}`,
    );
  }

  const profile = await loadVoiceProfile(repoRoot);
  const acceptedProposal: VoiceUpdateProposal = {
    ...proposal,
    status: "accepted",
    acceptedAt: new Date().toISOString(),
  };

  await applyAtomicWrites([
    {
      filePath: paths.profilePath,
      contents: stringify(
        applyProfileChanges(profile, proposal.changes.profile),
      ),
    },
    {
      filePath: paths.acceptVocabularyPath,
      contents: await mergeVocabularyFile(
        paths.acceptVocabularyPath,
        proposal.changes.vocabulary.accept,
      ),
    },
    {
      filePath: paths.rejectVocabularyPath,
      contents: await mergeVocabularyFile(
        paths.rejectVocabularyPath,
        proposal.changes.vocabulary.reject,
      ),
    },
    ...proposal.changes.rules.map((rule) => ({
      filePath: path.join(
        paths.voiceRulesDir,
        safeValeRuleFilename(rule.filename),
      ),
      contents: rule.contents,
    })),
    {
      filePath: path.join(paths.proposalsDir, `${acceptedProposal.id}.yml`),
      contents: stringify(acceptedProposal),
    },
  ]);
  return acceptedProposal;
}

export async function validateVoiceUpdateProposal(
  proposalId: string,
  repoRoot = resolveRepoRoot(),
): Promise<VoiceUpdateValidation> {
  const paths = getVoicePaths(repoRoot);
  const proposal = await readProposal(paths.proposalsDir, proposalId);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!hasProposalChanges(proposal)) {
    warnings.push(
      "Proposal contains no profile, vocabulary, or Vale rule changes.",
    );
  }

  for (const rule of proposal.changes.rules) {
    validateRuleShape(rule, errors);
  }

  const tempRoot = await createValidationRepo(repoRoot, proposal);
  try {
    const lintResult = await lintMarkdown({
      markdown:
        "This is a validation document with a concrete path like packages/core/src/index.ts.",
      filePath: "validation.md",
      repoRoot: tempRoot,
    });
    if (lintResult.runtimeError) {
      errors.push(lintResult.runtimeError.message);
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }

  return {
    proposalId,
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function applyProfileChanges(
  profile: VoiceProfile,
  changes: ProfileProposalChanges,
): VoiceProfile {
  return {
    ...profile,
    principles: mergeUnique(profile.principles, changes.principles),
    toneBoundaries: mergeUnique(profile.toneBoundaries, changes.toneBoundaries),
    allowedMoves: mergeUnique(profile.allowedMoves, changes.allowedMoves),
    bannedMoves: mergeUnique(profile.bannedMoves, changes.bannedMoves),
    rewriteRubric: mergeUnique(profile.rewriteRubric, changes.rewriteRubric),
  };
}

async function analyzeSamples(sources: string[]): Promise<SampleMetrics[]> {
  const metrics: SampleMetrics[] = [];
  for (const source of sources) {
    const markdown = await readFile(source, "utf8");
    const words = markdown.match(/\b[\w'-]+\b/g) ?? [];
    const sentences = markdown.match(/[^.!?]+[.!?]+/g) ?? [];
    const paragraphs = markdown
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
    const averageSentenceWords =
      sentences.length === 0
        ? words.length
        : Math.round(words.length / sentences.length);
    const averageParagraphWords =
      paragraphs.length === 0
        ? words.length
        : Math.round(words.length / paragraphs.length);
    metrics.push({
      source,
      wordCount: words.length,
      sentenceCount: sentences.length,
      averageSentenceWords,
      paragraphCount: paragraphs.length,
      averageParagraphWords,
      codeFenceCount: markdown.match(/```/g)?.length ?? 0,
      inlineCodeCount: markdown.match(/`[^`\n]+`/g)?.length ?? 0,
      firstPersonCount: markdown.match(/\b(I|we|me|my|our)\b/g)?.length ?? 0,
      contractionCount:
        markdown.match(
          /\b(?:can't|don't|won't|isn't|aren't|it's|that's|we're|I'm|you're)\b/gi,
        )?.length ?? 0,
      concreteDetailCount:
        markdown.match(
          /(?:`[^`\n]+`|\/[\w./-]+|[\w.-]+\.(?:ts|tsx|js|md|json|yml)|\b\d{4}-\d{2}-\d{2}\b)/g,
        )?.length ?? 0,
    });
  }
  return metrics;
}

function summarizeSamples(metrics: SampleMetrics[]): string[] {
  if (metrics.length === 0) {
    return [
      "No samples matched. Add sample paths or edit this proposal manually before accepting.",
    ];
  }

  return metrics.map(
    (sample) =>
      `${path.basename(sample.source)}: ${sample.wordCount} words, ${sample.paragraphCount} paragraphs, about ${sample.averageSentenceWords} words per sentence, ${sample.concreteDetailCount} concrete details.`,
  );
}

function suggestProfileChanges(
  profile: VoiceProfile,
  metrics: SampleMetrics[],
): ProfileProposalChanges {
  if (metrics.length === 0) {
    return emptyProfileChanges();
  }

  const changes = emptyProfileChanges();
  const averageSentenceWords = average(
    metrics.map((sample) => sample.averageSentenceWords),
  );
  const averageParagraphWords = average(
    metrics.map((sample) => sample.averageParagraphWords),
  );
  const totalFirstPerson = sum(
    metrics.map((sample) => sample.firstPersonCount),
  );
  const totalContractions = sum(
    metrics.map((sample) => sample.contractionCount),
  );
  const totalConcreteDetails = sum(
    metrics.map((sample) => sample.concreteDetailCount),
  );

  if (averageSentenceWords <= 18) {
    changes.allowedMoves.push(
      "Let concise sentences carry confidence without overexplaining.",
    );
  }
  if (averageParagraphWords <= 90) {
    changes.allowedMoves.push(
      "Keep paragraphs compact enough that each one gives the reader a clean place to land.",
    );
  }
  if (totalFirstPerson > 0) {
    changes.allowedMoves.push(
      "Use first person when the source owns a judgment, decision, or lived experience.",
    );
  }
  if (totalContractions > 0) {
    changes.toneBoundaries.push(
      "Contractions are welcome when they keep a sentence conversational and unforced.",
    );
  }
  if (totalConcreteDetails > 0) {
    changes.rewriteRubric.push(
      "Preserve concrete details from samples, including code identifiers, paths, dates, and command text.",
    );
  }

  return {
    principles: withoutExisting(profile.principles, changes.principles),
    toneBoundaries: withoutExisting(
      profile.toneBoundaries,
      changes.toneBoundaries,
    ),
    allowedMoves: withoutExisting(profile.allowedMoves, changes.allowedMoves),
    bannedMoves: withoutExisting(profile.bannedMoves, changes.bannedMoves),
    rewriteRubric: withoutExisting(
      profile.rewriteRubric,
      changes.rewriteRubric,
    ),
  };
}

async function mergeVocabularyFile(
  filePath: string,
  lines: string[],
): Promise<string> {
  const existing = await readFile(filePath, "utf8").catch(() => "");
  const merged = mergeUnique(
    existing
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    lines.map((line) => line.trim()).filter(Boolean),
  );
  return `${merged.join("\n")}\n`;
}

async function writeValeRules(
  rulesDir: string,
  rules: ValeRuleProposal[],
): Promise<void> {
  for (const rule of rules) {
    await writeFile(
      path.join(rulesDir, safeValeRuleFilename(rule.filename)),
      rule.contents,
      "utf8",
    );
  }
}

async function writeProposal(
  proposalsDir: string,
  proposal: VoiceUpdateProposal,
): Promise<void> {
  await writeFile(
    path.join(proposalsDir, `${proposal.id}.yml`),
    stringify(proposal),
    "utf8",
  );
}

async function readProposal(
  proposalsDir: string,
  proposalId: string,
): Promise<VoiceUpdateProposal> {
  if (!/^[A-Za-z0-9._-]+$/.test(proposalId)) {
    throw new Error(`Unsafe proposal id: ${proposalId}`);
  }
  const proposalPath = path.join(proposalsDir, `${proposalId}.yml`);
  const parsed: unknown = parse(await readFile(proposalPath, "utf8"));
  return voiceUpdateProposalSchema.parse(parsed);
}

function validateRuleShape(rule: ValeRuleProposal, errors: string[]): void {
  try {
    safeValeRuleFilename(rule.filename);
    const parsed: unknown = parse(rule.contents);
    if (!isRecord(parsed)) {
      errors.push(`${rule.filename} must contain a YAML object.`);
      return;
    }
    const extendsValue = parsed.extends;
    if (typeof extendsValue !== "string" || !extendsValue.trim()) {
      errors.push(`${rule.filename} must define an extends value.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`${rule.filename}: ${message}`);
  }
}

function safeValeRuleFilename(filename: string): string {
  const safeName = path.basename(filename);
  if (safeName !== filename || !/^[A-Za-z0-9._-]+\.yml$/.test(safeName)) {
    throw new Error(`Unsafe Vale rule filename: ${filename}`);
  }
  return safeName;
}

function hasProposalChanges(proposal: VoiceUpdateProposal): boolean {
  const profileChanges = proposal.changes.profile;
  return (
    profileChanges.principles.length > 0 ||
    profileChanges.toneBoundaries.length > 0 ||
    profileChanges.allowedMoves.length > 0 ||
    profileChanges.bannedMoves.length > 0 ||
    profileChanges.rewriteRubric.length > 0 ||
    proposal.changes.vocabulary.accept.length > 0 ||
    proposal.changes.vocabulary.reject.length > 0 ||
    proposal.changes.rules.length > 0
  );
}

async function createValidationRepo(
  repoRoot: string,
  proposal: VoiceUpdateProposal,
): Promise<string> {
  const paths = getVoicePaths(repoRoot);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "wetzler-validate-"));
  await mkdir(path.join(tempRoot, "voice"), { recursive: true });
  await cp(paths.valeConfigPath, path.join(tempRoot, ".vale.ini"));
  await cp(paths.stylesPath, path.join(tempRoot, "styles"), {
    recursive: true,
  });
  const profile = await loadVoiceProfile(repoRoot);
  await writeFile(
    path.join(tempRoot, "voice", "profile.yml"),
    stringify(applyProfileChanges(profile, proposal.changes.profile)),
    "utf8",
  );
  await writeValeRules(
    path.join(tempRoot, "styles", "voice"),
    proposal.changes.rules,
  );
  return tempRoot;
}

async function applyAtomicWrites(writes: PlannedWrite[]): Promise<void> {
  const preparedWrites: PreparedWrite[] = [];
  try {
    for (const write of writes) {
      await mkdir(path.dirname(write.filePath), { recursive: true });
      const previousContents = await readFile(write.filePath, "utf8").catch(
        () => null,
      );
      const tempPath = `${write.filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tempPath, write.contents, "utf8");
      preparedWrites.push({ ...write, tempPath, previousContents });
    }

    for (const write of preparedWrites) {
      await rename(write.tempPath, write.filePath);
    }
  } catch (error) {
    await rollbackWrites(preparedWrites);
    throw error;
  } finally {
    await Promise.all(
      preparedWrites.map((write) =>
        unlink(write.tempPath).catch(() => undefined),
      ),
    );
  }
}

async function rollbackWrites(writes: PreparedWrite[]): Promise<void> {
  await Promise.all(
    writes.map(async (write) => {
      if (write.previousContents === null) {
        await unlink(write.filePath).catch(() => undefined);
        return;
      }
      await writeFile(write.filePath, write.previousContents, "utf8").catch(
        () => undefined,
      );
    }),
  );
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : Math.round(sum(values) / values.length);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function withoutExisting(existing: string[], additions: string[]): string[] {
  const existingKeys = new Set(
    existing.map((value) => value.trim().toLowerCase()),
  );
  return additions.filter(
    (value) => !existingKeys.has(value.trim().toLowerCase()),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeUnique(existing: string[], additions: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const value of [...existing, ...additions]) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      merged.push(trimmed);
    }
  }
  return merged;
}

function emptyProfileChanges(): ProfileProposalChanges {
  return {
    principles: [],
    toneBoundaries: [],
    allowedMoves: [],
    bannedMoves: [],
    rewriteRubric: [],
  };
}

function emptyVocabularyChanges(): VocabularyProposalChanges {
  return {
    accept: [],
    reject: [],
  };
}
