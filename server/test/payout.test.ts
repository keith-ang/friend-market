import { describe, expect, it } from "vitest";
import { computePayouts, toSide, type Stake } from "../src/payout";

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
