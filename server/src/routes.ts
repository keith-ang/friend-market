import { Router } from "express";
import type { Group, Member, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { bearerToken, createSession, currentMember, endSession, requireMember } from "./auth";
import { normalizeCode } from "./codes";
import { HttpError } from "./errors";
import {
  cancelPrediction,
  createGroup,
  createPrediction,
  findOrCreateMember,
  MAX_MEMBERS,
  placeBet,
  resolvePrediction,
} from "./market";
import { SIDES } from "./payout";

const memberName = z
  .string()
  .trim()
  .min(1, "Enter your name")
  .max(30, "Names can be at most 30 characters");

const codeBody = z.object({ code: z.string().trim().min(1, "Enter the group code") });

const joinBody = codeBody.extend({ name: memberName });

const createGroupBody = z.object({
  groupName: z
    .string()
    .trim()
    .min(1, "Give your group a name")
    .max(40, "Keep the group name under 40 characters"),
  name: memberName,
});

const predictionBody = z.object({
  title: z
    .string()
    .trim()
    .min(3, "The prediction needs at least 3 characters")
    .max(140, "Keep the prediction under 140 characters"),
  description: z.string().trim().max(1000, "Keep the description under 1000 characters").default(""),
  closesAt: z.string().datetime({ message: "Invalid deadline" }).nullish(),
});

const betBody = z.object({
  side: z.enum(SIDES, { message: "Pick YES or NO" }),
  amount: z
    .number({ message: "Enter an amount" })
    .int("Bets must be whole points")
    .positive("Bets must be at least 1 point"),
});

const resolveBody = z.object({ outcome: z.enum(SIDES, { message: "Pick YES or NO" }) });

const idParam = z.coerce.number().int().positive();

const predictionInclude = {
  creator: { select: { id: true, name: true } },
  bets: { include: { member: { select: { id: true, name: true } } }, orderBy: { id: "desc" } },
} satisfies Prisma.PredictionInclude;

type PredictionRow = Prisma.PredictionGetPayload<{ include: typeof predictionInclude }>;

function statusOf(p: PredictionRow) {
  if (p.outcome) return "RESOLVED";
  if (p.closesAt && p.closesAt <= new Date()) return "CLOSED";
  return "OPEN";
}

function toSummary(p: PredictionRow) {
  let yesPool = 0;
  let noPool = 0;
  let creatorStake = 0;
  for (const bet of p.bets) {
    if (bet.side === "YES") yesPool += bet.amount;
    else noPool += bet.amount;
    if (bet.memberId === p.creatorId) creatorStake += bet.amount;
  }
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
    yesPool,
    noPool,
    betCount: p.bets.length,
    creatorStake,
  };
}

function toDetail(p: PredictionRow) {
  return {
    ...toSummary(p),
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

function toMember(m: Member) {
  return { id: m.id, name: m.name, balance: m.balance };
}

/** The signed-in member, with the group they belong to (for sharing the invite code). */
function toMe(m: Member, group: Group) {
  return { ...toMember(m), group: { name: group.name, code: group.code } };
}

export function createRouter(db: PrismaClient) {
  const router = Router();

  async function groupByCode(code: string) {
    const group = await db.group.findUnique({ where: { code: normalizeCode(code) } });
    if (!group) throw new HttpError(404, "No group has that code. Check it with a friend");
    return group;
  }

  async function loadPrediction(id: number, groupId: number) {
    const prediction = await db.prediction.findFirst({
      where: { id, groupId },
      include: predictionInclude,
    });
    if (!prediction) throw new HttpError(404, "Prediction not found");
    return prediction;
  }

  router.post("/groups", async (req, res) => {
    const { groupName, name } = createGroupBody.parse(req.body);
    const { group, member } = await createGroup(db, { groupName, memberName: name });
    const token = await createSession(db, member.id);
    res.status(201).json({ token, member: toMe(member, group) });
  });

  // Names for the join screen's picker; knowing the code is what lets you in.
  router.post("/roster", async (req, res) => {
    const group = await groupByCode(codeBody.parse(req.body).code);
    const members = await db.member.findMany({
      where: { groupId: group.id },
      orderBy: { name: "asc" },
      select: { name: true },
    });
    res.json({
      groupName: group.name,
      names: members.map((m) => m.name),
      full: members.length >= MAX_MEMBERS,
    });
  });

  router.post("/join", async (req, res) => {
    const { code, name } = joinBody.parse(req.body);
    const group = await groupByCode(code);
    const member = await findOrCreateMember(db, group.id, name);
    const token = await createSession(db, member.id);
    res.status(201).json({ token, member: toMe(member, group) });
  });

  // Everything below needs a signed-in member, and only sees that member's group.
  router.use(requireMember(db));

  router.post("/logout", async (req, res) => {
    await endSession(db, bearerToken(req.get("authorization"))!);
    res.status(204).end();
  });

  router.get("/me", (_req, res) => {
    const me = currentMember(res);
    res.json(toMe(me, me.group));
  });

  router.get("/members", async (_req, res) => {
    const { groupId } = currentMember(res);
    const [members, inPlay] = await Promise.all([
      db.member.findMany({ where: { groupId }, orderBy: { name: "asc" } }),
      db.bet.groupBy({
        by: ["memberId"],
        where: { payout: null, member: { groupId } },
        _sum: { amount: true },
      }),
    ]);
    const inPlayByMember = new Map(inPlay.map((row) => [row.memberId, row._sum.amount ?? 0]));
    res.json(members.map((m) => ({ ...toMember(m), inPlay: inPlayByMember.get(m.id) ?? 0 })));
  });

  router.get("/predictions", async (_req, res) => {
    const predictions = await db.prediction.findMany({
      where: { groupId: currentMember(res).groupId },
      include: predictionInclude,
      orderBy: { id: "desc" },
    });
    res.json(predictions.map(toSummary));
  });

  router.get("/predictions/:id", async (req, res) => {
    res.json(toDetail(await loadPrediction(idParam.parse(req.params.id), currentMember(res).groupId)));
  });

  router.post("/predictions", async (req, res) => {
    const me = currentMember(res);
    const body = predictionBody.parse(req.body);
    const created = await createPrediction(db, me, {
      title: body.title,
      description: body.description,
      closesAt: body.closesAt ? new Date(body.closesAt) : null,
    });
    res.status(201).json(toDetail(await loadPrediction(created.id, me.groupId)));
  });

  router.delete("/predictions/:id", async (req, res) => {
    await cancelPrediction(db, currentMember(res), idParam.parse(req.params.id));
    res.status(204).end();
  });

  router.post("/predictions/:id/bets", async (req, res) => {
    const me = currentMember(res);
    const id = idParam.parse(req.params.id);
    const { side, amount } = betBody.parse(req.body);
    await placeBet(db, me, id, side, amount);
    res.status(201).json(toDetail(await loadPrediction(id, me.groupId)));
  });

  router.post("/predictions/:id/resolve", async (req, res) => {
    const me = currentMember(res);
    const id = idParam.parse(req.params.id);
    const { outcome } = resolveBody.parse(req.body);
    await resolvePrediction(db, me, id, outcome);
    res.json(toDetail(await loadPrediction(id, me.groupId)));
  });

  return router;
}
