---
title: Installation
description: Install and package Wetzler for CLI use, Codex, Claude Code, Claude Desktop, and MCPB-aware clients.
---

# Installation

Wetzler can be used in several ways. Start with the source checkout, then choose the surface that matches how you write.

## Choose the Right Path

| If you want to... | Use this |
| --- | --- |
| Try Wetzler from a terminal | Install from source and run `pnpm wetzler`. |
| Use Wetzler inside Codex | Build the repo, then use the repo-local Codex plugin. |
| Use Wetzler inside Claude Code | Build the repo, then point Claude Code at the Claude Code wrapper. |
| Install a packaged extension in Claude Desktop | Build an MCPB bundle with `pnpm pack:mcpb`. |
| Wire Wetzler into another local agent | Start the MCP server directly or use the wrapper pattern. |

All paths start the same way: install dependencies and run `pnpm build`. That creates the CLI and MCP server files the integrations call.

## Install From Source

```bash
git clone https://github.com/glorioustephan/wetzler.git
cd wetzler
pnpm install
pnpm build
```

After the build, run the CLI through the root package script:

```bash
pnpm wetzler lint README.md --json
pnpm wetzler prepare README.md --goal "revise this without losing evidence"
```

If you want a shell alias while developing locally:

```bash
alias wetzler="node /path/to/wetzler/packages/cli/dist/index.js"
```

## Install for Codex

The repository includes a repo-local Codex plugin at:

```text
plugins/codex/wetzler
```

The local marketplace entry is:

```text
.agents/plugins/marketplace.json
```

The Codex plugin starts the MCP server through:

```text
plugins/codex/wetzler/scripts/start-mcp.mjs
```

That launcher sets `WRITING_VOICE_ROOT` to the repository root and runs:

```bash
node packages/cli/dist/index.js mcp
```

Before installing or running the plugin, build the packages:

```bash
pnpm build
```

Then validate the plugin wrapper:

```bash
pnpm validate:codex-plugin
```

Use the `rewrite-in-voice` skill when you want the agent to prepare a revision packet, rewrite the Markdown, lint the result, and return paste-ready Markdown.

Plainly: Codex talks to Wetzler, Wetzler prepares the voice guidance, and Codex performs the edit.

## Install for Claude Code

The repository also includes a Claude Code wrapper at:

```text
plugins/claude-code/wetzler
```

It uses the same local MCP launcher pattern as the Codex plugin:

```json
{
  "mcpServers": {
    "wetzler": {
      "command": "node",
      "args": ["./scripts/start-mcp.mjs"]
    }
  }
}
```

Build first, then point Claude Code at the plugin folder according to your local Claude Code plugin workflow.

```bash
pnpm build
```

## Package an MCPB Bundle

Use MCPB when you want a packaged extension for Claude Desktop or another MCPB-aware client. This is the "installable package" path, not the day-to-day source checkout path.

```bash
pnpm validate:mcpb
pnpm pack:mcpb
```

The package is written under `dist`:

```text
dist/wetzler-<platform>-<arch>.mcpb
```

MCPB bundles are platform-specific because the package includes the native Vale binary from the build machine. Build one bundle per target platform and architecture.

## Start the MCP Server Directly

Use this when another MCP host lets you define a command manually.

```bash
cd /path/to/wetzler
pnpm build
WRITING_VOICE_ROOT=/path/to/wetzler node packages/cli/dist/index.js mcp
```

The server communicates over stdio. That means the client sends messages through the process input and output streams instead of through a web URL.

## Verify an Installation

Use these checks after setup:

| Check        | Command                              | Expected result                                           |
| ------------ | ------------------------------------ | --------------------------------------------------------- |
| Build        | `pnpm build`                         | All workspace packages compile.                           |
| Tests        | `pnpm test`                          | Vitest suites pass.                                       |
| CLI          | `pnpm wetzler lint README.md --json` | JSON result with alerts or an empty alert list.           |
| MCPB         | `pnpm validate:mcpb`                 | Bundle builds, validates, and smoke-tests initialization. |
| Codex plugin | `pnpm validate:codex-plugin`         | Plugin manifest and launcher validate.                    |
