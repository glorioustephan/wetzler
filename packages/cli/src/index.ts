#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import {
  acceptVoiceUpdateProposal,
  addVoiceSample,
  createVoiceUpdateProposal,
  lintMarkdown,
  prepareRevision,
  resolveRepoRootForPath,
  validateVoiceUpdateProposal,
} from "@wetzler/core";
import { startMcpServer } from "@wetzler/mcp-server";
import type { CreateProposalInput, RevisionRequest } from "@wetzler/core";

type LintOptions = {
  json?: boolean;
  stdin?: boolean;
  path?: string;
  repoRoot?: string;
  timeoutMs?: number;
};

type PrepareOptions = {
  stdin?: boolean;
  path?: string;
  audience?: string;
  goal?: string;
  repoRoot?: string;
  timeoutMs?: number;
};

const program = new Command();

program
  .name("wetzler")
  .description(
    "Vale-backed, agent-guided Markdown revision for a configured writing voice.",
  )
  .version("0.1.0");

program
  .command("lint")
  .argument("[target]", "Markdown file to lint")
  .option("--json", "Print structured JSON output")
  .option("--stdin", "Read Markdown from stdin")
  .option("--path <path>", "Logical path for stdin input", "draft.md")
  .option("--repo-root <path>", "Writing Voice repository root")
  .option(
    "--timeout-ms <ms>",
    "Vale timeout in milliseconds",
    parsePositiveNumber,
  )
  .action(async (target: string | undefined, options: LintOptions) => {
    const { filePath, repoRoot } = resolveSource(target, options, "lint");
    const lintInput: Parameters<typeof lintMarkdown>[0] = {
      filePath,
    };
    if (repoRoot !== undefined) {
      lintInput.repoRoot = repoRoot;
    }
    if (options.timeoutMs !== undefined) {
      lintInput.timeoutMs = options.timeoutMs;
    }
    const result = options.stdin
      ? await lintMarkdown({
          ...lintInput,
          markdown: await readStdin(),
        })
      : await lintMarkdown(lintInput);

    if (options.json) {
      printJson(result);
      if (result.runtimeError) {
        process.exitCode = result.exitCode || 1;
      }
      return;
    }

    if (result.runtimeError) {
      console.error(result.runtimeError.message);
      process.exitCode = result.exitCode || 1;
      return;
    }

    if (result.alerts.length === 0) {
      console.log("No voice alerts found.");
      return;
    }

    for (const alert of result.alerts) {
      console.log(
        `${alert.file}:${alert.line}:${alert.column} ${alert.severity} ${alert.check} ${alert.message}`,
      );
    }
  });

program
  .command("prepare")
  .argument("[target]", "Markdown file to prepare for revision")
  .option("--stdin", "Read Markdown from stdin")
  .option("--path <path>", "Logical path for stdin input", "draft.md")
  .option("--audience <audience>", "Intended audience")
  .option("--goal <goal>", "Revision goal")
  .option("--repo-root <path>", "Writing Voice repository root")
  .option(
    "--timeout-ms <ms>",
    "Vale timeout in milliseconds",
    parsePositiveNumber,
  )
  .action(async (target: string | undefined, options: PrepareOptions) => {
    const { filePath: sourcePath, repoRoot } = resolveSource(
      target,
      options,
      "prepare",
    );
    const markdown = options.stdin
      ? await readStdin()
      : await readFile(sourcePath, "utf8");
    const request: RevisionRequest = {
      markdown,
      sourcePath,
    };
    if (options.audience !== undefined) {
      request.audience = options.audience;
    }
    if (options.goal !== undefined) {
      request.goal = options.goal;
    }
    if (repoRoot !== undefined) {
      request.repoRoot = repoRoot;
    }
    if (options.timeoutMs !== undefined) {
      request.timeoutMs = options.timeoutMs;
    }
    const packet = await prepareRevision(request);
    if (packet.vale.runtimeError) {
      console.error(packet.vale.runtimeError.message);
      process.exitCode = packet.vale.exitCode || 1;
      return;
    }

    printJson(packet);
  });

const samples = program.command("samples").description("Manage voice samples.");
samples
  .command("add")
  .argument("<path>", "Markdown sample path")
  .requiredOption("--label <label>", "Human label for the sample")
  .option("--weight <weight>", "Sample weight", parsePositiveNumber, 1)
  .option("--repo-root <path>", "Writing Voice repository root")
  .action(
    async (
      samplePath: string,
      options: { label: string; weight: number; repoRoot?: string },
    ) => {
      printJson(
        await addVoiceSample({
          sourcePath: samplePath,
          label: options.label,
          weight: options.weight,
          repoRoot: options.repoRoot ?? resolveRepoRootForPath(samplePath),
        }),
      );
    },
  );

const learn = program
  .command("learn")
  .description("Create and accept review-gated voice updates.");
learn
  .command("propose")
  .requiredOption("--samples <glob...>", "Sample glob(s) to inspect")
  .option("--rationale <rationale>", "Reason for this proposal")
  .option("--repo-root <path>", "Writing Voice repository root")
  .action(
    async (options: {
      samples: string[];
      rationale?: string;
      repoRoot?: string;
    }) => {
      const input: CreateProposalInput = {
        sampleGlobs: options.samples,
      };
      if (options.rationale !== undefined) {
        input.rationale = options.rationale;
      }
      if (options.repoRoot !== undefined) {
        input.repoRoot = options.repoRoot;
      }
      printJson(await createVoiceUpdateProposal(input));
    },
  );

learn
  .command("validate")
  .argument("<proposal-id>", "Proposal id from voice/proposals")
  .option("--repo-root <path>", "Writing Voice repository root")
  .action(async (proposalId: string, options: { repoRoot?: string }) => {
    const validation = await validateVoiceUpdateProposal(
      proposalId,
      options.repoRoot,
    );
    printJson(validation);
    if (!validation.ok) {
      process.exitCode = 1;
    }
  });

learn
  .command("accept")
  .argument("<proposal-id>", "Proposal id from voice/proposals")
  .option("--repo-root <path>", "Writing Voice repository root")
  .action(async (proposalId: string, options: { repoRoot?: string }) => {
    printJson(await acceptVoiceUpdateProposal(proposalId, options.repoRoot));
  });

program
  .command("mcp")
  .description("Start the Writing Voice MCP server over stdio.")
  .action(async () => {
    await startMcpServer();
  });

const entryPoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;
if (entryPoint === import.meta.url) {
  program.parseAsync().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}

export function parsePositiveNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive number, got ${value}.`);
  }
  return parsed;
}

function requireTarget(
  target: string | undefined,
  commandName: string,
): string {
  if (!target) {
    throw new Error(
      `wetzler ${commandName} requires a file path unless --stdin is used.`,
    );
  }
  return target;
}

function resolveSource(
  target: string | undefined,
  options: { stdin?: boolean; path?: string; repoRoot?: string },
  commandName: string,
): { filePath: string; repoRoot: string | undefined } {
  const filePath = options.stdin
    ? (options.path ?? "draft.md")
    : requireTarget(target, commandName);
  const repoRoot =
    options.repoRoot ??
    (options.stdin ? undefined : resolveRepoRootForPath(filePath));
  return { filePath, repoRoot };
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
    process.stdin.on("error", reject);
  });
}
