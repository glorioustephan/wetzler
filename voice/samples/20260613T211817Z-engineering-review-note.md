# Engineering Review Note

The important change is small: `packages/core/src/vale.ts` now treats Vale as the source of mechanical truth and keeps agent judgment outside the lint step.

That split matters because it gives reviewers something inspectable. If a draft trips `voice.hype`, we can point at the exact phrase, decide whether the warning is fair, and revise without pretending the tool knows intent better than the author.

The safe next check is `pnpm test && pnpm typecheck`. If those pass, I would still run one real Markdown file through `pnpm wetzler prepare` before calling the release ready.

