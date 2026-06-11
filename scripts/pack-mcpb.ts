import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputFile = path.join(
  repoRoot,
  "dist",
  `wetzler-${process.platform}-${process.arch}.mcpb`,
);

await execFileAsync("pnpm", ["build:mcpb"], { cwd: repoRoot });
const { stdout, stderr } = await execFileAsync(
  "pnpm",
  ["exec", "mcpb", "pack", "dist/mcpb", outputFile],
  {
    cwd: repoRoot,
    maxBuffer: 10_000_000,
  },
);
if (stdout) {
  process.stdout.write(stdout);
}
if (stderr) {
  process.stderr.write(stderr);
}

console.log(`Packed MCPB at ${outputFile}`);
