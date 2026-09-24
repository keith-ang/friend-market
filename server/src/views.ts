import type { Group, Member, Prediction, Prisma } from "@prisma/client";
import { isBettingClosed } from "./market";

// Response shaping: these functions define the JSON the client receives.

export const predictionInclude = {
  creator: { select: { id: true, name: true } },
  bets: { include: { member: { select: { id: true, name: true } } }, orderBy: { id: "desc" } },
} satisfies Prisma.PredictionInclude;

export type PredictionRow = Prisma.PredictionGetPayload<{ include: typeof predictionInclude }>;

type PredictionWithCreator = Prediction & { creator: { id: number; name: string } };

export interface Pools {
  yesPool: number;
  noPool: number;
  betCount: number;
  creatorStake: number;
}

/** One row of `bet.groupBy({ by: ["predictionId", "memberId", "side"] })`. */
export interface StakeTotal {
  predictionId: number;
  memberId: number;
  side: string;
  amount: number;
  count: number;
}

export function statusOf(p: Prediction, now = new Date()) {
  if (p.outcome) return "RESOLVED";
  if (isBettingClosed(p, now)) return "CLOSED";
  return "OPEN";
}

function addStake(pools: Pools, creatorId: number, stake: Omit<StakeTotal, "predictionId">) {
  if (stake.side === "YES") pools.yesPool += stake.amount;
  else pools.noPool += stake.amount;
  pools.betCount += stake.count;
  if (stake.memberId === creatorId) pools.creatorStake += stake.amount;
}

const emptyPools = (): Pools => ({ yesPool: 0, noPool: 0, betCount: 0, creatorStake: 0 });

export function toSummary(p: PredictionWithCreator, pools: Pools) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    creator: p.creator,
    closesAt: p.closesAt,
    createdAt: p.createdAt,
    resolvedAt: p.resolvedAt,
    outcome: p.outcome,
    status: statusOf(p),
    ...pools,
  };
}

/** Summaries for the list endpoint, built from per-member stake totals instead of every bet. */
export function toSummaries(predictions: PredictionWithCreator[], totals: StakeTotal[]) {
  const poolsById = new Map(predictions.map((p) => [p.id, emptyPools()]));
  const creatorById = new Map(predictions.map((p) => [p.id, p.creatorId]));
  for (const total of totals) {
    const pools = poolsById.get(total.predictionId);
    if (pools) addStake(pools, creatorById.get(total.predictionId)!, total);
  }
  return predictions.map((p) => toSummary(p, poolsById.get(p.id)!));
}

export function toDetail(p: PredictionRow) {
  const pools = emptyPools();
  for (const bet of p.bets) addStake(pools, p.creatorId, { ...bet, count: 1 });
  return {
    ...toSummary(p, pools),
    bets: p.bets.map((b) => ({
      id: b.id,
      side: b.side,
      amount: b.amount,
      payout: b.payout,
      createdAt: b.createdAt,
      member: b.member,
    })),
  };
}

export function toMember(m: Member) {
  return { id: m.id, name: m.name, balance: m.balance };
}

/** The signed-in member, with the group they belong to (for sharing the invite code). */
export function toMe(m: Member, group: Group) {
  return { ...toMember(m), group: { name: group.name, code: group.code } };
}
