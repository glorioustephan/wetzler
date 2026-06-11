import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const pluginRoot = path.join(repoRoot, "plugins", "codex", "wetzler");
const marketplacePath = path.join(
  repoRoot,
  ".agents",
  "plugins",
  "marketplace.json",
);
const pyDepsPath = path.join(os.tmpdir(), "wetzler-pydeps");
const validatorPath =
  process.env.CODEX_PLUGIN_VALIDATOR ??
  path.join(
    os.homedir(),
    ".codex",
    "skills",
    ".system",
    "plugin-creator",
    "scripts",
    "validate_plugin.py",
  );

type JsonRecord = Record<string, unknown>;

if (existsSync(validatorPath)) {
  await runOfficialValidator();
} else {
  await runLocalValidator();
}
await smokePluginLauncher();

async function runOfficialValidator(): Promise<void> {
  await execFileAsync(
    "python3",
    [
      "-m",
      "pip",
      "install",
      "--quiet",
      "--upgrade",
      "--target",
      pyDepsPath,
      "PyYAML",
    ],
    {
      cwd: repoRoot,
      maxBuffer: 10_000_000,
    },
  );

  const { stdout, stderr } = await execFileAsync(
    "python3",
    [validatorPath, pluginRoot],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PYTHONPATH: pyDepsPath,
      },
      maxBuffer: 10_000_000,
    },
  );

  if (stdout) {
    process.stdout.write(stdout);
  }
  if (stderr) {
    process.stderr.write(stderr);
  }
}

async function runLocalValidator(): Promise<void> {
  const errors: string[] = [];
  const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");

  const manifest = await readJsonObject(
    manifestPath,
    "plugin manifest",
    errors,
  );
  if (manifest) {
    await validateManifest(manifest, errors);
  }

  if (existsSync(marketplacePath) && manifest) {
    const marketplace = await readJsonObject(
      marketplacePath,
      "marketplace manifest",
      errors,
    );
    if (marketplace) {
      validateMarketplace(
        marketplace,
        requireString(manifest, "name", "plugin manifest", errors),
        errors,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Codex plugin validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }

  console.log("Codex plugin validation passed with local fallback.");
}

async function smokePluginLauncher(): Promise<void> {
  const result = await runProcess(
    process.execPath,
    [path.join(pluginRoot, "scripts", "start-mcp.mjs")],
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "wetzler-plugin-validator",
          version: "0.1.0",
        },
      },
    }) + "\n",
    pluginRoot,
  );

  if (result.exitCode !== 0) {
    throw new Error(
      `Plugin launcher exited with ${result.exitCode}.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }

  const firstLine = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    throw new Error(
      "Plugin launcher did not return an MCP initialize response.",
    );
  }
  if (!firstLine.startsWith("{")) {
    throw new Error(
      `Plugin launcher wrote non-JSON stdout before MCP response: ${firstLine}`,
    );
  }

  const response: unknown = JSON.parse(firstLine);
  if (
    !isRecord(response) ||
    !isRecord(response.result) ||
    !isRecord(response.result.serverInfo) ||
    response.result.serverInfo.name !== "wetzler"
  ) {
    throw new Error(
      `Unexpected plugin launcher initialize response: ${firstLine}`,
    );
  }

  console.log("Codex plugin launcher smoke test passed.");
}

function runProcess(
  command: string,
  args: string[],
  stdin: string,
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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

async function readJsonObject(
  filePath: string,
  label: string,
  errors: string[],
): Promise<JsonRecord | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
    if (!isRecord(parsed)) {
      errors.push(`${label} must be a JSON object.`);
      return null;
    }
    return parsed;
  } catch (error) {
    errors.push(`${label} could not be read: ${getErrorMessage(error)}`);
    return null;
  }
}

async function validateManifest(
  manifest: JsonRecord,
  errors: string[],
): Promise<void> {
  const pluginName = requireString(manifest, "name", "plugin manifest", errors);
  if (pluginName && pluginName !== path.basename(pluginRoot)) {
    errors.push(
      `plugin manifest name must match plugin folder name "${path.basename(pluginRoot)}".`,
    );
  }

  requireString(manifest, "version", "plugin manifest", errors);
  requireString(manifest, "description", "plugin manifest", errors);

  const author = requireRecord(manifest, "author", "plugin manifest", errors);
  if (author) {
    requireString(author, "name", "plugin manifest author", errors);
  }

  const pluginInterface = requireRecord(
    manifest,
    "interface",
    "plugin manifest",
    errors,
  );
  if (pluginInterface) {
    for (const key of [
      "displayName",
      "shortDescription",
      "longDescription",
      "developerName",
      "category",
    ]) {
      requireString(pluginInterface, key, "plugin manifest interface", errors);
    }
    requireStringArray(
      pluginInterface,
      "capabilities",
      "plugin manifest interface",
      errors,
    );
    requireStringArray(
      pluginInterface,
      "defaultPrompt",
      "plugin manifest interface",
      errors,
    );
    const brandColor = pluginInterface.brandColor;
    if (brandColor !== undefined && typeof brandColor !== "string") {
      errors.push(
        "plugin manifest interface.brandColor must be a string when present.",
      );
    }
  }

  const serialized = JSON.stringify(manifest);
  if (serialized.includes("[TODO:")) {
    errors.push("plugin manifest must not contain [TODO: ...] placeholders.");
  }

  validateRelativePathField(
    manifest,
    "skills",
    pluginRoot,
    "plugin manifest skills",
    errors,
  );
  const mcpPath = validateRelativePathField(
    manifest,
    "mcpServers",
    pluginRoot,
    "plugin manifest mcpServers",
    errors,
  );
  if (mcpPath) {
    await validateMcpConfig(mcpPath, errors).catch((error: unknown) => {
      errors.push(
        `MCP config could not be validated: ${getErrorMessage(error)}`,
      );
    });
  }
}

async function validateMcpConfig(
  filePath: string,
  errors: string[],
): Promise<void> {
  const mcpConfig = await readJsonObject(filePath, "MCP config", errors);
  if (!mcpConfig) {
    return;
  }

  const servers = requireRecord(mcpConfig, "mcpServers", "MCP config", errors);
  if (!servers) {
    return;
  }

  const serverNames = Object.keys(servers);
  if (serverNames.length === 0) {
    errors.push("MCP config must define at least one server.");
    return;
  }

  for (const serverName of serverNames) {
    const server = servers[serverName];
    if (!isRecord(server)) {
      errors.push(`MCP config server "${serverName}" must be an object.`);
      continue;
    }
    requireString(
      server,
      "command",
      `MCP config server "${serverName}"`,
      errors,
    );
    requireStringArray(
      server,
      "args",
      `MCP config server "${serverName}"`,
      errors,
    );
  }
}

function validateMarketplace(
  marketplace: JsonRecord,
  pluginName: string,
  errors: string[],
): void {
  const entries = marketplace.plugins;
  if (!Array.isArray(entries)) {
    errors.push("marketplace manifest plugins must be an array.");
    return;
  }

  const entry = entries.find((value: unknown): value is JsonRecord => {
    return isRecord(value) && value.name === pluginName;
  });
  if (!entry) {
    errors.push(
      `marketplace manifest must include an entry for "${pluginName}".`,
    );
    return;
  }

  const source = requireRecord(entry, "source", "marketplace entry", errors);
  if (source) {
    const sourceType = requireString(
      source,
      "source",
      "marketplace entry source",
      errors,
    );
    if (sourceType && sourceType !== "local") {
      errors.push('marketplace entry source.source must be "local".');
    }

    const sourcePath = requireString(
      source,
      "path",
      "marketplace entry source",
      errors,
    );
    if (sourcePath) {
      validateRelativeExistingPath(
        sourcePath,
        repoRoot,
        "marketplace entry source.path",
        errors,
      );
    }
  }

  const policy = requireRecord(entry, "policy", "marketplace entry", errors);
  if (policy) {
    const installation = requireString(
      policy,
      "installation",
      "marketplace entry policy",
      errors,
    );
    if (
      installation &&
      !["NOT_AVAILABLE", "AVAILABLE", "INSTALLED_BY_DEFAULT"].includes(
        installation,
      )
    ) {
      errors.push(
        "marketplace entry policy.installation has an unsupported value.",
      );
    }

    const authentication = requireString(
      policy,
      "authentication",
      "marketplace entry policy",
      errors,
    );
    if (authentication && !["ON_INSTALL", "ON_USE"].includes(authentication)) {
      errors.push(
        "marketplace entry policy.authentication has an unsupported value.",
      );
    }
  }

  requireString(entry, "category", "marketplace entry", errors);
}

function validateRelativePathField(
  record: JsonRecord,
  key: string,
  root: string,
  label: string,
  errors: string[],
): string | null {
  const value = record[key];
  if (value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    errors.push(`${label} must be a string.`);
    return null;
  }
  return validateRelativeExistingPath(value, root, label, errors);
}

function validateRelativeExistingPath(
  value: string,
  root: string,
  label: string,
  errors: string[],
): string | null {
  if (!value.startsWith("./") || path.isAbsolute(value)) {
    errors.push(`${label} must be a relative path beginning with "./".`);
    return null;
  }

  const resolvedPath = path.resolve(root, value);
  const relativePath = path.relative(root, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    errors.push(`${label} must stay inside ${root}.`);
    return null;
  }

  if (!existsSync(resolvedPath)) {
    errors.push(`${label} does not exist at ${resolvedPath}.`);
    return null;
  }

  return resolvedPath;
}

function requireRecord(
  record: JsonRecord,
  key: string,
  label: string,
  errors: string[],
): JsonRecord | null {
  const value = record[key];
  if (!isRecord(value)) {
    errors.push(`${label}.${key} must be an object.`);
    return null;
  }
  return value;
}

function requireString(
  record: JsonRecord,
  key: string,
  label: string,
  errors: string[],
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${label}.${key} must be a non-empty string.`);
    return "";
  }
  return value;
}

function requireStringArray(
  record: JsonRecord,
  key: string,
  label: string,
  errors: string[],
): void {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${label}.${key} must be an array of strings.`);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
