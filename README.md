# 🔮 Friend Market

A private prediction market for friend groups: like Polymarket, but for predictions such as *"Sam will be late to dinner"*, played with points instead of money.

Create a group, share the invite code with up to 9 friends, and bet points on YES or NO. Whoever posted a prediction decides the outcome, and the winners split the pot.

## Features

- **Groups with invite codes.** Anyone can create a group and get a code like `tidy-otter-4821` to share. Groups can't see each other, and each holds up to 10 people.
- **Predictions.** A yes/no statement, an optional description, and an optional betting deadline.
- **Betting.** Everyone starts with 1,000 points. You can bet as often as you like on either side, and the app shows live odds and an estimated payout before you commit.
- **Resolving.** Only the person who posted a prediction can mark it YES or NO. If they have points riding on it, the app shows that to everyone.
- **Parimutuel payouts.** Winners split the whole pot in proportion to their stakes. If nobody backed the winning side, everyone gets their points back. Payouts are rounded so the total always equals the pot.
- **Leaderboard.** Everyone's balance, plus the points each person still has riding on unresolved predictions.
- Works on phones, and follows your system's light or dark mode.

The full rules are in [SPEC.md](SPEC.md).

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 19, Vite, TypeScript, React Router, plain CSS |
| Backend | Node, Express 5, TypeScript, Zod validation |
| Database | SQLite with Prisma 6 (migrations + seed script) |
| Tests | Vitest + Supertest |

## Getting started

Requires **Node 20.19+**.

```sh
git clone https://github.com/keith-ang/friend-market.git
cd friend-market
npm install
npm run setup   # create the SQLite database from migrations and load demo data
npm run dev     # API on http://localhost:3001, app on http://localhost:5173
```

Open http://localhost:5173. Either choose **Create a group**, or **Join a group** with one of the demo codes:

| Code | Group |
|---|---|
| `dinner-club` | Dinner Club: 6 friends, 5 predictions, one already resolved |
| `office-crew` | Office Crew: 3 people and 1 prediction, to show groups are kept apart |

## Scripts

Run these from the repo root:

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API and the web app with hot reload |
| `npm run setup` | Applies migrations and seeds the demo data |
| `npm test` | Runs the server tests (payout maths and API rules) against a throwaway `test.db` |
| `npm run typecheck` | Type-checks the server and the client |
| `npm run db:seed -w server` | Wipes the dev database and re-seeds the demo groups |
| `npm run db:migrate -w server` | Creates or applies migrations after you edit `prisma/schema.prisma` |
| `npm run build -w client` | Production build of the web app into `client/dist` |

## Project structure

```
server/
  prisma/schema.prisma   data model: Group, Member, Session, Prediction, Bet
  prisma/seed.ts         demo data, created through the same rules as the API
  src/payout.ts          parimutuel payout maths (pure function)
  src/market.ts          the rules: create group, join, predict, cancel, bet, resolve
  src/auth.ts            session tokens
  src/codes.ts           invite code generator
  src/routes.ts          REST endpoints and request validation
  test/                  Vitest suites
client/
  src/api.ts             typed fetch wrapper that adds the session token
  src/session.tsx        who's signed in
  src/pages/             Welcome (join/create), Predictions, Prediction detail, New, Leaderboard
SPEC.md                  product rules, API reference and data model
```

## API

This is a JSON REST API under `/api`. Everything except creating, looking up and joining a group needs an `Authorization: Bearer <token>` header, and only returns data from the caller's own group.

| Method & path | Purpose |
|---|---|
| `POST /groups` | Create a group: `{ groupName, name }` → `{ token, member }` |
| `POST /roster` | Look up a group's name and members from its invite code |
| `POST /join` | Join a group or sign back in: `{ code, name }` → `{ token, member }` |
| `GET /me` · `POST /logout` | The current member, and signing out |
| `GET /members` | The group's members, with balances and points in play |
| `GET /predictions` · `GET /predictions/:id` | List predictions, or get one with all its bets |
| `POST /predictions` · `DELETE /predictions/:id` | Create a prediction, or delete one (creator only, and only before any bets) |
| `POST /predictions/:id/bets` | Place a bet: `{ side: "YES" \| "NO", amount }` |
| `POST /predictions/:id/resolve` | Resolve a prediction (creator only): `{ outcome }` |

See [SPEC.md](SPEC.md#rest-api) for details and error codes.

## Security notes

The app is built for friends playing with points, not for strangers or money:

- Anyone with a group's invite code can sign in as any member of that group. There are no passwords.
- Anyone who can reach the server can create groups, and there's no rate limiting on guessing invite codes.

Keep it on a trusted network, or put rate limiting in front of it before exposing it to the public internet.
