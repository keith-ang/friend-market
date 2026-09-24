import { createApp } from "./app";
import { prisma } from "./db";

const port = Number(process.env.PORT ?? 3001);
createApp(prisma).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
