export const SIDES = ["YES", "NO"] as const;
export type Side = (typeof SIDES)[number];

/** Derived from the outcome and deadline; never stored. */
export type Status = "OPEN" | "CLOSED" | "RESOLVED";

export interface Stake {
  id: number;
  side: Side;
  amount: number;
}

/** Narrows a side read from the database, where it is stored as a plain string. */
export function toSide(value: string): Side {
  if (value === "YES" || value === "NO") return value;
  throw new Error(`Invalid side in database: ${value}`);
}

/**
 * Parimutuel payout: the winning side splits the whole pot in proportion to
 * what each bet staked. If nobody backed the winning side, every bet is
 * refunded. Returns bet id -> points paid back.
 *
 * Points are whole numbers: shares are floored, then leftover points go one at
 * a time to the bets with the largest remainders (earliest bet wins ties), so
 * the total paid out always equals the pot exactly.
 */
export function computePayouts(bets: Stake[], outcome: Side): Map<number, number> {
  const payouts = new Map<number, number>();
  const pot = sum(bets);
  const winners = bets.filter((b) => b.side === outcome);
  const winningStake = sum(winners);

  if (winningStake === 0) {
    for (const b of bets) payouts.set(b.id, b.amount);
    return payouts;
  }

  for (const b of bets) payouts.set(b.id, 0);

  const shares = winners.map((b) => ({
    id: b.id,
    whole: Math.floor((pot * b.amount) / winningStake),
    remainder: (pot * b.amount) % winningStake,
  }));
  let leftover = pot - shares.reduce((acc, s) => acc + s.whole, 0);
  shares.sort((a, b) => b.remainder - a.remainder || a.id - b.id);
  for (const s of shares) {
    payouts.set(s.id, s.whole + (leftover > 0 ? 1 : 0));
    leftover--;
  }
  return payouts;
}

/**
 * What a new bet of `amount` on `side` would pay back if that side wins and
 * nobody else bets: the same split computePayouts makes, before rounding leftovers.
 */
export function estimatePayout(yesPool: number, noPool: number, side: Side, amount: number): number {
  if (amount <= 0) return 0;
  const pot = yesPool + noPool + amount;
  const sidePool = (side === "YES" ? yesPool : noPool) + amount;
  return Math.floor((amount * pot) / sidePool);
}

function sum(bets: Stake[]): number {
  return bets.reduce((acc, b) => acc + b.amount, 0);
}
