import { pathToFileURL } from "node:url";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  createVoiceUpdateProposal,
  getVoicePaths,
  lintMarkdown,
  prepareRevision,
  validateVoiceUpdateProposal,
} from "@wetzler/core";
import type { RevisionRequest } from "@wetzler/core";

const maybeString = z.string().min(1).optional();
const toolOutputSchema = {
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().nullable().optional(),
};

export function createWritingVoiceServer(): McpServer {
  const server = new McpServer({
    name: "wetzler",
    version: "0.1.0",
  });

  server.registerTool(
    "lint_markdown",
    {
      title: "Lint Markdown",
      description: "Run the pinned Vale voice rules against Markdown.",
      inputSchema: {
        markdown: z.string(),
        path: maybeString,
      },
      outputSchema: toolOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ markdown, path }) =>
      safeToolResult(async () => {
        const result = await lintMarkdown({
          markdown,
          filePath: path ?? "draft.md",
        });
        return toToolResult(result, result.runtimeError?.message ?? null);
      }),
  );

  server.registerTool(
    "prepare_revision",
    {
      title: "Prepare Revision",
      description:
        "Return a voice contract, Vale findings, and rewrite checklist for host-agent Markdown revision.",
      inputSchema: {
        markdown: z.string(),
        path: maybeString,
        audience: maybeString,
        goal: maybeString,
      },
      outputSchema: toolOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ markdown, path, audience, goal }) =>
      safeToolResult(async () => {
        const request: RevisionRequest = {
          markdown,
          sourcePath: path ?? "draft.md",
        };
        if (audience !== undefined) {
          request.audience = audience;
        }
        if (goal !== undefined) {
          request.goal = goal;
        }
        const packet = await prepareRevision(request);
        return toToolResult(packet, packet.vale.runtimeError?.message ?? null);
      }),
  );

  server.registerTool(
    "propose_voice_update",
    {
      title: "Propose Voice Update",
      description:
        "Create a review-gated voice update proposal from sample globs. Accepting it is a separate explicit step.",
      inputSchema: {
        sampleGlobs: z.array(z.string().min(1)).min(1),
        rationale: maybeString,
      },
      outputSchema: toolOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async ({ sampleGlobs, rationale }) =>
      safeToolResult(async () =>
        toToolResult(
          await createVoiceUpdateProposal(
            rationale === undefined
              ? { sampleGlobs }
              : { sampleGlobs, rationale },
          ),
        ),
      ),
  );

  server.registerTool(
    "validate_voice_update",
    {
      title: "Validate Voice Update",
      description:
        "Validate a proposed voice update without applying it. Accepting proposals is intentionally CLI-only.",
      inputSchema: {
        proposalId: z.string().min(1),
      },
      outputSchema: toolOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ proposalId }) =>
      safeToolResult(async () =>
        toToolResult(await validateVoiceUpdateProposal(proposalId)),
      ),
  );

  server.registerResource(
    "voice_profile",
    "wetzler://profile",
    {
      title: "Voice Profile",
      description: "Current durable Writing Voice profile.",
      mimeType: "application/yaml",
    },
    async (uri) => {
      const paths = getVoicePaths();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/yaml",
            text: await readFile(paths.profilePath, "utf8"),
          },
        ],
      };
    },
  );

  server.registerResource(
    "voice_rules",
    "wetzler://rules",
    {
      title: "Vale Voice Rules",
      description:
        "Current Vale configuration and rule files used by Writing Voice.",
      mimeType: "application/json",
    },
    async (uri) => {
      const paths = getVoicePaths();
      const ruleFilenames = (await readdir(paths.voiceRulesDir))
        .filter((filename) => filename.endsWith(".yml"))
        .sort();
      const rules = await Promise.all(
        ruleFilenames.map(async (filename) => ({
          filename,
          contents: await readFile(
            path.join(paths.voiceRulesDir, filename),
            "utf8",
          ),
        })),
      );
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                valeConfig: await readFile(paths.valeConfigPath, "utf8"),
                rules,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "rewrite_in_voice",
    {
      title: "Rewrite In Voice",
      description:
        "Prepare instructions for rewriting Markdown with the configured Writing Voice profile.",
      argsSchema: {
        markdown: z.string(),
        path: maybeString,
        audience: maybeString,
        goal: maybeString,
      },
    },
    async ({ markdown, path, audience, goal }) => {
      const request: RevisionRequest = {
        markdown,
        sourcePath: path ?? "draft.md",
      };
      if (audience !== undefined) {
        request.audience = audience;
      }
      if (goal !== undefined) {
        request.goal = goal;
      }
      const packet = await prepareRevision(request);
      return {
        description:
          "Rewrite Markdown using the Writing Voice profile and Vale findings.",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                "Rewrite this Markdown using the Writing Voice revision packet below.",
                "Return revised Markdown only unless the user asks for commentary.",
                JSON.stringify(packet, null, 2),
              ].join("\n\n"),
            },
          },
        ],
      };
    },
  );

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createWritingVoiceServer();
  await server.connect(new StdioServerTransport());
}

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};

export async function safeToolResult(
  run: () => Promise<ToolResult>,
): Promise<ToolResult> {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toToolResult(null, message);
  }
}

export function toToolResult(
  value: unknown,
  error: string | null = null,
): ToolResult {
  const structuredContent = error
    ? { ok: false, data: value, error }
    : { ok: true, data: value, error: null };
  const result = {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(structuredContent, null, 2),
      },
    ],
    structuredContent,
  };
  return error ? { ...result, isError: true } : result;
}

const entryPoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;
if (entryPoint === import.meta.url) {
  await startMcpServer();
}
