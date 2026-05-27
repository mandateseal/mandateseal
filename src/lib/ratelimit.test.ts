import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, _resetRateLimitState, clientIp } from "./ratelimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    _resetRateLimitState();
    vi.useRealTimers();
  });

  it("allows up to the limit then 429s", () => {
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit("k", { limit: 5, windowMs: 60_000 });
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(4 - i);
    }
    const blocked = checkRateLimit("k", { limit: 5, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates buckets by key", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("a", { limit: 3, windowMs: 60_000 });
    const blockedA = checkRateLimit("a", { limit: 3, windowMs: 60_000 });
    expect(blockedA.allowed).toBe(false);

    const allowedB = checkRateLimit("b", { limit: 3, windowMs: 60_000 });
    expect(allowedB.allowed).toBe(true);
  });

  it("expires hits past the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    for (let i = 0; i < 3; i++) checkRateLimit("k", { limit: 3, windowMs: 1000 });
    expect(checkRateLimit("k", { limit: 3, windowMs: 1000 }).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:00:01.500Z"));
    const r = checkRateLimit("k", { limit: 3, windowMs: 1000 });
    expect(r.allowed).toBe(true);
  });

  it("retryAfterMs decreases as window slides", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    for (let i = 0; i < 5; i++) checkRateLimit("k", { limit: 5, windowMs: 60_000 });

    vi.setSystemTime(new Date("2026-01-01T00:00:20Z"));
    const r = checkRateLimit("k", { limit: 5, windowMs: 60_000 });
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeLessThanOrEqual(40_000);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it("limit of 0 always blocks", () => {
    const r = checkRateLimit("k", { limit: 0, windowMs: 1000 });
    expect(r.allowed).toBe(false);
  });
});

describe("clientIp", () => {
  it("reads x-forwarded-for first entry", () => {
    const req = new Request("https://x/", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("https://x/", { headers: { "x-real-ip": "203.0.113.8" } });
    expect(clientIp(req)).toBe("203.0.113.8");
  });

  it("returns 'unknown' when no header is present", () => {
    const req = new Request("https://x/");
    expect(clientIp(req)).toBe("unknown");
  });
});
