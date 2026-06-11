---
name: rewrite-in-voice
description: Rewrite Markdown in James Baker's voice using the local Writing Voice MCP server and Vale-backed voice contract.
---

# Rewrite In Voice

Use this when the user asks to revise, rewrite, lint, or tune Markdown so it sounds like James.

## Workflow

1. Call `prepare_revision` with the Markdown, source path when available, audience, and goal.
2. Rewrite using the returned voice profile, Vale findings, checklist, and output instructions.
3. Call `lint_markdown` on the revised Markdown.
4. Return revised Markdown only unless the user asks for notes, a diff, or a file write.

## Guardrails

- Preserve headings, links, frontmatter, tables, code fences, inline code, and factual claims.
- Do not invent evidence, dates, quotes, commands, or file paths.
- Prefer clear, concrete language over corporate smoothness.
- Keep warmth and wit sparse enough that the message still leads.
- Do not write files unless the user explicitly asks you to.

## Learning Updates

When the user gives new samples or accepted edits, call `propose_voice_update`. Do not call
the CLI accept command unless the user explicitly approves that proposal. Use
`validate_voice_update` before telling the user a proposal is ready to accept.
