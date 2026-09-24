import { describe, expect, it } from "vitest";
import { computePayouts, estimatePayout, payoutsByMember, toSide, type Stake } from "@friend-market/shared";

const total = (payouts: Map<number, number>) => [...payouts.values()].reduce((a, b) => a + b, 0);

describe("computePayouts", () => {
  it("splits the whole pot among winners in proportion to stake", () => {
    const payouts = computePayouts(
      [
        { id: 1, side: "YES", amount: 100 },
        { id: 2, side: "YES", amount: 300 },
        { id: 3, side: "NO", amount: 400 },
      ],
      "YES",
    );
    expect(payouts.get(1)).toBe(200);
    expect(payouts.get(2)).toBe(600);
    expect(payouts.get(3)).toBe(0);
  });

  it("refunds everyone when nobody backed the winning side", () => {
    const payouts = computePayouts(
      [
        { id: 1, side: "NO", amount: 70 },
        { id: 2, side: "NO", amount: 30 },
      ],
      "YES",
    );
    expect(payouts.get(1)).toBe(70);
    expect(payouts.get(2)).toBe(30);
  });

  it("hands leftover points to the largest remainders so the pot is conserved", () => {
    const payouts = computePayouts(
      [
        { id: 1, side: "YES", amount: 1 },
        { id: 2, side: "YES", amount: 1 },
        { id: 3, side: "YES", amount: 1 },
        { id: 4, side: "NO", amount: 7 },
      ],
      "YES",
    );
    // pot 10 split three ways: 3.33 each, one leftover point to the earliest bet
    expect(payouts.get(1)).toBe(4);
    expect(payouts.get(2)).toBe(3);
    expect(payouts.get(3)).toBe(3);
    expect(total(payouts)).toBe(10);
  });

  it("conserves points for uneven splits", () => {
    const bets: Stake[] = [
      { id: 1, side: "NO", amount: 13 },
      { id: 2, side: "NO", amount: 29 },
      { id: 3, side: "YES", amount: 55 },
      { id: 4, side: "NO", amount: 7 },
    ];
    expect(total(computePayouts(bets, "NO"))).toBe(104);
    expect(total(computePayouts(bets, "YES"))).toBe(104);
  });

  it("returns nothing for a prediction with no bets", () => {
    expect(computePayouts([], "YES").size).toBe(0);
  });
});

describe("toSide", () => {
  it("accepts YES and NO and rejects anything else", () => {
    expect(toSide("YES")).toBe("YES");
    expect(toSide("NO")).toBe("NO");
    expect(() => toSide("MAYBE")).toThrow();
  });
});

describe("estimatePayout", () => {
  it("matches what computePayouts would pay if nobody else bets", () => {
    // Existing pools: 270 on YES, 200 on NO. A new 50 on YES: 50 * 520 / 320 = 81.25
    expect(estimatePayout(270, 200, "YES", 50)).toBe(81);
    const payouts = computePayouts(
      [
        { id: 1, side: "YES", amount: 270 },
        { id: 2, side: "NO", amount: 200 },
        { id: 3, side: "YES", amount: 50 },
      ],
      "YES",
    );
    expect(Math.abs(payouts.get(3)! - estimatePayout(270, 200, "YES", 50))).toBeLessThanOrEqual(1);
  });

  it("returns the stake when the pot is empty or only your side has points", () => {
    expect(estimatePayout(0, 0, "NO", 30)).toBe(30);
    expect(estimatePayout(0, 100, "NO", 25)).toBe(25);
  });

  it("returns 0 for non-positive amounts", () => {
    expect(estimatePayout(10, 10, "YES", 0)).toBe(0);
    expect(estimatePayout(10, 10, "YES", -5)).toBe(0);
  });
});

describe("payoutsByMember", () => {
  it("sums each member's bets, and covers members who would get nothing", () => {
    const bets = [
      { id: 1, memberId: 7, side: "YES" as const, amount: 100 },
      { id: 2, memberId: 7, side: "NO" as const, amount: 50 },
      { id: 3, memberId: 8, side: "NO" as const, amount: 150 },
    ];
    const ifYes = payoutsByMember(bets, "YES");
    expect(ifYes.get(7)).toBe(300);
    expect(ifYes.get(8)).toBe(0);
    const ifNo = payoutsByMember(bets, "NO");
    expect(ifNo.get(7)).toBe(75);
    expect(ifNo.get(8)).toBe(225);
  });
});
