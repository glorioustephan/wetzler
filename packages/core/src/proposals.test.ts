import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { addVoiceSample } from "./samples.js";
import {
  acceptVoiceUpdateProposal,
  createVoiceUpdateProposal,
  validateVoiceUpdateProposal,
} from "./proposals.js";
import type { VoiceUpdateProposal } from "./types.js";

describe("voice learning proposals", () => {
  it("adds samples, creates review-gated proposals, and applies accepted changes", async () => {
    const repoRoot = await createTempVoiceRepo();
    const sourcePath = path.join(repoRoot, "incoming.md");
    await writeFile(
      sourcePath,
      "# Sample\n\nThis has a clear, human pulse.\n",
      "utf8",
    );

    const sample = await addVoiceSample({
      sourcePath,
      label: "Launch note",
      weight: 2,
      repoRoot,
    });
    expect(sample.label).toBe("Launch note");

    const proposal = await createVoiceUpdateProposal({
      sampleGlobs: ["voice/samples/*.md"],
      rationale: "capture launch-note rhythm",
      repoRoot,
    });
    expect(proposal.changes.profile.allowedMoves.length).toBeGreaterThan(0);
    const proposalPath = path.join(
      repoRoot,
      "voice",
      "proposals",
      `${proposal.id}.yml`,
    );
    const editableProposal = parse(
      await readFile(proposalPath, "utf8"),
    ) as VoiceUpdateProposal;
    editableProposal.changes.profile.allowedMoves.push(
      "Keep useful warmth without sanding off the point.",
    );
    editableProposal.changes.vocabulary.accept.push("LaunchNote");
    editableProposal.changes.rules.push({
      filename: "launch-note.yml",
      contents:
        'extends: existence\nmessage: "Launch note test rule."\nlevel: suggestion\ntokens:\n  - placeholder\n',
    });
    await writeFile(proposalPath, stringify(editableProposal), "utf8");

    await expect(
      validateVoiceUpdateProposal(proposal.id, repoRoot),
    ).resolves.toMatchObject({
      ok: true,
    });
    const accepted = await acceptVoiceUpdateProposal(proposal.id, repoRoot);
    const profile = await readFile(
      path.join(repoRoot, "voice", "profile.yml"),
      "utf8",
    );
    const acceptVocab = await readFile(
      path.join(
        repoRoot,
        "styles",
        "config",
        "vocabularies",
        "voice",
        "accept.txt",
      ),
      "utf8",
    );
    const rule = await readFile(
      path.join(repoRoot, "styles", "voice", "launch-note.yml"),
      "utf8",
    );

    expect(accepted.status).toBe("accepted");
    expect(profile).toContain(
      "Keep useful warmth without sanding off the point.",
    );
    expect(acceptVocab).toContain("LaunchNote");
    expect(rule).toContain("Launch note test rule.");
  });

  it("rejects invalid Vale rule proposals before applying them", async () => {
    const repoRoot = await createTempVoiceRepo();
    const sourcePath = path.join(repoRoot, "incoming.md");
    await writeFile(
      sourcePath,
      "# Sample\n\nThis has a clear, human pulse.\n",
      "utf8",
    );

    const proposal = await createVoiceUpdateProposal({
      sampleGlobs: ["incoming.md"],
      rationale: "bad rule",
      repoRoot,
    });
    const proposalPath = path.join(
      repoRoot,
      "voice",
      "proposals",
      `${proposal.id}.yml`,
    );
    const editableProposal = parse(
      await readFile(proposalPath, "utf8"),
    ) as VoiceUpdateProposal;
    editableProposal.changes.rules.push({
      filename: "broken.yml",
      contents: "message: Missing extends\n",
    });
    await writeFile(proposalPath, stringify(editableProposal), "utf8");

    await expect(
      validateVoiceUpdateProposal(proposal.id, repoRoot),
    ).resolves.toMatchObject({
      ok: false,
    });
    await expect(
      acceptVoiceUpdateProposal(proposal.id, repoRoot),
    ).rejects.toThrow("failed validation");
  });
});

async function createTempVoiceRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "wetzler-"));
  await mkdir(path.join(repoRoot, "voice", "samples"), { recursive: true });
  await mkdir(path.join(repoRoot, "voice", "proposals"), { recursive: true });
  await mkdir(path.join(repoRoot, "styles", "voice"), { recursive: true });
  await mkdir(
    path.join(repoRoot, "styles", "config", "vocabularies", "voice"),
    {
      recursive: true,
    },
  );
  await writeFile(
    path.join(repoRoot, ".vale.ini"),
    "StylesPath = styles\nMinAlertLevel = suggestion\nVocab = voice\n\n[*.md]\nBasedOnStyles = voice\n",
    "utf8",
  );
  await writeFile(
    path.join(repoRoot, "voice", "profile.yml"),
    stringify({
      version: 1,
      name: "Writing Voice",
      summary: "Test profile",
      principles: ["Lead with the point."],
      toneBoundaries: ["Warm, not syrupy."],
      allowedMoves: ["Use short paragraphs."],
      bannedMoves: ["Do not invent evidence."],
      rewriteRubric: ["Preserve meaning."],
    }),
    "utf8",
  );
  await writeFile(
    path.join(
      repoRoot,
      "styles",
      "config",
      "vocabularies",
      "voice",
      "accept.txt",
    ),
    "Codex\n",
    "utf8",
  );
  await writeFile(
    path.join(
      repoRoot,
      "styles",
      "config",
      "vocabularies",
      "voice",
      "reject.txt",
    ),
    "utilize\n",
    "utf8",
  );
  return repoRoot;
}
