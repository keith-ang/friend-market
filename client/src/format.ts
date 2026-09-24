import { estimatePayout as estimateFromPools } from "@friend-market/shared";
import type { PredictionSummary, Side } from "./types";

export const points = (n: number) => `${n.toLocaleString()} pts`;

/** Implied YES probability, 0–100. An empty pot reads as a coin flip. */
export function yesPercent(p: Pick<PredictionSummary, "yesPool" | "noPool">): number {
  const pot = p.yesPool + p.noPool;
  return pot === 0 ? 50 : Math.round((p.yesPool / pot) * 100);
}

/** What a new bet would pay back if its side wins and nobody else bets. */
export function estimatePayout(p: PredictionSummary, side: Side, amount: number): number {
  return estimateFromPools(p.yesPool, p.noPool, side, amount);
}

const dateTime = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export const formatDate = (iso: string) => dateTime.format(new Date(iso));

export function statusLabel(p: PredictionSummary): string {
  if (p.status === "RESOLVED") return `Resolved ${p.outcome}`;
  if (p.status === "CLOSED") return "Awaiting result";
  return p.closesAt ? `Closes ${formatDate(p.closesAt)}` : "Open until resolved";
}
