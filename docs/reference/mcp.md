---
title: MCP Server Reference
description: Tools, resources, and prompts exposed by the Wetzler MCP server.
---

# MCP Server Reference

The Wetzler MCP server exposes the same core workflow as the CLI, but in a form agents can call directly. It runs over stdio.

Start it from the source checkout:

```bash
WRITING_VOICE_ROOT=/path/to/wetzler node packages/cli/dist/index.js mcp
```

## Tools

### `lint_markdown`

Run the pinned Vale voice rules against Markdown.

Input:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `markdown` | `string` | Yes | Markdown content to lint. |
| `path` | `string` | No | Logical path for Vale output. |

Output:

```json
{
  "ok": true,
  "data": {
    "alerts": [],
    "summary": {
      "alertCount": 0
    }
  },
  "error": null
}
```

### `prepare_revision`

Return a voice contract, Vale findings, rewrite checklist, and output instructions for host-agent Markdown revision.

Input:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `markdown` | `string` | Yes | Source Markdown. |
| `path` | `string` | No | Source path. |
| `audience` | `string` | No | Intended reader. |
| `goal` | `string` | No | Revision goal. |

Use this before an agent rewrites.

### `propose_voice_update`

Create a review-gated voice update proposal from sample globs.

Input:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `sampleGlobs` | `string[]` | Yes | Sample globs relative to the voice repository. |
| `rationale` | `string` | No | Reason for the proposal. |

This tool writes a proposal file under `voice/proposals/`. It does not apply the proposal.

### `validate_voice_update`

Validate a proposed voice update without applying it.

Input:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `proposalId` | `string` | Yes | Proposal id without the `.yml` extension. |

Validation checks proposal shape and verifies the proposed Vale setup in a temporary repository.

## Resources

### `wetzler://profile`

Returns the current `voice/profile.yml` as YAML.

Use this when an agent needs to inspect the durable voice directly.

### `wetzler://rules`

Returns JSON containing:

- `.vale.ini`,
- every `.yml` rule under `styles/Voice/`.

Use this when an agent needs to explain or audit the mechanical lint rules.

## Prompt

### `rewrite_in_voice`

Prepares a prompt for revising Markdown in the Wetzler voice.

Arguments:

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `markdown` | `string` | Yes | Source Markdown. |
| `path` | `string` | No | Source path. |
| `audience` | `string` | No | Intended reader. |
| `goal` | `string` | No | Revision goal. |

The prompt asks the host agent to return revised Markdown only unless the user asks for commentary.

## Client Configuration Pattern

Most local MCP clients accept a command and arguments. The repo-local plugin wrappers use this pattern:

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

The wrapper resolves the repository root, sets `WRITING_VOICE_ROOT`, and starts the CLI MCP command.
