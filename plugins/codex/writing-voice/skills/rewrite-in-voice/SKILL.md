---
name: rewrite-in-voice
description: Rewrite Markdown with the configured Writing Voice MCP server and Vale-backed voice contract.
---

# Rewrite In Voice

Use this when the user asks to revise, rewrite, lint, or tune Markdown so it fits the configured voice.

## Workflow

1. Get the Markdown from the user, a file path, or the active document.
2. Call the `prepare_revision` MCP tool with:
   - `markdown`
   - `path` when there is a file path
   - `audience` and `goal` when the user gave them
3. Rewrite the Markdown using the returned voice profile, Vale findings, checklist, and output instructions.
4. Call `lint_markdown` on the revised Markdown.
5. If remaining alerts are intentional, keep the prose and do not overfit the linter.
6. Return revised Markdown only unless the user explicitly asks for notes, a diff, or a file write.

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
