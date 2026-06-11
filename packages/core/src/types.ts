export type VoiceProfile = {
  version: number;
  name: string;
  summary: string;
  principles: string[];
  toneBoundaries: string[];
  allowedMoves: string[];
  bannedMoves: string[];
  rewriteRubric: string[];
};

export type VoiceSample = {
  id: string;
  label: string;
  weight: number;
  sourcePath: string;
  samplePath: string;
  metadataPath: string;
  addedAt: string;
};

export type ValeSeverity = "suggestion" | "warning" | "error";

export type ValeAlert = {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  check: string;
  severity: ValeSeverity;
  message: string;
  match?: string;
  link?: string;
  raw: Record<string, unknown>;
};

export type ValeSummary = {
  alertCount: number;
  bySeverity: Record<ValeSeverity, number>;
  byCheck: Record<string, number>;
};

export type ValeRuntimeError = {
  code: string | null;
  message: string;
  raw: unknown;
};

export type ValeLintResult = {
  alerts: ValeAlert[];
  summary: ValeSummary;
  exitCode: number;
  stderr: string;
  runtimeError: ValeRuntimeError | null;
};

export type RevisionRequest = {
  markdown: string;
  sourcePath?: string;
  audience?: string;
  goal?: string;
  repoRoot?: string;
  timeoutMs?: number;
};

export type RevisionPacket = {
  markdown: string;
  sourcePath: string;
  audience: string | null;
  goal: string;
  voiceProfile: VoiceProfile;
  vale: ValeLintResult;
  rewriteChecklist: string[];
  outputInstructions: string[];
};

export type ProfileProposalChanges = {
  principles: string[];
  toneBoundaries: string[];
  allowedMoves: string[];
  bannedMoves: string[];
  rewriteRubric: string[];
};

export type VocabularyProposalChanges = {
  accept: string[];
  reject: string[];
};

export type ValeRuleProposal = {
  filename: string;
  contents: string;
};

export type VoiceUpdateProposal = {
  id: string;
  status: "proposed" | "accepted";
  createdAt: string;
  acceptedAt?: string | undefined;
  sources: string[];
  rationale: string;
  observations: string[];
  changes: {
    profile: ProfileProposalChanges;
    vocabulary: VocabularyProposalChanges;
    rules: ValeRuleProposal[];
  };
};

export type VoiceUpdateValidation = {
  proposalId: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
};
