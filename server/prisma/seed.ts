import { PrismaClient } from "@prisma/client";
import {
  createGroup,
  createPrediction,
  findOrCreateMember,
  placeBet,
  resolvePrediction,
  type Actor,
} from "../src/market";

const db = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);

/** Creates a group with fixed code and members; returns name -> actor. */
async function seedGroup(groupName: string, code: string, names: string[]) {
  const [first, ...rest] = names;
  const { group, member } = await createGroup(db, { groupName, memberName: first, code });
  const m: Record<string, Actor> = { [first]: member };
  for (const name of rest) m[name] = await findOrCreateMember(db, group.id, name);
  return m;
}

async function main() {
  await db.bet.deleteMany();
  await db.prediction.deleteMany();
  await db.session.deleteMany();
  await db.member.deleteMany();
  await db.group.deleteMany();

  // Seed through the same rules the API uses, so balances and payouts stay consistent.
  const m = await seedGroup("Dinner Club", "dinner-club", ["Priya", "Sam", "Alex", "Jordan", "Mei", "Ravi"]);

  const late = await createPrediction(db, m.Priya, {
    title: "Sam will be late to Friday dinner",
    description: "Late means arriving more than 10 minutes after the booking time.",
    closesAt: inDays(2),
  });
  await placeBet(db, m.Alex, late.id, "YES", 100);
  await placeBet(db, m.Jordan, late.id, "YES", 50);
  await placeBet(db, m.Sam, late.id, "NO", 200);
  await placeBet(db, m.Mei, late.id, "YES", 80);
  await placeBet(db, m.Priya, late.id, "YES", 40);

  const marathon = await createPrediction(db, m.Alex, {
    title: "Jordan finishes the marathon in under 4 hours",
    description: "Official chip time counts.",
    closesAt: inDays(10),
  });
  await placeBet(db, m.Jordan, marathon.id, "YES", 150);
  await placeBet(db, m.Ravi, marathon.id, "NO", 60);
  await placeBet(db, m.Priya, marathon.id, "NO", 40);

  const picnic = await createPrediction(db, m.Mei, {
    title: "It will rain during Saturday's picnic",
    description: "",
    closesAt: null,
  });
  await placeBet(db, m.Ravi, picnic.id, "YES", 30);
  await placeBet(db, m.Sam, picnic.id, "NO", 50);

  await createPrediction(db, m.Jordan, {
    title: "Alex replies to the group chat within an hour today",
    description: "",
    closesAt: null,
  });

  const cook = await createPrediction(db, m.Sam, {
    title: "Ravi will actually cook dinner this week",
    description: "Instant noodles don't count.",
    closesAt: null,
  });
  await placeBet(db, m.Priya, cook.id, "NO", 100);
  await placeBet(db, m.Mei, cook.id, "NO", 50);
  await placeBet(db, m.Ravi, cook.id, "YES", 120);
  await resolvePrediction(db, m.Sam, cook.id, "YES");

  // A second group, to show groups can't see each other. It has its own "Sam".
  const o = await seedGroup("Office Crew", "office-crew", ["Dana", "Sam", "Lee"]);
  const standup = await createPrediction(db, o.Dana, {
    title: "Monday standup finishes in under 15 minutes",
    description: "",
    closesAt: inDays(4),
  });
  await placeBet(db, o.Sam, standup.id, "NO", 70);
  await placeBet(db, o.Lee, standup.id, "YES", 30);

  console.log("Seeded Dinner Club (code dinner-club) and Office Crew (code office-crew).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
