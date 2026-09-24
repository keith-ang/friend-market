import express, { type ErrorRequestHandler } from "express";
import type { PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { HttpError } from "./errors";
import { createRouter } from "./routes";

const handleErrors: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? "Invalid request" });
  } else if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
  } else if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body must be valid JSON" });
  } else {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
};

export function createApp(db: PrismaClient) {
  const app = express();
  app.use(express.json());
  app.use("/api", createRouter(db));
  app.use(handleErrors);
  return app;
}
