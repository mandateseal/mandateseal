import { describe, expect, it } from "vitest";
import { enforceFeeGate } from "./feegate";
import type { PolicyDecision } from "./policy";

describe("enforceFeeGate", () => {
  const approved: PolicyDecision = {
    decision: "APPROVED",
    reason: "ok",
    matchedRule: "default.allow",
    riskLevel: "LOW",
  };

  it("passes through non-APPROVED decisions unchanged", () => {
    const blocked: PolicyDecision = { ...approved, decision: "BLOCKED", reason: "blocked", matchedRule: "x", riskLevel: "HIGH" };
    expect(enforceFeeGate(blocked, { overFreeQuota: true, creditsRemaining: 0 })).toBe(blocked);
  });

  it("passes through inside the free quota (no credits needed)", () => {
    expect(enforceFeeGate(approved, { overFreeQuota: false, creditsRemaining: 0 }).decision).toBe("APPROVED");
  });

  it("passes through over quota when credits remain", () => {
    expect(enforceFeeGate(approved, { overFreeQuota: true, creditsRemaining: 5 }).decision).toBe("APPROVED");
  });

  it("BLOCKS over quota with zero credits", () => {
    const out = enforceFeeGate(approved, { overFreeQuota: true, creditsRemaining: 0 });
    expect(out.decision).toBe("BLOCKED");
    expect(out.matchedRule).toBe("feeGate.insufficientCredits");
    expect(out.riskLevel).toBe("LOW");
    expect(out.reason).toContain("FeeVault");
  });

  it("BLOCKS over quota with negative credits (defensive)", () => {
    expect(enforceFeeGate(approved, { overFreeQuota: true, creditsRemaining: -1 }).decision).toBe("BLOCKED");
  });
});
