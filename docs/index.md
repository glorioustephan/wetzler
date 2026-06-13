---
layout: home
title: Wetzler
titleTemplate: AI-assisted writing voice
hero:
  name: Wetzler
  text: Find your voice. Keep it true.
  tagline: A Vale-backed, agent-guided writing voice tool for revising Markdown with inspectable rules, durable samples, and a human review loop.
  image:
    src: /cover-image.png
    alt: Wetzler cover image with typewriter, manuscript, and writing notes
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: Set Up a Voice
      link: /voice-setup
    - theme: alt
      text: Use With Agents
      link: /agentic-workflows
features:
  - title: Voice Rules You Can Inspect
    details: Store principles, tone boundaries, approved words, rejected words, and Vale rules in plain files.
  - title: Agent-Ready Revision Packets
    details: Give Codex, Claude, or another MCP host the source Markdown, current findings, and exact rewrite guardrails.
  - title: Review-Gated Learning
    details: Turn samples into proposed profile, vocabulary, and rule updates before anything changes permanently.
---

## What Wetzler Provides

Wetzler helps a writing assistant revise Markdown into a specific voice without hiding the rules in a model prompt. It combines a voice profile, writing samples, Vale lint rules, a command-line tool, and an MCP server that AI tools can call before they rewrite.

In plain English: Wetzler gives the AI a style guide, a checklist, and examples before it edits. The AI still does the rewrite. Wetzler makes the instructions visible, repeatable, and reviewable.

Wetzler is useful when you want clearer writing but do not want the assistant to:

- erase important details,
- flatten your personality,
- remove links, commands, dates, or code,
- make unsupported claims,
- silently change the voice rules without review.

The result is a calm workflow:

| Step | What happens |
| --- | --- |
| 1. Draft | Start with Markdown from a file, editor, or agent context. |
| 2. Prepare | `wetzler prepare` loads the voice profile, runs Vale, and builds the revision packet. |
| 3. Revise | The host agent rewrites inside the packet's guardrails. |
| 4. Check | `wetzler lint` verifies the revised Markdown against the same rules. |
| 5. Return | The agent returns paste-ready Markdown unless you asked for notes, a diff, or a file write. |

## Who It Is For

Wetzler is for people who want AI writing help without losing the texture of their own judgment. It is especially useful when you care about preserving structure, evidence, links, commands, dates, code fences, and the small human choices that make writing sound alive.

Use it when you want to:

- revise Markdown without flattening it into generic prose,
- lint writing against rules you can read,
- give agents a clean contract before they rewrite,
- grow a voice profile from real samples,
- package the same voice workflow for CLI, MCP, Codex, Claude Code, or MCPB-aware clients.

## The Main Pieces

| Piece | What it does |
| --- | --- |
| `voice/profile.yml` | The written style guide. It says what the voice values and what it should avoid. |
| `voice/samples/` | Example writing that shows the voice in practice. |
| `styles/voice/` | Mechanical checks for repeatable writing patterns, like hype or filler. |
| `styles/config/vocabularies/voice/` | Words the checker should always accept or flag. |
| `wetzler lint` | Checks Markdown and reports what the rules noticed. It does not rewrite. |
| `wetzler prepare` | Builds the packet an agent uses to revise safely. This is the usual first step before a rewrite. |
| `wetzler samples add` | Copies a writing sample into the voice library with metadata. |
| `wetzler learn propose` | Creates a review-gated proposal from samples. |
| `wetzler learn accept` | Applies a validated proposal after human approval. |
| MCP server | Exposes linting, revision preparation, proposal creation, validation, resources, and prompts to agent hosts. |

Start with [Getting Started](/getting-started), then move into [Set Up a Voice](/voice-setup) when you are ready to make Wetzler sound like you.
