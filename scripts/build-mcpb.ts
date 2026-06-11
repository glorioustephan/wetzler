import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const require = createRequire(import.meta.url);
const outputRoot = path.join(repoRoot, "dist", "mcpb");
const serverOutfile = path.join(outputRoot, "server", "index.js");
const serverBanner = [
  "import { createRequire as __writingVoiceCreateRequire } from 'node:module';",
  "const require = __writingVoiceCreateRequire(import.meta.url);"
].join("");
const valePackageSource = path.dirname(require.resolve("@vvago/vale/package.json"));
const valePackageTarget = path.join(outputRoot, "node_modules", "@vvago", "vale");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(path.dirname(serverOutfile), { recursive: true });
await mkdir(path.dirname(valePackageTarget), { recursive: true });

await execFileAsync(
  "pnpm",
  [
    "exec",
    "esbuild",
    "packages/mcp-server/src/index.ts",
    "--bundle",
    "--platform=node",
    "--format=esm",
    "--target=node22",
    "--packages=bundle",
    "--external:@vvago/vale",
    `--banner:js=${serverBanner}`,
    `--outfile=${serverOutfile}`
  ],
  { cwd: repoRoot }
);

const manifest = JSON.parse(
  await readFile(path.join(repoRoot, "extensions", "claude-desktop", "manifest.json"), "utf8")
) as {
  compatibility?: {
    platforms?: string[];
    runtimes?: Record<string, string>;
  };
};
manifest.compatibility = {
  ...manifest.compatibility,
  platforms: [process.platform],
  runtimes: {
    ...manifest.compatibility?.runtimes,
    node: ">=22.0.0"
  }
};
await writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await cp(path.join(repoRoot, ".vale.ini"), path.join(outputRoot, "repo", ".vale.ini"));
await cp(path.join(repoRoot, "voice"), path.join(outputRoot, "repo", "voice"), {
  recursive: true
});
await cp(path.join(repoRoot, "styles"), path.join(outputRoot, "repo", "styles"), {
  recursive: true
});
await cp(valePackageSource, valePackageTarget, {
  recursive: true,
  dereference: true
});

console.log(`Built MCPB directory at ${outputRoot}`);
