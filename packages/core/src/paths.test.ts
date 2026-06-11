import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveRepoRoot, resolveRepoRootForPath } from "./paths.js";

describe("resolveRepoRootForPath", () => {
  it("finds the voice root from the target file path", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "wetzler-root-"));
    await mkdir(path.join(repoRoot, "voice"), { recursive: true });
    await mkdir(path.join(repoRoot, "docs", "nested"), { recursive: true });
    await writeFile(
      path.join(repoRoot, ".vale.ini"),
      "StylesPath = styles\n",
      "utf8",
    );
    await writeFile(
      path.join(repoRoot, "voice", "profile.yml"),
      "name: Test\n",
      "utf8",
    );
    const draftPath = path.join(repoRoot, "docs", "nested", "draft.md");
    await writeFile(draftPath, "# Draft\n", "utf8");

    expect(resolveRepoRootForPath(draftPath)).toBe(repoRoot);
  });
});

describe("resolveRepoRoot", () => {
  it("throws when no voice root can be found", async () => {
    const startPath = await mkdtemp(path.join(os.tmpdir(), "wetzler-no-root-"));

    expect(() => resolveRepoRoot(startPath)).toThrow(
      "Unable to find writing voice root",
    );
  });
});
