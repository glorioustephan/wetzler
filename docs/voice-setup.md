---
title: Set Up a Voice
description: Create, tune, and safely update a Wetzler voice profile with samples, vocabulary, Vale rules, and proposals.
---

# Set Up a Voice

A Wetzler voice is a small set of plain files. That is the point. You can read it, diff it, review it, and change it without trusting a hidden prompt.

Think of the voice in three layers:

| Layer | What it answers |
| --- | --- |
| Profile | What should the writing feel like? |
| Samples | What does good writing look like in real examples? |
| Rules and vocabulary | What should the checker always notice? |

You do not have to perfect all three at once. Start with the profile, add a few strong samples, then tune rules only when a pattern repeats.

## Voice Files

| File or directory | Purpose |
| --- | --- |
| `voice/profile.yml` | The voice contract used in every revision packet. |
| `voice/samples/` | Markdown samples and metadata copied by `wetzler samples add`. |
| `voice/proposals/` | Review-gated update proposals created by `wetzler learn propose`. |
| `styles/voice/` | Vale rules for patterns the voice should catch. |
| `styles/config/vocabularies/voice/accept.txt` | Terms Vale should accept. |
| `styles/config/vocabularies/voice/reject.txt` | Terms Vale should flag. |
| `.vale.ini` | Connects Markdown files to the Vale and Wetzler rule sets. |

The current repository ships with one configurable voice profile, `Writing Voice`. To create a new voice, edit the same files to describe the new voice, then add samples that prove the desired direction.

## Shape the Profile

`voice/profile.yml` has seven fields:

```yaml
version: 1
name: Writing Voice
summary: >
  Clear, grounded, lightly playful writing with engineering taste and a human pulse.
principles:
  - Lead with the real point.
toneBoundaries:
  - Casual is welcome; sloppy is not.
allowedMoves:
  - Use short paragraphs with visible air between ideas.
bannedMoves:
  - Do not over-polish into generic corporate prose.
rewriteRubric:
  - Preserve the author's intent and factual claims.
```

Use the fields this way:

| Field | Write down |
| --- | --- |
| `summary` | The one-paragraph description of the voice. |
| `principles` | The values the writer should preserve. |
| `toneBoundaries` | The edges of the voice: what is welcome and what goes too far. |
| `allowedMoves` | Specific moves the agent may use. |
| `bannedMoves` | Specific moves the agent should avoid. |
| `rewriteRubric` | The checklist used to judge a revision. |

Good profile lines are concrete. Instead of "make it better," say "Preserve paths, commands, dates, error text, and concrete evidence."

If a 15-year-old could point to the sentence and say whether the agent followed it, the line is probably specific enough.

## Add a Writing Sample

Use samples when you want Wetzler to learn from actual writing rather than a preference stated in the abstract.

A good sample is something you would be happy to imitate. It should show the voice you want, not only the topic you write about. Short samples are fine if they contain real choices: sentence rhythm, level of detail, warmth, restraint, humor, or product judgment.

```bash
pnpm wetzler samples add samples/post.md \
  --label "launch post" \
  --weight 2
```

The command copies the source Markdown into `voice/samples/` and writes a metadata file next to it. The original source path is recorded, but the sample content is preserved inside the voice repository.

Use higher weights for samples that are especially representative. A weight of `2` means "pay extra attention to this one." A weight of `1` means "this is useful, but ordinary."

## Propose a Voice Update

Create a proposal from one or more sample globs:

```bash
pnpm wetzler learn propose \
  --samples "voice/samples/*.md" \
  --rationale "Tune the profile from approved launch writing"
```

The proposal records:

- matched sample paths,
- deterministic observations,
- suggested profile additions,
- vocabulary changes,
- optional Vale rule changes.

The generated proposal is intentionally conservative. It gives you a safe starting point, not an automatic personality transplant.
If the sample glob matches nothing, Wetzler stops instead of creating an empty proposal.

## Review the Proposal

Open the proposal under:

```text
voice/proposals/<proposal-id>.yml
```

Look for these sections:

```yaml
changes:
  profile:
    principles: []
    toneBoundaries: []
    allowedMoves: []
    bannedMoves: []
    rewriteRubric: []
  vocabulary:
    accept: []
    reject: []
  rules: []
```

Edit the proposal before accepting it. Keep only changes that are supported by samples or clear product intent.

Read it like a product decision:

- Does this change make future writing better?
- Is it based on real samples, not one weird sentence?
- Would you be comfortable applying it to every future draft?
- Is it specific enough that an agent can follow it?

## Validate and Accept the Update

Validate a proposal without applying it, from the CLI or the MCP server:

```bash
pnpm wetzler learn validate <proposal-id>
```

Accepting a proposal is CLI-only. That keeps durable voice changes behind an explicit human action.

```bash
pnpm wetzler learn accept <proposal-id>
```

Acceptance validates the proposal in a temporary Vale repository. If validation passes, Wetzler updates:

- `voice/profile.yml`,
- accepted vocabulary,
- rejected vocabulary,
- any proposed Vale rule files,
- the proposal status.

Commit accepted changes like any other product decision.

## Add Vocabulary

Use vocabulary when a word should be accepted or rejected everywhere.

Accepted terms live here:

```text
styles/config/vocabularies/voice/accept.txt
```

Rejected terms live here:

```text
styles/config/vocabularies/voice/reject.txt
```

Use accepted terms for names, product words, or terms Vale would otherwise flag incorrectly. Use rejected terms for words that should almost never appear in the target voice.

Example: add a product name like `Wetzler` to the accepted list if the spelling checker flags it. Add a phrase like `best-in-class` to the rejected list if it usually weakens the voice.

## Add a Vale Rule

Use Vale rules when a repeatable pattern can be detected mechanically. For example, a rule can catch hype words, filler, corporate phrasing, weak evidence, or long sentences.

Place rules in:

```text
styles/voice/
```

Every proposed rule filename must be safe and end in `.yml`. The proposal validator checks that rule YAML has an `extends` value before allowing acceptance.

## A Healthy Voice Update Loop

| Step | Action | Result |
| --- | --- | --- |
| 1 | Add an approved writing sample with `samples add`. | The sample and metadata land in `voice/samples/`. |
| 2 | Generate a proposal with `learn propose`. | Wetzler writes a reviewable file in `voice/proposals/`. |
| 3 | Review and edit the proposal. | Only supported profile, vocabulary, and rule changes remain. |
| 4 | Validate the proposal. | The proposed Vale setup is checked in a temporary repository. |
| 5 | Accept after approval. | Durable profile, vocabulary, rules, and proposal status are updated. |

The quiet wisdom here: let samples teach, but let review decide.
