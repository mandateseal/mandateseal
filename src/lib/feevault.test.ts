import { describe, expect, it } from "vitest";
import { creditsFromDeposited } from "./feevault";

const e18 = (n: number | bigint) => BigInt(n) * 10n ** 18n;

describe("creditsFromDeposited", () => {
  it("zero deposited → zero credits", () => {
    expect(creditsFromDeposited(0n, 1)).toBe(0);
  });

  it("1 credit per whole token (rate 1)", () => {
    expect(creditsFromDeposited(e18(100), 1)).toBe(100);
  });

  it("fractional rate < 1 (e.g. 0.5 credit/token)", () => {
    expect(creditsFromDeposited(e18(100), 0.5)).toBe(50);
  });

  it("cheap-token rate (0.001 credit/token → 1000 $SEAL per credit)", () => {
    expect(creditsFromDeposited(e18(1000), 0.001)).toBe(1);
  });

  it("sub-token dust floors to 0 (whole-token granularity)", () => {
    expect(creditsFromDeposited(5n * 10n ** 17n, 1)).toBe(0); // 0.5 token
  });

  it("zero / negative rate → 0", () => {
    expect(creditsFromDeposited(e18(100), 0)).toBe(0);
    expect(creditsFromDeposited(e18(100), -1)).toBe(0);
  });

  it("large supply stays exact (no float overflow)", () => {
    expect(creditsFromDeposited(e18(1_000_000_000), 1)).toBe(1_000_000_000);
  });
});
