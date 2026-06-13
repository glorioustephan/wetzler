---
title: CLI Reference
description: Complete reference for the Wetzler command-line interface.
---

# CLI Reference

The CLI entry point is `wetzler`. In the source checkout, run it through the root script:

```bash
pnpm wetzler <command>
```

After building, you can also run:

```bash
node packages/cli/dist/index.js <command>
```

## `wetzler lint`

Run Vale against Markdown.

```bash
pnpm wetzler lint [target] [options]
```

Options:

| Option | Description |
| --- | --- |
| `--json` | Print structured JSON. |
| `--stdin` | Read Markdown from standard input. |
| `--path <path>` | Logical path for standard input. Default: `draft.md`. |
| `--repo-root <path>` | Explicit Wetzler voice repository root. |
| `--timeout-ms <ms>` | Vale timeout in milliseconds. |

Examples:

```bash
pnpm wetzler lint README.md --json
```

```bash
cat draft.md | pnpm wetzler lint --stdin --path draft.md --json
```

Runtime errors, such as a missing `.vale.ini`, set a non-zero exit code. Normal lint findings are returned as results.

## `wetzler prepare`

Create a revision packet for a host agent.

```bash
pnpm wetzler prepare [target] [options]
```

Options:

| Option | Description |
| --- | --- |
| `--stdin` | Read Markdown from standard input. |
| `--path <path>` | Logical path for standard input. Default: `draft.md`. |
| `--audience <audience>` | Intended reader for the revision. |
| `--goal <goal>` | Revision goal. |
| `--repo-root <path>` | Explicit Wetzler voice repository root. |
| `--timeout-ms <ms>` | Vale timeout in milliseconds. |

Example:

```bash
pnpm wetzler prepare docs/getting-started.md \
  --audience "new user" \
  --goal "make setup feel clear and approachable"
```

The command prints JSON. Give that packet to the agent that will perform the rewrite.

## `wetzler samples add`

Copy a Markdown sample into the voice library.

```bash
pnpm wetzler samples add <path> --label <label> [options]
```

Options:

| Option | Description |
| --- | --- |
| `--label <label>` | Human-readable label for the sample. Required. |
| `--weight <weight>` | Sample weight. Default: `1`. |
| `--repo-root <path>` | Explicit Wetzler voice repository root. |

Example:

```bash
pnpm wetzler samples add samples/essay.md \
  --label "personal essay" \
  --weight 2
```

## `wetzler learn propose`

Create a review-gated voice update proposal from samples.

```bash
pnpm wetzler learn propose --samples <glob...> [options]
```

Options:

| Option | Description |
| --- | --- |
| `--samples <glob...>` | One or more sample globs. Required. |
| `--rationale <rationale>` | Reason for the proposal. |
| `--repo-root <path>` | Explicit Wetzler voice repository root. |

Example:

```bash
pnpm wetzler learn propose \
  --samples "voice/samples/*.md" \
  --rationale "Capture the accepted product announcement voice"
```

## `wetzler learn validate`

Validate a proposal without applying it.

```bash
pnpm wetzler learn validate <proposal-id> [options]
```

Options:

| Option | Description |
| --- | --- |
| `--repo-root <path>` | Explicit Wetzler voice repository root. |

Example:

```bash
pnpm wetzler learn validate 20260611T120000Z-product-announcement
```

The command prints the validation result as JSON and exits non-zero when validation fails.

## `wetzler learn accept`

Validate and apply a proposal.

```bash
pnpm wetzler learn accept <proposal-id> [options]
```

Options:

| Option | Description |
| --- | --- |
| `--repo-root <path>` | Explicit Wetzler voice repository root. |

Example:

```bash
pnpm wetzler learn accept 20260611T120000Z-product-announcement
```

Acceptance updates durable voice files only after validation passes.

## `wetzler mcp`

Start the MCP server over stdio.

```bash
WRITING_VOICE_ROOT=/path/to/wetzler pnpm wetzler mcp
```

Most users do not run this directly. Codex, Claude Code, or another MCP host normally starts it through a plugin wrapper or MCP configuration.
