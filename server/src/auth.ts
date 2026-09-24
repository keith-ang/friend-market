import { createHash, randomBytes } from "node:crypto";
import type { Group, Member, PrismaClient } from "@prisma/client";
import type { RequestHandler, Response } from "express";
import { HttpError } from "./errors";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(db: PrismaClient, memberId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: hashToken(token), memberId } });
  return token;
}

export async function endSession(db: PrismaClient, token: string) {
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export function bearerToken(header: string | undefined): string | undefined {
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
}

export type CurrentMember = Member & { group: Group };

export function requireMember(db: PrismaClient): RequestHandler {
  return async (req, res, next) => {
    const token = bearerToken(req.get("authorization"));
    if (!token) throw new HttpError(401, "Join a group to continue");
    const session = await db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { member: { include: { group: true } } },
    });
    if (!session) throw new HttpError(401, "Your session has ended. Join the group again");
    res.locals.member = session.member;
    res.locals.token = token;
    next();
  };
}

export function currentMember(res: Response): CurrentMember {
  return res.locals.member as CurrentMember;
}

/** The bearer token of the current request. Only valid behind requireMember. */
export function currentToken(res: Response): string {
  return res.locals.token as string;
}
