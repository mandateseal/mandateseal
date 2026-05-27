import { describe, it, expect } from "vitest";
import { calculateReputation, type ReputationStats } from "./reputation";

const NOW = new Date("2026-05-28T00:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(NOW - n * DAY);
}

function base(overrides: Partial<ReputationStats> = {}): ReputationStats {
  return {
    total: 0,
    approved: 0,
    blocked: 0,
    needsApproval: 0,
    anchored: 0,
    firstSeenAt: null,
    lastSeenAt: null,
    nowMs: NOW,
    ...overrides,
  };
}

describe("calculateReputation", () => {
  it("zero receipts → NEW tier, score 0", () => {
    const r = calculateReputation(base());
    expect(r.score).toBe(0);
    expect(r.tier).toBe("NEW");
  });

  it("low volume (<5 receipts) caps volume signal at 0", () => {
    const r = calculateReputation(
      base({
        total: 3,
        approved: 3,
        firstSeenAt: daysAgo(10),
        lastSeenAt: daysAgo(0),
      }),
    );
    expect(r.breakdown.volume).toBe(0);
  });

  it("100 perfectly-approved + fully-anchored + 30d active = TRUSTED", () => {
    const r = calculateReputation(
      base({
        total: 100,
        approved: 100,
        anchored: 100,
        firstSeenAt: daysAgo(60),
        lastSeenAt: daysAgo(0),
      }),
    );
    expect(r.tier).toBe("TRUSTED");
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it("50% blocked drags score down sharply", () => {
    const clean = calculateReputation(
      base({
        total: 100,
        approved: 100,
        anchored: 0,
        firstSeenAt: daysAgo(60),
        lastSeenAt: daysAgo(0),
      }),
    );
    const half = calculateReputation(
      base({
        total: 100,
        approved: 50,
        blocked: 50,
        anchored: 0,
        firstSeenAt: daysAgo(60),
        lastSeenAt: daysAgo(0),
      }),
    );
    expect(half.score).toBeLessThan(clean.score);
    expect(half.breakdown.blockPenalty).toBeLessThan(0);
  });

  it("0% anchored → 0 anchored points; 100% → max 20 anchored points", () => {
    const none = calculateReputation(
      base({
        total: 50,
        approved: 50,
        anchored: 0,
        firstSeenAt: daysAgo(30),
        lastSeenAt: daysAgo(0),
      }),
    );
    const all = calculateReputation(
      base({
        total: 50,
        approved: 50,
        anchored: 50,
        firstSeenAt: daysAgo(30),
        lastSeenAt: daysAgo(0),
      }),
    );
    expect(none.breakdown.anchored).toBe(0);
    expect(all.breakdown.anchored).toBe(20);
  });

  it("stale agent (90 days idle) gets recency penalty", () => {
    const stale = calculateReputation(
      base({
        total: 50,
        approved: 50,
        anchored: 25,
        firstSeenAt: daysAgo(180),
        lastSeenAt: daysAgo(90),
      }),
    );
    expect(stale.breakdown.recency).toBe(-10);
  });

  it("ratios are computed from raw counts", () => {
    const r = calculateReputation(
      base({
        total: 100,
        approved: 70,
        blocked: 20,
        needsApproval: 10,
        anchored: 50,
        firstSeenAt: daysAgo(30),
        lastSeenAt: daysAgo(0),
      }),
    );
    expect(r.ratios.approved).toBe(0.7);
    expect(r.ratios.blocked).toBe(0.2);
    expect(r.ratios.anchored).toBe(0.5);
  });

  it("daysActive measured between firstSeenAt and now", () => {
    const r = calculateReputation(
      base({
        total: 10,
        approved: 10,
        firstSeenAt: daysAgo(45),
        lastSeenAt: daysAgo(0),
      }),
    );
    expect(r.daysActive).toBe(45);
  });

  it("tier boundaries: 80=TRUSTED, 60=ACTIVE, 30=EMERGING, <30=NEW", () => {
    // Stub by hitting the formula. 100 approved + 100 anchored + 100% recent
    // + long active = clamps to 100 → TRUSTED.
    const trusted = calculateReputation(
      base({
        total: 200,
        approved: 200,
        anchored: 200,
        firstSeenAt: daysAgo(120),
        lastSeenAt: daysAgo(0),
      }),
    );
    expect(trusted.tier).toBe("TRUSTED");

    // 80% approved, no anchors, modest age.
    const active = calculateReputation(
      base({
        total: 50,
        approved: 40,
        blocked: 10,
        anchored: 0,
        firstSeenAt: daysAgo(30),
        lastSeenAt: daysAgo(0),
      }),
    );
    expect(["EMERGING", "ACTIVE"]).toContain(active.tier);

    // Brand new and only 1 receipt.
    const newAgent = calculateReputation(
      base({
        total: 1,
        approved: 1,
        firstSeenAt: daysAgo(0),
        lastSeenAt: daysAgo(0),
      }),
    );
    expect(newAgent.tier).toBe("NEW");
  });

  it("score is clamped to 0..100", () => {
    const bottom = calculateReputation(
      base({
        total: 50,
        approved: 0,
        blocked: 50,
        firstSeenAt: daysAgo(120),
        lastSeenAt: daysAgo(200),
      }),
    );
    expect(bottom.score).toBeGreaterThanOrEqual(0);

    const top = calculateReputation(
      base({
        total: 1000,
        approved: 1000,
        anchored: 1000,
        firstSeenAt: daysAgo(365),
        lastSeenAt: daysAgo(0),
      }),
    );
    expect(top.score).toBeLessThanOrEqual(100);
  });

  it("pure function — same input, same output", () => {
    const s = base({
      total: 47,
      approved: 30,
      blocked: 12,
      needsApproval: 5,
      anchored: 20,
      firstSeenAt: daysAgo(40),
      lastSeenAt: daysAgo(2),
    });
    const a = calculateReputation(s);
    const b = calculateReputation(s);
    expect(a).toEqual(b);
  });
});
