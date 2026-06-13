import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { getVoicePaths, resolveRepoRoot } from "./paths.js";
import type {
  ValeAlert,
  ValeLintResult,
  ValeRuntimeError,
  ValeSeverity,
  ValeSummary
} from "./types.js";

type RunValeInput = {
  markdown?: string;
  filePath?: string;
  repoRoot?: string;
  timeoutMs?: number;
  maxOutputChars?: number;
};

type ProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
};

const severityValues = new Set<ValeSeverity>(["suggestion", "warning", "error"]);
const defaultTimeoutMs = 15_000;
const defaultMaxOutputChars = 1_000_000;
const killGraceMs = 2_000;

export async function lintMarkdown(input: RunValeInput): Promise<ValeLintResult> {
  const repoRoot = input.repoRoot ?? resolveRepoRoot();
  const paths = getVoicePaths(repoRoot);
  const targetPath = input.filePath ?? "stdin.md";
  const args = [
    "--output=JSON",
    "--no-exit",
    "--no-global",
    "--config",
    paths.valeConfigPath
  ];

  if (input.markdown !== undefined) {
    args.push("--ext=.md", "--path", targetPath);
  } else if (input.filePath) {
    args.push(input.filePath);
  } else {
    throw new Error("lintMarkdown requires either markdown or filePath.");
  }

  const processOptions: { cwd: string; stdin?: string; timeoutMs: number; maxOutputChars: number } = {
    cwd: repoRoot,
    timeoutMs: input.timeoutMs ?? defaultTimeoutMs,
    maxOutputChars: input.maxOutputChars ?? defaultMaxOutputChars
  };
  if (input.markdown !== undefined) {
    processOptions.stdin = input.markdown;
  }

  const result = await runProcess(resolveValeBinary(), args, processOptions);
  const alerts = parseValeJson(result.stdout);
  const runtimeError = readValeRuntimeError(result);

  return {
    alerts,
    summary: summarizeAlerts(alerts),
    exitCode: result.exitCode,
    stderr: result.stderr,
    runtimeError
  };
}

export function parseValeJson(stdout: string): ValeAlert[] {
  if (!stdout.trim()) {
    return [];
  }

  const parsed: unknown = JSON.parse(stdout);
  if (!isRecord(parsed)) {
    return [];
  }

  const alerts: ValeAlert[] = [];
  for (const [file, rawAlerts] of Object.entries(parsed)) {
    if (!Array.isArray(rawAlerts)) {
      continue;
    }

    for (const rawAlert of rawAlerts) {
      if (!isRecord(rawAlert)) {
        continue;
      }
      alerts.push(normalizeAlert(file, rawAlert));
    }
  }

  return alerts;
}

export function summarizeAlerts(alerts: ValeAlert[]): ValeSummary {
  const bySeverity: Record<ValeSeverity, number> = {
    suggestion: 0,
    warning: 0,
    error: 0
  };
  const byCheck: Record<string, number> = {};

  for (const alert of alerts) {
    bySeverity[alert.severity] += 1;
    byCheck[alert.check] = (byCheck[alert.check] ?? 0) + 1;
  }

  return {
    alertCount: alerts.length,
    bySeverity,
    byCheck
  };
}

function normalizeAlert(file: string, rawAlert: Record<string, unknown>): ValeAlert {
  const severity = readString(rawAlert, "Severity", "severity");
  const normalizedSeverity = severityValues.has(severity as ValeSeverity)
    ? (severity as ValeSeverity)
    : "warning";
  const span = readSpan(rawAlert);

  const alert: ValeAlert = {
    file,
    line: readNumber(rawAlert, 1, "Line", "line"),
    column: span?.[0] ?? readNumber(rawAlert, 1, "Column", "column", "StartColumn"),
    check: readString(rawAlert, "Check", "check") || "Unknown",
    severity: normalizedSeverity,
    message: readString(rawAlert, "Message", "message"),
    raw: rawAlert
  };
  if (span?.[1] !== undefined) {
    alert.endColumn = span[1];
  }
  const match = readOptionalString(rawAlert, "Match", "match");
  if (match !== undefined) {
    alert.match = match;
  }
  const link = readOptionalString(rawAlert, "Link", "link");
  if (link !== undefined) {
    alert.link = link;
  }
  return alert;
}

function resolveValeBinary(): string {
  if (process.env.WRITING_VOICE_VALE_BIN) {
    return process.env.WRITING_VOICE_VALE_BIN;
  }

  const require = createRequire(import.meta.url);
  const packageJsonPath = require.resolve("@vvago/vale/package.json");
  const packageRoot = path.dirname(packageJsonPath);
  const candidates = [
    path.join(packageRoot, "bin", "vale"),
    path.join(packageRoot, "bin", "vale.exe")
  ];
  const binaryPath = candidates.find((candidate) => existsSync(candidate));
  if (!binaryPath) {
    throw new Error("Unable to find @vvago/vale binary.");
  }
  return binaryPath;
}

function runProcess(
  command: string,
  args: string[],
  options: { cwd: string; stdin?: string; timeoutMs: number; maxOutputChars: number }
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let killTimeout: NodeJS.Timeout | undefined;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimeout = setTimeout(() => {
        child.kill("SIGKILL");
      }, killGraceMs);
    }, options.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = appendCapped(stdout, chunk, options.maxOutputChars);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = appendCapped(stderr, chunk, options.maxOutputChars);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      clearTimeout(killTimeout);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      clearTimeout(killTimeout);
      resolve({
        stdout,
        stderr,
        exitCode: timedOut ? 2 : exitCode ?? 0,
        timedOut
      });
    });

    if (options.stdin !== undefined) {
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
    }
  });
}

function readValeRuntimeError(result: ProcessResult): ValeRuntimeError | null {
  if (result.exitCode === 0) {
    return null;
  }
  if (result.timedOut) {
    return {
      code: "TIMEOUT",
      message: "Vale timed out before returning a result.",
      raw: null
    };
  }

  const stderr = result.stderr.trim();
  if (!stderr) {
    return {
      code: null,
      message: `Vale exited with code ${result.exitCode}.`,
      raw: null
    };
  }

  const parsed: unknown = safeJsonParse(stderr);
  if (isRecord(parsed)) {
    return {
      code: readOptionalString(parsed, "Code", "code") ?? null,
      message: readString(parsed, "Text", "text", "Message", "message") || stderr,
      raw: parsed
    };
  }

  return {
    code: null,
    message: stderr,
    raw: stderr
  };
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function appendCapped(existing: string, chunk: string, maxChars: number): string {
  if (existing.length >= maxChars) {
    return existing;
  }
  const next = existing + chunk;
  return next.length <= maxChars ? next : next.slice(0, maxChars);
}

function readSpan(rawAlert: Record<string, unknown>): [number, number] | undefined {
  const span = rawAlert.Span ?? rawAlert.span;
  if (!Array.isArray(span) || span.length < 2) {
    return undefined;
  }
  const start = Number(span[0]);
  const end = Number(span[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return undefined;
  }
  return [start, end];
}

function readNumber(rawAlert: Record<string, unknown>, fallback: number, ...keys: string[]): number {
  for (const key of keys) {
    const value = rawAlert[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return fallback;
}

function readString(rawAlert: Record<string, unknown>, ...keys: string[]): string {
  return readOptionalString(rawAlert, ...keys) ?? "";
}

function readOptionalString(rawAlert: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = rawAlert[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
