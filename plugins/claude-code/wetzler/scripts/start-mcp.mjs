#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const pluginScriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(pluginScriptPath), "../../../..");
const cliPath = path.join(repoRoot, "packages", "cli", "dist", "index.js");

const child = spawn(process.execPath, [cliPath, "mcp"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    WRITING_VOICE_ROOT: repoRoot
  },
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
