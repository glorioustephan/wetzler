---
title: Project Layout
description: A map of the Wetzler repository and the files users are most likely to change.
---

# Project Layout

Wetzler keeps the voice, rules, CLI, MCP server, plugins, and docs in one workspace.

```text
wetzler/
  .github/workflows/
  .agents/plugins/
  docs/
  extensions/claude-desktop/
  packages/
    cli/
    core/
    mcp-server/
  plugins/
    claude-code/
    codex/
  samples/
  scripts/
  styles/
  voice/
```

## User-Facing Files

| Path | Purpose |
| --- | --- |
| `README.md` | Short project overview and command list. |
| `docs/` | VitePress documentation site. |
| `cover-image-optimized.png` | Cover image used by README and docs. |
| `samples/` | Example source samples that can be imported with `wetzler samples add`. |
| `voice/profile.yml` | Durable voice profile. |
| `voice/samples/` | Stored voice samples. |
| `voice/proposals/` | Voice update proposals. |
| `styles/voice/` | Vale rules. |
| `styles/config/vocabularies/voice/` | Accepted and rejected vocabulary. |

## Packages

| Package | Role |
| --- | --- |
| `@wetzler/core` | Shared APIs for paths, profile loading, Vale linting, revision packets, samples, proposals, and schemas. |
| `@wetzler/cli` | Command-line interface and MCP process entry point. |
| `@wetzler/mcp-server` | MCP tool, resource, and prompt definitions. |

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm build` | Compile all packages. |
| `pnpm test` | Run behavior tests across packages. |
| `pnpm typecheck` | Build, then run strict TypeScript checks. |
| `pnpm validate:mcpb` | Build and validate the MCPB package, then smoke-test it. |
| `pnpm pack:mcpb` | Produce a platform-specific `.mcpb` package. |
| `pnpm validate:codex-plugin` | Validate the repo-local Codex plugin. |
| `pnpm docs:dev` | Start the VitePress dev server. |
| `pnpm docs:build` | Build the docs site. |
| `pnpm docs:preview` | Preview the built docs site. |

## Deployment

The docs deployment workflow lives at:

```text
.github/workflows/pages.yml
```

It installs dependencies with pnpm, builds the VitePress site, uploads `docs/.vitepress/dist`, and deploys it with GitHub Pages.

The main CI workflow lives at:

```text
.github/workflows/ci.yml
```

It runs tests, type checks, MCPB validation, Codex plugin validation, and production dependency audit.
