import { z } from "zod";

export const voiceProfileSchema = z.object({
  version: z.number().int().positive(),
  name: z.string().min(1),
  summary: z.string().min(1),
  principles: z.array(z.string().min(1)),
  toneBoundaries: z.array(z.string().min(1)),
  allowedMoves: z.array(z.string().min(1)),
  bannedMoves: z.array(z.string().min(1)),
  rewriteRubric: z.array(z.string().min(1))
});

const profileProposalChangesSchema = z.object({
  principles: z.array(z.string()).default([]),
  toneBoundaries: z.array(z.string()).default([]),
  allowedMoves: z.array(z.string()).default([]),
  bannedMoves: z.array(z.string()).default([]),
  rewriteRubric: z.array(z.string()).default([])
});

const vocabularyProposalChangesSchema = z.object({
  accept: z.array(z.string()).default([]),
  reject: z.array(z.string()).default([])
});

export const valeRuleProposalSchema = z.object({
  filename: z.string().regex(/^[A-Za-z0-9._-]+\.yml$/),
  contents: z.string().min(1)
});

export const voiceUpdateProposalSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["proposed", "accepted"]),
  createdAt: z.string().min(1),
  acceptedAt: z.string().optional(),
  sources: z.array(z.string()).default([]),
  rationale: z.string().default(""),
  observations: z.array(z.string()).default([]),
  changes: z.object({
    profile: profileProposalChangesSchema.default({
      principles: [],
      toneBoundaries: [],
      allowedMoves: [],
      bannedMoves: [],
      rewriteRubric: []
    }),
    vocabulary: vocabularyProposalChangesSchema.default({
      accept: [],
      reject: []
    }),
    rules: z.array(valeRuleProposalSchema).default([])
  })
});

export const voiceSampleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().positive(),
  sourcePath: z.string().min(1),
  samplePath: z.string().min(1),
  metadataPath: z.string().min(1),
  addedAt: z.string().min(1)
});
