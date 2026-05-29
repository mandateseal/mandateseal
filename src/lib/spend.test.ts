import { describe, expect, it } from "vitest";
import { startOfTodayUtc, enforceDailyBudget, enforceDailyTokenSpend } from "./spend";
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

describe("enforceDailyTokenSpend", () => {
  const approved: PolicyDecision = {
    decision: "APPROVED",
    reason: "ok",
    matchedRule: "default.allow",
    riskLevel: "LOW",
  };
  const snapshot: Pick<MandateSnapshot, "dailyTokenSpendUsd"> = { dailyTokenSpendUsd: 100 };

  it("passes through non-APPROVED decisions unchanged", () => {
    const blocked: PolicyDecision = { ...approved, decision: "BLOCKED", reason: "blocked", matchedRule: "blockedTokens ∋ x", riskLevel: "HIGH" };
    expect(enforceDailyTokenSpend(blocked, { txValueUsd: 500 }, snapshot, 0)).toBe(blocked);
  });

  it("passes through when mandate has no token cap (0)", () => {
    expect(enforceDailyTokenSpend(approved, { txValueUsd: 50 }, { dailyTokenSpendUsd: 0 }, 9999)).toBe(approved);
  });

  it("passes through when the action moves no value (0 / undefined)", () => {
    expect(enforceDailyTokenSpend(approved, { txValueUsd: 0 }, snapshot, 80)).toBe(approved);
    expect(enforceDailyTokenSpend(approved, {}, snapshot, 80)).toBe(approved);
  });

  it("stays APPROVED when projected value equals cap (inclusive limit)", () => {
    // 80 + 20 = 100 → not > 100 → still APPROVED
    expect(enforceDailyTokenSpend(approved, { txValueUsd: 20 }, snapshot, 80).decision).toBe("APPROVED");
  });

  it("flips to BLOCKED when projected value exceeds cap", () => {
    // 90 + 20 = 110 > 100 → BLOCKED
    const out = enforceDailyTokenSpend(approved, { txValueUsd: 20 }, snapshot, 90);
    expect(out.decision).toBe("BLOCKED");
    expect(out.matchedRule).toBe("dailyTokenValueUsd > dailyTokenSpendUsd");
    expect(out.riskLevel).toBe("HIGH");
    expect(out.reason).toContain("$100.00");
    expect(out.reason).toContain("$90.00");
    expect(out.reason).toContain("$20.00");
    expect(out.reason).toContain("$110.00");
  });

  it("BLOCKED when today already exceeds the cap", () => {
    // today already $150 > $100 cap; any value > 0 should block
    const out = enforceDailyTokenSpend(approved, { txValueUsd: 0.01 }, snapshot, 150);
    expect(out.decision).toBe("BLOCKED");
  });
});
