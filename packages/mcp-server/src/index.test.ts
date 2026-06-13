import { describe, expect, it } from "vitest";
import { safeToolResult, toToolResult } from "./index.js";

describe("toToolResult", () => {
  it("returns structured content and marks tool execution errors", () => {
    expect(toToolResult({ exitCode: 2 }, "Vale failed")).toEqual({
      content: [
        {
          type: "text",
          text: "{\n  \"ok\": false,\n  \"data\": {\n    \"exitCode\": 2\n  },\n  \"error\": \"Vale failed\"\n}"
        }
      ],
      structuredContent: {
        ok: false,
        data: {
          exitCode: 2
        },
        error: "Vale failed"
      },
      isError: true
    });
  });
});

describe("safeToolResult", () => {
  it("passes successful results through unchanged", async () => {
    const result = toToolResult({ ok: true });
    await expect(safeToolResult(async () => result)).resolves.toBe(result);
  });

  it("converts thrown errors into structured error results", async () => {
    const result = await safeToolResult(async () => {
      throw new Error("proposal not found");
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      ok: false,
      data: null,
      error: "proposal not found"
    });
  });
});
