import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";

const app = createApp(prisma);

/** Creates a group with `name` as its first member. */
async function startGroup(name: string, groupName = "Dinner Club") {
  const res = await request(app).post("/api/groups").send({ groupName, name });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, code: res.body.member.group.code as string };
}

async function join(code: string, name: string) {
  const res = await request(app).post("/api/join").send({ code, name });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

function as(token: string) {
  return {
    get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${token}`),
    post: (url: string, body: object = {}) =>
      request(app).post(url).set("Authorization", `Bearer ${token}`).send(body),
    delete: (url: string) => request(app).delete(url).set("Authorization", `Bearer ${token}`),
  };
}

async function balanceOf(token: string) {
  return (await as(token).get("/api/me")).body.balance as number;
}

async function newPrediction(token: string, body: object = {}) {
  const res = await as(token).post("/api/predictions", { title: "Sam will be late", ...body });
  expect(res.status).toBe(201);
  return res.body.id as number;
}

beforeEach(async () => {
  await prisma.bet.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.session.deleteMany();
  await prisma.member.deleteMany();
  await prisma.group.deleteMany();
});

afterAll(() => prisma.$disconnect());

describe("response shapes", () => {
  it("returns dates as ISO 8601 strings", async () => {
    const { token: priya } = await startGroup("Priya");
    const id = await newPrediction(priya, { closesAt: new Date(Date.now() + 86_400_000).toISOString() });
    await as(priya).post(`/api/predictions/${id}/bets`, { side: "YES", amount: 10 });
    await as(priya).post(`/api/predictions/${id}/resolve`, { outcome: "YES" });

    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    const detail = (await as(priya).get(`/api/predictions/${id}`)).body;
    expect(detail.createdAt).toMatch(iso);
    expect(detail.closesAt).toMatch(iso);
    expect(detail.resolvedAt).toMatch(iso);
    expect(detail.bets[0].createdAt).toMatch(iso);
    const [summary] = (await as(priya).get("/api/predictions")).body;
    expect(summary.createdAt).toMatch(iso);
    expect(summary.closesAt).toBe(detail.closesAt);
  });
});

describe("groups", () => {
  it("creates a group with a readable invite code and signs in its first member", async () => {
    const res = await request(app).post("/api/groups").send({ groupName: "Dinner Club", name: "Priya" });
    expect(res.status).toBe(201);
    expect(res.body.member).toMatchObject({ name: "Priya", balance: 1000, group: { name: "Dinner Club" } });
    expect(res.body.member.group.code).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
    const me = await as(res.body.token).get("/api/me");
    expect(me.body.group.code).toBe(res.body.member.group.code);
  });

  it("requires a group name and your name", async () => {
    expect((await request(app).post("/api/groups").send({ groupName: " ", name: "Priya" })).status).toBe(400);
    expect((await request(app).post("/api/groups").send({ groupName: "Club" })).status).toBe(400);
  });

  it("keeps groups apart: no reading, betting, resolving or cancelling across groups", async () => {
    const { token: priya } = await startGroup("Priya", "Dinner Club");
    const { token: dana } = await startGroup("Dana", "Office Crew");
    const id = await newPrediction(priya);

    expect((await as(dana).get("/api/predictions")).body).toEqual([]);
    expect((await as(dana).get(`/api/predictions/${id}`)).status).toBe(404);
    expect((await as(dana).post(`/api/predictions/${id}/bets`, { side: "YES", amount: 10 })).status).toBe(404);
    expect((await as(dana).post(`/api/predictions/${id}/resolve`, { outcome: "YES" })).status).toBe(404);
    expect((await as(dana).delete(`/api/predictions/${id}`)).status).toBe(404);
    expect(await balanceOf(dana)).toBe(1000);
    expect((await as(dana).get("/api/members")).body.map((m: { name: string }) => m.name)).toEqual(["Dana"]);
  });

  it("lets two groups each have a member with the same name", async () => {
    const dinner = await startGroup("Sam", "Dinner Club");
    const office = await startGroup("Priya", "Office Crew");
    const officeSam = await join(office.code, "Sam");
    const dinnerMe = await as(dinner.token).get("/api/me");
    const officeMe = await as(officeSam).get("/api/me");
    expect(dinnerMe.body.id).not.toBe(officeMe.body.id);
    expect(officeMe.body.group.name).toBe("Office Crew");
  });
});

describe("access", () => {
  it("rejects an unknown group code", async () => {
    await startGroup("Priya");
    expect((await request(app).post("/api/join").send({ code: "nope", name: "Sam" })).status).toBe(404);
    expect((await request(app).post("/api/roster").send({ code: "nope" })).status).toBe(404);
  });

  it("shows the roster for a code, ignoring case and spaces", async () => {
    const { code } = await startGroup("Priya");
    await join(code, "Sam");
    const res = await request(app).post("/api/roster").send({ code: `  ${code.toUpperCase()} ` });
    expect(res.body).toEqual({ groupName: "Dinner Club", names: ["Priya", "Sam"], full: false });
  });

  it("requires a session for reads", async () => {
    expect((await request(app).get("/api/predictions")).status).toBe(401);
    expect((await as("made-up").get("/api/predictions")).status).toBe(401);
  });

  it("signs into an existing member by name, ignoring case", async () => {
    const { code } = await startGroup("Sam");
    const token = await join(code, "sam");
    const me = await as(token).get("/api/me");
    expect(me.body).toMatchObject({ name: "Sam", balance: 1000 });
    expect((await as(token).get("/api/members")).body).toHaveLength(1);
  });

  it("caps each group at 10 members", async () => {
    const { code } = await startGroup("Friend 1");
    for (let i = 2; i <= 10; i++) await join(code, `Friend ${i}`);
    const res = await request(app).post("/api/join").send({ code, name: "Eleven" });
    expect(res.status).toBe(409);
    // Existing members can still sign in, and other groups aren't affected.
    await join(code, "Friend 3");
    await startGroup("Eleven", "Another Group");
  });

  it("ends the session on logout", async () => {
    const { token } = await startGroup("Sam");
    expect((await as(token).post("/api/logout")).status).toBe(204);
    expect((await as(token).get("/api/me")).status).toBe(401);
  });
});

describe("listing", () => {
  it("reports the same pools, bet count and creator stake as the detail view", async () => {
    const { token: priya, code } = await startGroup("Priya");
    const alex = await join(code, "Alex");
    const busy = await newPrediction(priya);
    const empty = await newPrediction(priya);
    await as(priya).post(`/api/predictions/${busy}/bets`, { side: "YES", amount: 10 });
    await as(priya).post(`/api/predictions/${busy}/bets`, { side: "YES", amount: 15 });
    await as(priya).post(`/api/predictions/${busy}/bets`, { side: "NO", amount: 5 });
    await as(alex).post(`/api/predictions/${busy}/bets`, { side: "NO", amount: 40 });

    const list = (await as(alex).get("/api/predictions")).body;
    const { bets: _bets, ...detailSummary } = (await as(alex).get(`/api/predictions/${busy}`)).body;

    expect(list.map((p: { id: number }) => p.id)).toEqual([empty, busy]);
    expect(list[1]).toEqual(detailSummary);
    expect(list[1]).toMatchObject({ yesPool: 25, noPool: 45, betCount: 4, creatorStake: 30 });
    expect(list[0]).toMatchObject({ yesPool: 0, noPool: 0, betCount: 0, creatorStake: 0, status: "OPEN" });
  });
});

describe("betting", () => {
  it("deducts points immediately and updates the pools", async () => {
    const { token: priya, code } = await startGroup("Priya");
    const alex = await join(code, "Alex");
    const id = await newPrediction(priya);

    const res = await as(alex).post(`/api/predictions/${id}/bets`, { side: "YES", amount: 150 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ yesPool: 150, noPool: 0, betCount: 1, status: "OPEN" });
    expect(await balanceOf(alex)).toBe(850);
  });

  it("allows repeat bets on both sides, including by the creator", async () => {
    const { token: priya } = await startGroup("Priya");
    const id = await newPrediction(priya);
    await as(priya).post(`/api/predictions/${id}/bets`, { side: "YES", amount: 10 });
    const res = await as(priya).post(`/api/predictions/${id}/bets`, { side: "NO", amount: 5 });
    expect(res.body).toMatchObject({ yesPool: 10, noPool: 5, creatorStake: 15 });
  });

  it("rejects bets beyond your balance and non-positive amounts", async () => {
    const { token: priya } = await startGroup("Priya");
    const id = await newPrediction(priya);
    const url = `/api/predictions/${id}/bets`;
    expect((await as(priya).post(url, { side: "YES", amount: 1001 })).status).toBe(400);
    expect((await as(priya).post(url, { side: "YES", amount: 0 })).status).toBe(400);
    expect((await as(priya).post(url, { side: "YES", amount: 2.5 })).status).toBe(400);
    expect((await as(priya).post(url, { side: "MAYBE", amount: 5 })).status).toBe(400);
    expect(await balanceOf(priya)).toBe(1000);
  });

  it("stops betting after the deadline", async () => {
    const { token: priya } = await startGroup("Priya");
    const id = await newPrediction(priya, {
      closesAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await prisma.prediction.update({ where: { id }, data: { closesAt: new Date(Date.now() - 1000) } });

    const res = await as(priya).post(`/api/predictions/${id}/bets`, { side: "YES", amount: 10 });
    expect(res.status).toBe(409);
    expect(await balanceOf(priya)).toBe(1000);
    expect((await as(priya).get(`/api/predictions/${id}`)).body.status).toBe("CLOSED");
  });

  it("rejects a deadline in the past", async () => {
    const { token: priya } = await startGroup("Priya");
    const res = await as(priya).post("/api/predictions", {
      title: "Sam will be late",
      closesAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(res.status).toBe(400);
  });
});

describe("resolving", () => {
  it("only lets the creator resolve, pays out the pot, and is final", async () => {
    const { token: priya, code } = await startGroup("Priya");
    const alex = await join(code, "Alex");
    const sam = await join(code, "Sam");
    const id = await newPrediction(priya);
    await as(alex).post(`/api/predictions/${id}/bets`, { side: "YES", amount: 100 });
    await as(sam).post(`/api/predictions/${id}/bets`, { side: "NO", amount: 300 });

    expect((await as(alex).post(`/api/predictions/${id}/resolve`, { outcome: "YES" })).status).toBe(403);

    const res = await as(priya).post(`/api/predictions/${id}/resolve`, { outcome: "YES" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ outcome: "YES", status: "RESOLVED" });
    expect(await balanceOf(alex)).toBe(1300);
    expect(await balanceOf(sam)).toBe(700);

    expect((await as(priya).post(`/api/predictions/${id}/resolve`, { outcome: "NO" })).status).toBe(409);
    expect((await as(alex).post(`/api/predictions/${id}/bets`, { side: "YES", amount: 1 })).status).toBe(409);
    expect(await balanceOf(alex)).toBe(1300);
  });

  it("can resolve before the deadline", async () => {
    const { token: priya } = await startGroup("Priya");
    const id = await newPrediction(priya, {
      closesAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect((await as(priya).post(`/api/predictions/${id}/resolve`, { outcome: "NO" })).status).toBe(200);
  });

  it("refunds everyone when nobody backed the winning side", async () => {
    const { token: priya, code } = await startGroup("Priya");
    const alex = await join(code, "Alex");
    const id = await newPrediction(priya);
    await as(alex).post(`/api/predictions/${id}/bets`, { side: "NO", amount: 250 });
    await as(priya).post(`/api/predictions/${id}/resolve`, { outcome: "YES" });
    expect(await balanceOf(alex)).toBe(1000);
  });

  it("reports in-play points until resolution", async () => {
    const { token: priya, code } = await startGroup("Priya");
    const alex = await join(code, "Alex");
    const id = await newPrediction(priya);
    await as(alex).post(`/api/predictions/${id}/bets`, { side: "NO", amount: 40 });
    const inPlay = async () =>
      (await as(alex).get("/api/members")).body.find((m: { name: string }) => m.name === "Alex").inPlay;
    expect(await inPlay()).toBe(40);
    await as(priya).post(`/api/predictions/${id}/resolve`, { outcome: "NO" });
    expect(await inPlay()).toBe(0);
  });
});

describe("cancelling", () => {
  it("lets the creator cancel only while there are no bets", async () => {
    const { token: priya, code } = await startGroup("Priya");
    const alex = await join(code, "Alex");
    const empty = await newPrediction(priya);
    const busy = await newPrediction(priya);
    await as(alex).post(`/api/predictions/${busy}/bets`, { side: "YES", amount: 5 });

    expect((await as(alex).delete(`/api/predictions/${empty}`)).status).toBe(403);
    expect((await as(priya).delete(`/api/predictions/${busy}`)).status).toBe(409);
    expect((await as(priya).delete(`/api/predictions/${empty}`)).status).toBe(204);
    expect((await as(priya).get(`/api/predictions/${empty}`)).status).toBe(404);
  });
});
