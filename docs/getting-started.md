---
title: Getting Started
description: Install Wetzler from the source checkout, build it, and run the first Markdown revision workflow.
---

# Getting Started

This guide takes you from a fresh checkout to your first Wetzler result. You do not need to understand the whole system first. The short version is:

1. Install and build the project.
2. Run `lint` to see what Wetzler notices.
3. Run `prepare` to create instructions an AI assistant can use for a rewrite.

Wetzler is designed around a source checkout: clone it, install dependencies, build the packages, then run the CLI or connect an agent host.

## Useful Words

| Word | Plain meaning |
| --- | --- |
| Markdown | A text file format used for docs, notes, README files, and many websites. |
| Vale | The rule checker Wetzler uses. It finds patterns like filler, hype, long sentences, or rejected words. |
| Lint | Check the writing and report findings. It does not rewrite the text. |
| Revision packet | The bundle Wetzler gives an AI assistant: the draft, voice profile, rule findings, and rewrite guardrails. |
| Agent | The AI assistant doing the rewrite, such as Codex or Claude. |
| MCP | A local connection that lets an agent call Wetzler tools directly. Most users do not need to run MCP by hand. |

## Requirements

| Requirement | Version             | Why it matters                                                                            |
| ----------- | ------------------- | ----------------------------------------------------------------------------------------- |
| Node.js     | `>=22.0.0`          | The CLI, MCP server, package scripts, and MCPB build scripts run on Node.                 |
| pnpm        | `>=11.0.0`          | The workspace and lockfile are managed with pnpm.                                         |
| Git         | Any current version | Voice samples and proposals are ordinary files, so version control is the review surface. |

Vale is installed through the `@vvago/vale` package. You do not need a separate global Vale install for the normal Wetzler workflow.

## Install the Checkout

```bash
git clone https://github.com/glorioustephan/wetzler.git
cd wetzler
pnpm install
pnpm build
```

The build compiles three packages:

- `@wetzler/core`, which owns paths, schemas, Vale execution, samples, proposals, and revision packets.
- `@wetzler/mcp-server`, which exposes Wetzler over MCP.
- `@wetzler/cli`, which provides the `wetzler` command.

## Run the First Check

Use `lint` when you want Wetzler to point out possible issues without changing anything.

```bash
pnpm wetzler lint README.md --json
```

The output is JSON. If there are no findings, `alerts` is an empty list. If there are findings, each alert tells you the file, line, rule, and message.

Use `prepare` when you want an agent to revise Markdown.

```bash
pnpm wetzler prepare README.md \
  --audience "technical collaborator" \
  --goal "make the project explanation clear and true"
```

`prepare` returns JSON. The packet includes:

- the original Markdown,
- the source path,
- the audience and goal,
- the loaded voice profile,
- Vale findings,
- a rewrite checklist,
- output instructions for the host agent.

You normally give this packet to the AI assistant. The packet tells the assistant what to protect, what to improve, and what rules were triggered.

## A Simple First Rewrite Prompt

After running `prepare`, ask your agent something like this:

```text
Use this Wetzler revision packet to revise the Markdown.
Keep the facts, links, headings, code, commands, and examples intact.
Return revised Markdown only.
```

## Check Text From Standard Input

Standard input is useful when an editor, script, or agent already has the Markdown in memory.

```bash
cat draft.md | pnpm wetzler lint --stdin --path draft.md --json
```

```bash
cat draft.md | pnpm wetzler prepare --stdin \
  --path draft.md \
  --audience "newsletter reader" \
  --goal "tighten the prose without changing the claims"
```

## How Wetzler Finds the Voice Root

Wetzler looks for a directory that contains both:

- `voice/profile.yml`
- `.vale.ini`

When you run the CLI inside this repository, root detection usually works on its own. When you run it from another directory, use either `--repo-root` or `WRITING_VOICE_ROOT`.

```bash
pnpm wetzler lint /path/to/draft.md --repo-root /path/to/wetzler
```

```bash
WRITING_VOICE_ROOT=/path/to/wetzler pnpm wetzler prepare /path/to/draft.md
```

## Build the Documentation Site

The docs are a VitePress site in `docs`.

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

For GitHub Pages, the site is built with base path `/wetzler/`. In repository settings, set **Pages -> Build and deployment -> Source** to **GitHub Actions**.
