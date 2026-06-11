import { describe, expect, it } from "vitest";
import { toTextResult, toToolResult } from "./index.js";

describe("toTextResult", () => {
  it("formats MCP text content as pretty JSON", () => {
    expect(toTextResult({ ok: true })).toEqual({
      content: [
        {
          type: "text",
          text: "{\n  \"ok\": true\n}"
        }
      ]
    });
  });
});

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
