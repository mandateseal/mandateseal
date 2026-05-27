import { describe, expect, it } from "vitest";
import { startOfTodayUtc, enforceDailyBudget } from "./spend";
import type { PolicyDecision, MandateSnapshot } from "./policy";

describe("startOfTodayUtc", () => {
  it("zeros out the time portion in UTC", () => {
    const start = startOfTodayUtc(new Date("2026-05-27T14:35:22.123Z"));
    expect(start.toISOString()).toBe("2026-05-27T00:00:00.000Z");
  });

  it("uses the current date when no arg is given", () => {
    const start = startOfTodayUtc();
    expect(start.getUTCHours()).toBe(0);
    expect(start.getUTCMinutes()).toBe(0);
    expect(start.getUTCSeconds()).toBe(0);
    expect(start.getUTCMilliseconds()).toBe(0);
  });

  it("handles dates already at midnight UTC", () => {
    const start = startOfTodayUtc(new Date("2026-05-27T00:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-05-27T00:00:00.000Z");
  });
});

describe("enforceDailyBudget", () => {
  const approved: PolicyDecision = {
    decision: "APPROVED",
    reason: "ok",
    matchedRule: "default.allow",
    riskLevel: "LOW",
  };
  const snapshot: Pick<MandateSnapshot, "dailyBudgetUsd"> = { dailyBudgetUsd: 25 };

  it("passes through non-APPROVED decisions unchanged", () => {
    const blocked: PolicyDecision = { ...approved, decision: "BLOCKED", reason: "blocked", matchedRule: "blockedTools ∋ x", riskLevel: "HIGH" };
    expect(enforceDailyBudget(blocked, { costUsd: 100 }, snapshot, 0)).toBe(blocked);
  });

  it("passes through when mandate has no daily budget (0)", () => {
    expect(enforceDailyBudget(approved, { costUsd: 5 }, { dailyBudgetUsd: 0 }, 999)).toBe(approved);
  });

  it("passes through when action cost is 0", () => {
    expect(enforceDailyBudget(approved, { costUsd: 0 }, snapshot, 24)).toBe(approved);
  });

  it("stays APPROVED when projected spend equals budget (inclusive limit)", () => {
    // 20 + 5 = 25 → not > 25 → still APPROVED
    expect(enforceDailyBudget(approved, { costUsd: 5 }, snapshot, 20).decision).toBe("APPROVED");
  });

  it("flips to BLOCKED when projected spend exceeds budget", () => {
    // 24 + 2 = 26 > 25 → BLOCKED
    const out = enforceDailyBudget(approved, { costUsd: 2 }, snapshot, 24);
    expect(out.decision).toBe("BLOCKED");
    expect(out.matchedRule).toBe("dailySpendUsd > dailyBudgetUsd");
    expect(out.riskLevel).toBe("MEDIUM");
    expect(out.reason).toContain("$25.00");
    expect(out.reason).toContain("$24.00");
    expect(out.reason).toContain("$2.00");
    expect(out.reason).toContain("$26.00");
  });

  it("BLOCKED when today already exceeds budget", () => {
    // today already $30 > $25 budget; any cost > 0 should block
    const out = enforceDailyBudget(approved, { costUsd: 0.01 }, snapshot, 30);
    expect(out.decision).toBe("BLOCKED");
  });
});
