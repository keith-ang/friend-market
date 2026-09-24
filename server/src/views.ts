import type { Group, Member, Prediction, Prisma } from "@prisma/client";
import {
  toSide,
  type Me,
  type MemberDto,
  type PredictionDetail,
  type PredictionSummary,
  type Status,
} from "@friend-market/shared";
import { isBettingClosed } from "./market";

// Response shaping: these functions define the JSON the client receives. Their
// return types come from the shared package, so the client and server can't drift.

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
  myStake: { yes: number; no: number };
}

/** One row of `bet.groupBy({ by: ["predictionId", "memberId", "side"] })`. */
export interface StakeTotal {
  predictionId: number;
  memberId: number;
  side: string;
  amount: number;
  count: number;
}

export function statusOf(p: Prediction, now = new Date()): Status {
  if (p.outcome) return "RESOLVED";
  if (isBettingClosed(p, now)) return "CLOSED";
  return "OPEN";
}

function addStake(
  pools: Pools,
  creatorId: number,
  viewerId: number,
  stake: Omit<StakeTotal, "predictionId">,
) {
  const yes = stake.side === "YES";
  if (yes) pools.yesPool += stake.amount;
  else pools.noPool += stake.amount;
  pools.betCount += stake.count;
  if (stake.memberId === creatorId) pools.creatorStake += stake.amount;
  if (stake.memberId === viewerId) {
    if (yes) pools.myStake.yes += stake.amount;
    else pools.myStake.no += stake.amount;
  }
}

const emptyPools = (): Pools => ({
  yesPool: 0,
  noPool: 0,
  betCount: 0,
  creatorStake: 0,
  myStake: { yes: 0, no: 0 },
});

const isoOrNull = (date: Date | null) => (date ? date.toISOString() : null);

export function toSummary(p: PredictionWithCreator, pools: Pools): PredictionSummary {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    creator: p.creator,
    closesAt: isoOrNull(p.closesAt),
    createdAt: p.createdAt.toISOString(),
    resolvedAt: isoOrNull(p.resolvedAt),
    outcome: p.outcome ? toSide(p.outcome) : null,
    status: statusOf(p),
    ...pools,
  };
}

/**
 * Summaries for the list endpoint, built from per-member stake totals instead of every bet.
 * `viewerId` is the requesting member, whose own stake is reported as `myStake`.
 */
export function toSummaries(
  predictions: PredictionWithCreator[],
  totals: StakeTotal[],
  viewerId: number,
): PredictionSummary[] {
  const poolsById = new Map(predictions.map((p) => [p.id, emptyPools()]));
  const creatorById = new Map(predictions.map((p) => [p.id, p.creatorId]));
  for (const total of totals) {
    const pools = poolsById.get(total.predictionId);
    if (pools) addStake(pools, creatorById.get(total.predictionId)!, viewerId, total);
  }
  return predictions.map((p) => toSummary(p, poolsById.get(p.id)!));
}

export function toDetail(p: PredictionRow, viewerId: number): PredictionDetail {
  const pools = emptyPools();
  for (const bet of p.bets) addStake(pools, p.creatorId, viewerId, { ...bet, count: 1 });
  return {
    ...toSummary(p, pools),
    bets: p.bets.map((b) => ({
      id: b.id,
      side: toSide(b.side),
      amount: b.amount,
      payout: b.payout,
      createdAt: b.createdAt.toISOString(),
      member: b.member,
    })),
  };
}

export function toMember(m: Member): MemberDto {
  return { id: m.id, name: m.name, balance: m.balance };
}

/** The signed-in member, with the group they belong to (for sharing the invite code). */
export function toMe(m: Member, group: Group): Me {
  return { ...toMember(m), group: { name: group.name, code: group.code } };
}
