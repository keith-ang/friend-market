import { z } from "zod";
import { SIDES } from "./payout";

const memberName = z
  .string()
  .trim()
  .min(1, "Enter your name")
  .max(30, "Names can be at most 30 characters");

export const codeBody = z.object({ code: z.string().trim().min(1, "Enter the group code") });

export const joinBody = codeBody.extend({ name: memberName });

export const createGroupBody = z.object({
  groupName: z
    .string()
    .trim()
    .min(1, "Give your group a name")
    .max(40, "Keep the group name under 40 characters"),
  name: memberName,
});

export const predictionBody = z.object({
  title: z
    .string()
    .trim()
    .min(3, "The prediction needs at least 3 characters")
    .max(140, "Keep the prediction under 140 characters"),
  description: z.string().trim().max(1000, "Keep the description under 1000 characters").default(""),
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
