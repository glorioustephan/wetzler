import { describe, expect, it } from "vitest";
import { prepareRevision } from "./revision.js";

describe("prepareRevision", () => {
  it("returns a host-agent revision packet with Vale findings", async () => {
    const packet = await prepareRevision({
      markdown: "# Draft\n\nThis is very game-changing.",
      sourcePath: "draft.md",
      audience: "technical collaborator",
      goal: "tighten the prose"
    });

    expect(packet.voiceProfile.name).toBe("James Baker");
    expect(packet.vale.summary.alertCount).toBeGreaterThan(0);
    expect(packet.rewriteChecklist.join(" ")).toContain("Preserve factual claims");
    expect(packet.outputInstructions.join(" ")).toContain("ready to paste");
  });
});

