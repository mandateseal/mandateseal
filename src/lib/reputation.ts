// MandateSeal — agent reputation (v0.6).
//
// A pure function turning a receipt-history summary into a 0–100 score + tier
// label. Pure on purpose: the same inputs always produce the same output, so
// the score is reproducible and auditable. The DB-touching wrapper in the API
// route is the only place that talks to Prisma.
//
// Inputs (denormalized so the function can be unit-tested without a DB):
//   total              total receipts the agent has produced
//   approved           count by decision
//   blocked
//   needsApproval
//   anchored           receipts where anchorBatchId IS NOT NULL  ←  "proof"
//   firstSeenAt        Date | null   — first receipt timestamp
//   lastSeenAt         Date | null   — most recent receipt timestamp
//   nowMs              "current time" injected — keeps tests deterministic
//
// Output:
//   score              integer 0..100
//   tier               "TRUSTED" | "ACTIVE" | "EMERGING" | "NEW"
//   breakdown          per-component contribution so the UI can explain why
//
// The score is intentionally readable, not adversary-proof. It is a public
// reputation signal layered on top of the cryptographic primitives — not a
// replacement for them.

export type ReputationTier = "TRUSTED" | "ACTIVE" | "EMERGING" | "NEW";

export interface ReputationStats {
  total: number;
  approved: number;
  blocked: number;
  needsApproval: number;
  anchored: number;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  nowMs?: number;
}

export interface ReputationBreakdown {
  volume: number;
  anchored: number;
  approvalRatio: number;
  blockPenalty: number;
  longevity: number;
  recency: number;
}

export interface ReputationResult {
  score: number;
  tier: ReputationTier;
  breakdown: ReputationBreakdown;
  ratios: {
    approved: number;
    blocked: number;
    anchored: number;
  };
  daysActive: number;
  daysSinceLastSeen: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: Date | null, toMs: number): number {
  if (!from) return 0;
  return Math.max(0, Math.floor((toMs - from.getTime()) / DAY_MS));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function calculateReputation(stats: ReputationStats): ReputationResult {
  const nowMs = stats.nowMs ?? Date.now();
  const total = stats.total;
  const approved = stats.approved;
  const blocked = stats.blocked;
  const anchored = stats.anchored;
  const daysActive = daysBetween(stats.firstSeenAt, nowMs);
  const daysSinceLastSeen = stats.lastSeenAt
    ? Math.max(0, Math.floor((nowMs - stats.lastSeenAt.getTime()) / DAY_MS))
    : Infinity;

  if (total === 0) {
    return {
      score: 0,
      tier: "NEW",
      breakdown: {
        volume: 0,
        anchored: 0,
        approvalRatio: 0,
        blockPenalty: 0,
        longevity: 0,
        recency: 0,
      },
      ratios: { approved: 0, blocked: 0, anchored: 0 },
      daysActive: 0,
      daysSinceLastSeen: 0,
    };
  }

  const approvedRatio = approved / total;
  const blockedRatio = blocked / total;
  const anchoredRatio = anchored / total;

  // Volume signal: enough receipts to evaluate at all.
  // Below 5 receipts the score is mostly noise — keep it low.
  let volume = 0;
  if (total >= 100) volume = 25;
  else if (total >= 25) volume = 15;
  else if (total >= 5) volume = 5;

  // Anchored ratio — onchain anchor is the strongest "real proof" signal.
  // 100% anchored = +20. Linear.
  const anchoredPts = Math.round(20 * anchoredRatio);

  // Approval ratio — quadratic so very-approved is rewarded but low-approved
  // doesn't pile up. Caps at +25.
  const approvalPts = Math.round(25 * approvedRatio * approvedRatio);

  // Block penalty — linear up to 50% blocked, then flatlines at -20.
  const blockPenalty = -Math.round(20 * Math.min(blockedRatio, 0.5) * 2);

  // Longevity — agent has been around for a while.
  let longevity = 0;
  if (daysActive >= 30) longevity = 15;
  else if (daysActive >= 7) longevity = 8;
  else if (daysActive >= 1) longevity = 3;

  // Recency — penalize stale (no activity in 60+ days), reward recent.
  let recency = 0;
  if (daysSinceLastSeen <= 7) recency = 10;
  else if (daysSinceLastSeen <= 30) recency = 4;
  else if (daysSinceLastSeen > 60) recency = -10;

  const raw = volume + anchoredPts + approvalPts + blockPenalty + longevity + recency;
  const score = clamp(Math.round(raw), 0, 100);

  // Tier gate: below 5 receipts the score is noise; everyone is NEW.
  // This stops a single approved receipt from minting an EMERGING tier.
  let tier: ReputationTier = "NEW";
  if (total >= 5) {
    if (score >= 80) tier = "TRUSTED";
    else if (score >= 60) tier = "ACTIVE";
    else if (score >= 30) tier = "EMERGING";
  }

  return {
    score,
    tier,
    breakdown: {
      volume,
      anchored: anchoredPts,
      approvalRatio: approvalPts,
      blockPenalty,
      longevity,
      recency,
    },
    ratios: {
      approved: approvedRatio,
      blocked: blockedRatio,
      anchored: anchoredRatio,
    },
    daysActive,
    daysSinceLastSeen: stats.lastSeenAt ? daysSinceLastSeen : 0,
  };
}
