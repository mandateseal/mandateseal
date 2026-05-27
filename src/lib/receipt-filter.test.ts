import { describe, expect, it } from "vitest";
import { parseReceiptFilter, toPrismaWhere } from "./receipt-filter";

describe("parseReceiptFilter", () => {
  it("accepts empty params", () => {
    const r = parseReceiptFilter(new URLSearchParams());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.filter).toEqual({});
  });

  it("rejects invalid decision enum", () => {
    const r = parseReceiptFilter(new URLSearchParams("decision=ROCKETSHIP"));
    expect(r.ok).toBe(false);
  });

  it("treats 'all'/'any'/'' as unset", () => {
    const r = parseReceiptFilter(new URLSearchParams("decision=all&tool=&q=any"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filter.decision).toBeUndefined();
      expect(r.filter.tool).toBeUndefined();
      expect(r.filter.q).toBeUndefined();
    }
  });

  it("coerces numeric fields", () => {
    const r = parseReceiptFilter(new URLSearchParams("costMin=1.5&limit=20&offset=10"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filter.costMin).toBe(1.5);
      expect(r.filter.limit).toBe(20);
      expect(r.filter.offset).toBe(10);
    }
  });

  it("parses ISO dates into Date", () => {
    const r = parseReceiptFilter(
      new URLSearchParams("from=2026-05-27T00:00:00Z&to=2026-05-28T00:00:00Z"),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filter.from).toBeInstanceOf(Date);
      expect(r.filter.to).toBeInstanceOf(Date);
    }
  });

  it("rejects unparseable dates", () => {
    const r = parseReceiptFilter(new URLSearchParams("from=not-a-date"));
    expect(r.ok).toBe(false);
  });
});

describe("toPrismaWhere", () => {
  it("returns empty where for empty filter", () => {
    expect(toPrismaWhere({})).toEqual({});
  });

  it("maps simple equality filters", () => {
    const w = toPrismaWhere({ agentId: "a1", decision: "BLOCKED", tool: "x" });
    expect(w.agentId).toBe("a1");
    expect(w.decision).toBe("BLOCKED");
    expect(w.tool).toBe("x");
  });

  it("builds timestamp range from from/to", () => {
    const from = new Date("2026-05-27T00:00:00Z");
    const to = new Date("2026-05-28T00:00:00Z");
    const w = toPrismaWhere({ from, to }) as { timestamp: { gte?: Date; lte?: Date } };
    expect(w.timestamp.gte).toBe(from);
    expect(w.timestamp.lte).toBe(to);
  });

  it("builds q as OR across reason / matchedRule / target / actionType / tool", () => {
    const w = toPrismaWhere({ q: "wallet" }) as { OR: Array<Record<string, unknown>> };
    expect(Array.isArray(w.OR)).toBe(true);
    expect(w.OR.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(w.OR)).toContain("wallet");
  });
});
