import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { createSession, currentMember, currentToken, endSession, requireMember } from "./auth";
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
import {
  betBody,
  codeBody,
  createGroupBody,
  idParam,
  joinBody,
  predictionBody,
  resolveBody,
} from "./schemas";
import { predictionInclude, toDetail, toMe, toMember, toSummaries } from "./views";

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

  router.post("/logout", async (_req, res) => {
    await endSession(db, currentToken(res));
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
    const { groupId } = currentMember(res);
    const [predictions, totals] = await Promise.all([
      db.prediction.findMany({
        where: { groupId },
        include: { creator: { select: { id: true, name: true } } },
        orderBy: { id: "desc" },
      }),
      db.bet.groupBy({
        by: ["predictionId", "memberId", "side"],
        where: { prediction: { groupId } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);
    res.json(
      toSummaries(
        predictions,
        totals.map((t) => ({
          predictionId: t.predictionId,
          memberId: t.memberId,
          side: t.side,
          amount: t._sum.amount ?? 0,
          count: t._count._all,
        })),
      ),
    );
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
