import { describe, expect, it } from "vitest";
import { parsePositiveNumber } from "./index.js";

describe("parsePositiveNumber", () => {
  it("parses positive numeric input", () => {
    expect(parsePositiveNumber("2")).toBe(2);
  });

  it("rejects zero", () => {
    expect(() => parsePositiveNumber("0")).toThrow("Expected a positive number");
  });
});

