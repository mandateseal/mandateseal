import { describe, expect, it } from "vitest";
import { canonicalize } from "./canonical";

describe("canonicalize", () => {
  it("returns primitives unchanged", () => {
    expect(canonicalize("hello")).toBe(JSON.stringify("hello"));
    expect(canonicalize(42)).toBe(JSON.stringify(42));
    expect(canonicalize(null)).toBe(JSON.stringify(null));
    expect(canonicalize(true)).toBe(JSON.stringify(true));
  });

  it("sorts object keys alphabetically at every nesting level", () => {
    const a = canonicalize({ b: 2, a: 1, c: { z: 9, y: 8 } });
    const b = canonicalize({ a: 1, b: 2, c: { y: 8, z: 9 } });
    expect(a).toBe(b);
    expect(a).toBe('{"a":1,"b":2,"c":{"y":8,"z":9}}');
  });

  it("preserves array order", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
    expect(canonicalize([{ b: 2, a: 1 }, { d: 4, c: 3 }])).toBe('[{"a":1,"b":2},{"c":3,"d":4}]');
  });

  it("drops undefined values but keeps nulls", () => {
    const out = canonicalize({ a: undefined, b: null, c: 1 });
    expect(out).toBe('{"b":null,"c":1}');
  });

  it("produces byte-identical output for logically equal payloads (the hashing contract)", () => {
    const p1 = { agent: "x", action: { tool: "t", cost: 0.02 }, decision: "APPROVED" };
    const p2 = { decision: "APPROVED", action: { cost: 0.02, tool: "t" }, agent: "x" };
    expect(canonicalize(p1)).toBe(canonicalize(p2));
  });
});
