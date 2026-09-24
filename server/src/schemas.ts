import { z } from "zod";
import { LIMITS, SIDES } from "@friend-market/shared";

const memberName = z
  .string()
  .trim()
  .min(1, "Enter your name")
  .max(LIMITS.memberName.max, `Names can be at most ${LIMITS.memberName.max} characters`);

export const codeBody = z.object({ code: z.string().trim().min(1, "Enter the group code") });

export const joinBody = codeBody.extend({ name: memberName });

export const createGroupBody = z.object({
  groupName: z
    .string()
    .trim()
    .min(1, "Give your group a name")
    .max(LIMITS.groupName.max, `Keep the group name under ${LIMITS.groupName.max} characters`),
  name: memberName,
});

export const predictionBody = z.object({
  title: z
    .string()
    .trim()
    .min(LIMITS.title.min, `The prediction needs at least ${LIMITS.title.min} characters`)
    .max(LIMITS.title.max, `Keep the prediction under ${LIMITS.title.max} characters`),
  description: z
    .string()
    .trim()
    .max(LIMITS.description.max, `Keep the description under ${LIMITS.description.max} characters`)
    .default(""),
  closesAt: z.string().datetime({ message: "Invalid deadline" }).nullish(),
});

export const betBody = z.object({
  side: z.enum(SIDES, { message: "Pick YES or NO" }),
  amount: z
    .number({ message: "Enter an amount" })
    .int("Bets must be whole points")
    .positive("Bets must be at least 1 point"),
});

export const resolveBody = z.object({ outcome: z.enum(SIDES, { message: "Pick YES or NO" }) });

export const idParam = z.coerce.number().int().positive();
