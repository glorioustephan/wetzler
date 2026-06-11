import { loadVoiceProfile } from "./profile.js";
import { lintMarkdown } from "./vale.js";
import type { RevisionPacket, RevisionRequest } from "./types.js";

export async function prepareRevision(request: RevisionRequest): Promise<RevisionPacket> {
  const repoRoot = request.repoRoot;
  const lintInput: Parameters<typeof lintMarkdown>[0] = {
    markdown: request.markdown,
    filePath: request.sourcePath ?? "draft.md"
  };
  if (repoRoot !== undefined) {
    lintInput.repoRoot = repoRoot;
  }
  if (request.timeoutMs !== undefined) {
    lintInput.timeoutMs = request.timeoutMs;
  }

  const [voiceProfile, vale] = await Promise.all([
    loadVoiceProfile(repoRoot),
    lintMarkdown(lintInput)
  ]);

  return {
    markdown: request.markdown,
    sourcePath: request.sourcePath ?? "draft.md",
    audience: request.audience ?? null,
    goal: request.goal ?? "Preserve the intent while revising the Markdown into James's voice.",
    voiceProfile,
    vale,
    rewriteChecklist: [
      "Preserve factual claims, links, headings, frontmatter, tables, code fences, and inline code.",
      "Keep the writing concrete and readable before making it clever.",
      "Resolve Vale alerts when they align with the author's intent.",
      "Do not add unsupported claims or remove meaningful evidence.",
      "Return revised Markdown only unless the user explicitly asks for commentary or a file write."
    ],
    outputInstructions: [
      "Return Markdown that is ready to paste.",
      "Do not wrap the entire response in a code fence unless the caller asks for a code block.",
      "If a sentence cannot be safely revised without changing meaning, preserve it."
    ]
  };
}
