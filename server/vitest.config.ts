import { defineConfig } from "vitest/config";

export const TEST_ENV = { DATABASE_URL: "file:./test.db" };

export default defineConfig({
  test: {
    env: TEST_ENV,
    globalSetup: "./test/globalSetup.ts",
    // The API tests share one SQLite database.
    fileParallelism: false,
  },
});
