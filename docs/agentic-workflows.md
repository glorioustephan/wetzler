---
title: Agentic Workflows
description: Use Wetzler with Codex, Claude, and other MCP-capable agents to revise Markdown and refine a writing voice.
---

# Agentic Workflows

Wetzler does not call a model directly. It prepares the context an agent needs, then the host agent performs the rewrite. This keeps the system inspectable: Vale finds issues, Wetzler packages the voice contract, and the agent revises inside those boundaries.

## The Revision Contract

`wetzler prepare` returns a packet with:

| Field | Meaning |
| --- | --- |
| `markdown` | The original Markdown. |
| `sourcePath` | The source path used for Vale findings and context. |
| `audience` | The intended reader when provided. |
| `goal` | The revision goal. |
| `voiceProfile` | The durable profile from `voice/profile.yml`. |
| `vale` | Alerts, summary, stderr, exit code, and runtime error if Vale failed. |
| `rewriteChecklist` | Guardrails the agent should follow. |
| `outputInstructions` | How the agent should return the result. |

The most important instruction is simple: preserve meaning before style.

## Safe Agent Rewrite Flow

Ask the agent to use this loop:

1. Read the Markdown.
2. Call `prepare_revision` or `wetzler prepare`.
3. Rewrite using the returned profile, Vale findings, checklist, and output instructions.
4. Call `lint_markdown` or `wetzler lint` on the revised Markdown.
5. Keep intentional wording when the linter is too narrow.
6. Return revised Markdown only unless you asked for notes, a diff, or a file write.

## Prompt an Agent

Use a prompt like this:

```text
Rewrite this Markdown in my Wetzler voice.

Audience: technical product leader
Goal: make the point clearer without changing facts or removing concrete evidence.

Preserve headings, links, tables, code fences, inline code, dates, commands, and file paths.
Run the Wetzler revision flow first, then lint the revised Markdown before returning it.
Return revised Markdown only.
```

If you want a diff instead of paste-ready Markdown:

```text
Use Wetzler to revise this file in my voice.
Return a concise summary and a unified diff.
Do not write the file unless I explicitly approve the diff.
```

## Use the MCP Tools

The MCP server exposes four tools:

| Tool | Use it for |
| --- | --- |
| `lint_markdown` | Run Vale against Markdown content. |
| `prepare_revision` | Build the agent revision packet. |
| `propose_voice_update` | Create a review-gated proposal from samples. |
| `validate_voice_update` | Check a proposal without applying it. |

It also exposes:

- `wetzler://profile`, the current voice profile.
- `wetzler://rules`, the Vale configuration and rules.
- `rewrite_in_voice`, a prompt that asks the host agent to revise with the packet.

## Refine the Voice With an Agent

An agent can help refine the voice, but it should not silently mutate it. Use this workflow:

1. Give the agent approved writing samples.
2. Ask it to call `propose_voice_update`.
3. Ask it to explain the proposal in plain language.
4. Ask it to call `validate_voice_update`.
5. Review the generated `voice/proposals/<proposal-id>.yml`.
6. Run `pnpm wetzler learn accept <proposal-id>` only after you approve the change.

Good prompt:

```text
Use Wetzler to propose a voice update from these samples.
Do not accept the proposal.
After validation, explain what changed, what evidence supports it, and what I should review.
```

## Things Agents Should Preserve

Wetzler's default rewrite checklist tells agents to preserve:

- factual claims,
- links,
- headings,
- frontmatter,
- tables,
- code fences,
- inline code,
- commands,
- paths,
- dates,
- concrete evidence.

That is where the tool earns its keep. It can make writing clearer without sanding off the facts that made the writing worth reading.

## When to Override the Linter

Vale findings are evidence, not law. Keep a flagged sentence when:

- the wording is part of the author's real voice,
- the term is a product name or quoted phrase,
- the sentence needs its length for rhythm or precision,
- changing it would alter meaning,
- the rule is too broad for the current context.

When a false positive repeats, update vocabulary or propose a Vale rule change. Do not make every draft worse just to make every alert disappear.
