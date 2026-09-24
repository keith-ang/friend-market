import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TEST_ENV } from "../vitest.config";

// Start each run from a fresh test.db (owned by the test suite, never the dev
// database) with all migrations applied.
export default function setup() {
  const dbFile = fileURLToPath(new URL("../prisma/test.db", import.meta.url));
  rmSync(dbFile, { force: true });
  rmSync(`${dbFile}-journal`, { force: true });
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, ...TEST_ENV },
    stdio: "inherit",
  });
}
