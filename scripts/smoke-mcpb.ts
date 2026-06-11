import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const serverPath = path.join(repoRoot, "dist", "mcpb", "server", "index.js");
const bundledRepoRoot = path.join(repoRoot, "dist", "mcpb", "repo");

const initializeRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "wetzler-smoke",
      version: "0.1.0",
    },
  },
};

const result = await runMcpServer(JSON.stringify(initializeRequest) + "\n");
if (result.exitCode !== 0) {
  throw new Error(
    `MCPB server exited with ${result.exitCode}.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
}

const response = parseResponse(result.stdout);
const serverInfo = readServerInfo(response);
if (serverInfo.name !== "wetzler") {
  throw new Error(`Expected wetzler server, got ${serverInfo.name}.`);
}

console.log(
  `MCPB smoke test passed for ${serverInfo.name} ${serverInfo.version}.`,
);

function runMcpServer(stdin: string): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [serverPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        WRITING_VOICE_ROOT: bundledRepoRoot,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? 0,
      });
    });
    child.stdin.end(stdin);
  });
}

function parseResponse(stdout: string): unknown {
  const jsonLine = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!jsonLine) {
    throw new Error("MCPB server did not return a response.");
  }
  return JSON.parse(jsonLine);
}

function readServerInfo(response: unknown): { name: string; version: string } {
  if (
    !isRecord(response) ||
    !isRecord(response.result) ||
    !isRecord(response.result.serverInfo)
  ) {
    throw new Error(
      `Unexpected MCPB initialize response: ${JSON.stringify(response)}`,
    );
  }
  const { name, version } = response.result.serverInfo;
  if (typeof name !== "string" || typeof version !== "string") {
    throw new Error(
      `Unexpected MCPB serverInfo: ${JSON.stringify(response.result.serverInfo)}`,
    );
  }
  return { name, version };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
