import { describe, expect, it } from "vitest";
import { isBettingClosed } from "../src/market";
import { statusOf } from "../src/views";

const now = new Date("2026-09-24T12:00:00Z");
const prediction = (closesAt: Date | null, outcome: string | null = null) => ({
  id: 1,
  groupId: 1,
  title: "t",
  description: "",
  closesAt,
  creatorId: 1,
  outcome,
  createdAt: now,
  resolvedAt: null,
});

describe("isBettingClosed", () => {
  it("stays open without a deadline", () => {
    expect(isBettingClosed({ closesAt: null }, now)).toBe(false);
  });

  it("closes exactly at the deadline", () => {
    expect(isBettingClosed({ closesAt: new Date(now.getTime() + 1) }, now)).toBe(false);
    expect(isBettingClosed({ closesAt: now }, now)).toBe(true);
    expect(isBettingClosed({ closesAt: new Date(now.getTime() - 1) }, now)).toBe(true);
  });
});

describe("statusOf", () => {
  it("derives OPEN, CLOSED and RESOLVED from the same deadline rule", () => {
    expect(statusOf(prediction(null), now)).toBe("OPEN");
    expect(statusOf(prediction(new Date(now.getTime() + 1000)), now)).toBe("OPEN");
    expect(statusOf(prediction(now), now)).toBe("CLOSED");
    expect(statusOf(prediction(now, "YES"), now)).toBe("RESOLVED");
  });
});
