import { Prisma, type PrismaClient } from "@prisma/client";
import { computePayouts, MAX_MEMBERS, STARTING_BALANCE, toSide, type Side } from "@friend-market/shared";
import { generateInviteCode } from "./codes";
import { HttpError } from "./errors";

/** Who is acting: every rule is scoped to the acting member's group. */
export interface Actor {
  id: number;
  groupId: number;
}

/** True once the betting deadline has passed. Resolution also ends betting, and is checked separately. */
export function isBettingClosed(prediction: { closesAt: Date | null }, now = new Date()): boolean {
  return prediction.closesAt !== null && prediction.closesAt <= now;
}

// Each rule that touches balances runs in one transaction and writes before it
// checks: the first write takes SQLite's write lock, so nothing can change the
// prediction between the check and the rest of the transaction.

export async function createGroup(
  db: PrismaClient,
  input: { groupName: string; memberName: string; code?: string },
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const group = await tx.group.create({
          data: { name: input.groupName, code: input.code ?? generateInviteCode() },
        });
        const member = await tx.member.create({
          data: { groupId: group.id, name: input.memberName, balance: STARTING_BALANCE },
        });
        return { group, member };
      });
    } catch (err) {
      const codeTaken =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && !input.code;
      if (!codeTaken) throw err;
    }
  }
  throw new Error("Could not generate a unique invite code");
}

export async function findOrCreateMember(db: PrismaClient, groupId: number, name: string) {
  const members = await db.member.findMany({ where: { groupId } });
  const existing = members.find((m) => m.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;

  return db.$transaction(async (tx) => {
    const member = await tx.member.create({ data: { groupId, name, balance: STARTING_BALANCE } });
    if ((await tx.member.count({ where: { groupId } })) > MAX_MEMBERS) {
      throw new HttpError(409, `The group is full (${MAX_MEMBERS} members max)`);
    }
    return member;
  });
}

export async function createPrediction(
  db: PrismaClient,
  creator: Actor,
  input: { title: string; description: string; closesAt: Date | null },
) {
  if (input.closesAt && input.closesAt <= new Date()) {
    throw new HttpError(400, "The betting deadline must be in the future");
  }
  return db.prediction.create({
    data: { ...input, creatorId: creator.id, groupId: creator.groupId },
  });
}

/** Throws 404 for a missing prediction or one in another group: groups can't see each other. */
function assertVisible(
  prediction: { groupId: number } | null,
  actor: Actor,
): asserts prediction is NonNullable<typeof prediction> {
  if (!prediction || prediction.groupId !== actor.groupId) {
    throw new HttpError(404, "Prediction not found");
  }
}

export async function cancelPrediction(db: PrismaClient, actor: Actor, predictionId: number) {
  const { count } = await db.prediction.deleteMany({
    where: { id: predictionId, creatorId: actor.id, outcome: null, bets: { none: {} } },
  });
  if (count === 1) return;

  const prediction = await db.prediction.findUnique({ where: { id: predictionId } });
  assertVisible(prediction, actor);
  if (prediction.creatorId !== actor.id) {
    throw new HttpError(403, "Only the creator can cancel this prediction");
  }
  if (prediction.outcome) throw new HttpError(409, "This prediction has already been resolved");
  throw new HttpError(409, "You can't cancel a prediction once someone has bet on it");
}

export async function placeBet(
  db: PrismaClient,
  actor: Actor,
  predictionId: number,
  side: Side,
  amount: number,
) {
  return db.$transaction(async (tx) => {
    const debit = await tx.member.updateMany({
      where: { id: actor.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (debit.count === 0) throw new HttpError(400, "You don't have enough points");

    const prediction = await tx.prediction.findUnique({ where: { id: predictionId } });
    assertVisible(prediction, actor);
    if (prediction.outcome) throw new HttpError(409, "This prediction has already been resolved");
    if (isBettingClosed(prediction)) {
      throw new HttpError(409, "Betting has closed on this prediction");
    }

    return tx.bet.create({ data: { memberId: actor.id, predictionId, side, amount } });
  });
}

export async function resolvePrediction(
  db: PrismaClient,
  actor: Actor,
  predictionId: number,
  outcome: Side,
) {
  await db.$transaction(async (tx) => {
    const claimed = await tx.prediction.updateMany({
      where: { id: predictionId, creatorId: actor.id, outcome: null },
      data: { outcome, resolvedAt: new Date() },
    });
    if (claimed.count === 0) {
      const prediction = await tx.prediction.findUnique({ where: { id: predictionId } });
      assertVisible(prediction, actor);
      if (prediction.creatorId !== actor.id) {
        throw new HttpError(403, "Only the creator can resolve this prediction");
      }
      throw new HttpError(409, "This prediction has already been resolved");
    }

    const bets = await tx.bet.findMany({ where: { predictionId } });
    const payouts = computePayouts(
      bets.map((b) => ({ id: b.id, side: toSide(b.side), amount: b.amount })),
      outcome,
    );
    const credits = new Map<number, number>();
    for (const bet of bets) {
      const payout = payouts.get(bet.id) ?? 0;
      await tx.bet.update({ where: { id: bet.id }, data: { payout } });
      credits.set(bet.memberId, (credits.get(bet.memberId) ?? 0) + payout);
    }
    for (const [id, points] of credits) {
      if (points > 0) {
        await tx.member.update({ where: { id }, data: { balance: { increment: points } } });
      }
    }
  });
}
