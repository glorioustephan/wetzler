import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { lintMarkdown, parseValeJson, summarizeAlerts } from "./vale.js";

describe("parseValeJson", () => {
  it("normalizes Vale JSON alerts", () => {
    const alerts = parseValeJson(
      JSON.stringify({
        "draft.md": [
          {
            Check: "voice.filler",
            Line: 2,
            Span: [4, 8],
            Message: "This phrase may be padding.",
            Severity: "suggestion",
            Match: "very",
          },
        ],
      }),
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      file: "draft.md",
      line: 2,
      column: 4,
      endColumn: 8,
      check: "voice.filler",
      severity: "suggestion",
      match: "very",
    });
  });
});

describe("summarizeAlerts", () => {
  it("counts alert totals by severity and check", () => {
    const alerts = parseValeJson(
      JSON.stringify({
        "draft.md": [
          {
            Check: "voice.filler",
            Line: 1,
            Span: [1, 4],
            Message: "one",
            Severity: "suggestion",
          },
          {
            Check: "voice.hype",
            Line: 2,
            Span: [1, 4],
            Message: "two",
            Severity: "warning",
          },
        ],
      }),
    );

    expect(summarizeAlerts(alerts)).toEqual({
      alertCount: 2,
      bySeverity: {
        suggestion: 1,
        warning: 1,
        error: 0,
      },
      byCheck: {
        "voice.filler": 1,
        "voice.hype": 1,
      },
    });
  });
});

describe("lintMarkdown", () => {
  it("surfaces Vale runtime errors separately from clean lint results", async () => {
    const repoRoot = await mkdtemp(
      path.join(os.tmpdir(), "wetzler-missing-config-"),
    );

    const result = await lintMarkdown({
      markdown: "A small draft.",
      filePath: "draft.md",
      repoRoot,
    });

    expect(result.alerts).toEqual([]);
    expect(result.exitCode).toBe(2);
    expect(result.runtimeError?.message).toContain(".vale.ini");
  });
});
