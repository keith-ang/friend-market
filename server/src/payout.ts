export const SIDES = ["YES", "NO"] as const;
export type Side = (typeof SIDES)[number];

export interface Stake {
  id: number;
  side: string;
  amount: number;
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

function sum(bets: Stake[]): number {
  return bets.reduce((acc, b) => acc + b.amount, 0);
}
