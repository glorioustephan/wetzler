---
title: Troubleshooting
description: Fix common Wetzler setup, CLI, MCP, Vale, and documentation deployment issues.
---

# Troubleshooting

Start with the exact command that failed, then check the matching section below. Wetzler tries to keep errors plain, but a little path clarity goes a long way.

If the command prints JSON, that is usually not an error by itself. Look for `runtimeError`, `ok`, `alerts`, or the process exit code to understand what happened.

## Problem: I Got JSON and Do Not Know What It Means

**Cause:** Wetzler commands return structured data so agents and scripts can read it reliably.

**Solution:**

For `lint`, look at:

- `alerts`: the list of things Wetzler noticed.
- `summary.alertCount`: the number of findings.
- `runtimeError`: a real tool failure, such as a missing config file.

For `prepare`, look for:

- `voiceProfile`: the style guide the agent should follow.
- `vale.alerts`: the rule findings.
- `rewriteChecklist`: the things the agent must preserve.
- `outputInstructions`: how the agent should return the rewrite.

If `alerts` is empty and `runtimeError` is `null`, the check ran successfully and found nothing to flag.

## Problem: Wetzler Cannot Find the Voice Root

**Symptom:**

```text
Unable to find writing voice root
```

**Cause:** Wetzler could not find a directory containing both `voice/profile.yml` and `.vale.ini`.

**Solution:**

Run from the repository root:

```bash
cd /path/to/wetzler
pnpm wetzler lint README.md --json
```

Or pass the root explicitly:

```bash
pnpm wetzler lint /path/to/draft.md --repo-root /path/to/wetzler
```

Or set the environment variable:

```bash
WRITING_VOICE_ROOT=/path/to/wetzler pnpm wetzler prepare /path/to/draft.md
```

## Problem: Vale Times Out

**Symptom:**

```text
Vale timed out before returning a result.
```

**Cause:** Vale exceeded the default timeout.

**Solution:**

Increase the timeout:

```bash
pnpm wetzler lint large-doc.md --timeout-ms 30000 --json
```

For long documents, split the draft into sections and revise one section at a time.

## Problem: `pnpm wetzler` Cannot Find the Built CLI

**Symptom:**

```text
Cannot find module packages/cli/dist/index.js
```

**Cause:** The packages have not been built yet.

**Solution:**

```bash
pnpm build
pnpm wetzler lint README.md --json
```

## Problem: An MCP Client Starts but Has No Tools

**Cause:** The MCP server may not be launching from the plugin directory, or `WRITING_VOICE_ROOT` may not point to the repository root.

**Solution:**

Verify the CLI builds:

```bash
pnpm build
```

Start the server directly to confirm it can initialize:

```bash
WRITING_VOICE_ROOT=/path/to/wetzler node packages/cli/dist/index.js mcp
```

Then check the client configuration points to the local wrapper or command you expect.

## Problem: A Voice Proposal Has No Changes

**Cause:** No samples matched the glob, or the sample metrics did not suggest a new profile line.

**Solution:**

Check the glob:

```bash
ls voice/samples
pnpm wetzler learn propose --samples "voice/samples/*.md"
```

If the observations are useful but the generated changes are empty, edit the proposal manually before accepting it. The proposal format is designed for that.

## Problem: Wetzler Flags a Sentence You Want to Keep

**Cause:** The rules are evidence, not law. A rule can be too broad for a specific sentence.

**Solution:**

Keep the sentence when changing it would remove meaning, rhythm, a product name, a quoted phrase, or a useful technical detail.

If the same false positive happens often, update vocabulary or create a proposal that changes the rule. Do not weaken a good draft only to get to zero alerts.

## Problem: Docs Build Locally but Pages Shows Broken Assets

**Cause:** GitHub Pages serves project sites from a subpath. For this repository, the VitePress base path is `/wetzler/`.

**Solution:**

Build with the configured base:

```bash
pnpm docs:build
```

In GitHub, set:

```text
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

Then run the `Deploy Docs` workflow or push to `main`.

## Problem: The Agent Over-Rewrites

**Cause:** The agent optimized for polish instead of preserving the source.

**Solution:**

Use a narrower prompt:

```text
Use Wetzler to revise this Markdown.
Preserve all claims, headings, links, code, paths, dates, examples, and evidence.
Prefer the smallest edit that makes the prose clearer.
Return revised Markdown only.
```

If it keeps happening, add a profile rule or rewrite rubric line that names the failure directly.
