# Friend Market: Spec

A private prediction market for friend groups of up to 10 people each. It works like Polymarket, but for predictions like "Sam will be late to dinner", and it uses play points instead of money.

## Scope

- **One main record:** a **Prediction**, a yes/no statement about something that will happen.
- **One shared action:** members place points on **YES** or **NO**.
- **One rule:** only the member who created a prediction can **resolve** it. Everyone in the group can view everything.

## Groups

- One server hosts **many groups**. Each group has a name and a generated **invite code** like `tidy-otter-4821`, which is unique across the server.
- Groups are completely **separate**: members, predictions, bets and the leaderboard only exist inside their group. Asking for another group's prediction returns 404.
- Every group caps at **10 members**, and every rule below applies per group.
- **Nobody owns a group.** Whoever created it is just its first member. There are no group settings: the name and code can't be changed, and members can't be removed.
- Being in two groups means joining twice. That gives you a separate member profile, balance and session for each group.

## Access

- **Create a group:** enter a group name and your name. You become its first member (1,000 points), you're signed in, and you're shown the invite code to share.
- **Join a group:** enter the invite code (case and surrounding spaces don't matter). Then pick your name from the group's members, or type a new one if there's room. Name matching ignores case.
- Names only need to be unique **within** a group, so two groups can each have a "Sam".
- Creating or joining issues a random **session token**. The browser stores it and sends it as `Authorization: Bearer <token>`. The server stores only a SHA-256 hash of it.
- **Every** API call except creating, looking up and joining a group needs a valid token, including reads.
- Known trade-offs:
  - Anyone with the code can sign in as any existing member of that group. That's acceptable for play points among friends.
  - Anyone who can reach the server can create a group.
  - A leaked code can't be changed.
  - There's no rate limiting, so a determined script could guess codes (about 9 million combinations). Put rate limiting in front of the server before exposing it to the public internet.

## Points

- Every member starts with **1,000 points**. There are no top-ups.
- Placing a bet deducts the points from your balance **immediately**.
- You can't bet more than your current balance.

## Predictions

| Field | Notes |
|---|---|
| title | Required, 3–140 characters. A yes/no statement. |
| description | Optional, up to 1,000 characters. |
| closesAt | Optional deadline for betting. Must be in the future when set. |
| creator | The member who created it. |
| outcome | `null` while unresolved, then `YES` or `NO`. |

Status is derived and never stored:
- **Open**: unresolved, and the deadline is unset or still in the future. Betting is allowed.
- **Closed**: unresolved, but the deadline has passed. Betting stops and it's waiting for the creator to resolve.
- **Resolved**: the outcome is set.

**Editing:** predictions can't be edited, so the terms never change under anyone's bet.

**Cancelling:** the creator can delete their prediction, but only while it has **no bets** and is unresolved.

## Bets

- A member can place **any number of bets** on a prediction, on **either side**.
- The **creator may bet** on their own prediction. The UI shows the creator's total stake so everyone can see the conflict of interest.
- A bet needs a positive whole number of points, the prediction must be Open, and your balance must cover it.

## Resolving

- Only the **creator** can resolve, choosing `YES` or `NO`.
- They can resolve **any time**, even before the deadline.
- The result is **final**. There's no undo.
- Payouts are credited to balances as soon as it's resolved.

### Payout: parimutuel pool

- **Pot** = all points staked on the prediction, on both sides.
- Each winning bet gets `pot × betAmount / totalWinningStake`.
- Losing bets get 0.
- If **nobody** backed the winning side, every bet is **refunded** in full.
- Points are whole numbers. Each share is rounded down, and the leftover points go one each to the bets with the largest remainders, with ties going to the earliest bet. The total paid out **always equals the pot**, so points are never created or destroyed.
- Each bet records its `payout` once resolved.

The **implied YES probability** shown in the UI is `yesPool / pot`. It shows 50% when the pot is empty.

The UI shows an **estimated payout** for a new bet of `X` on side `S`: `X × (pot + X) / (sidePool + X)`. This assumes nobody else bets.

## Screens

1. **Welcome**: two buttons, **Join a group** and **Create a group**.
   - *Join*: enter the invite code, then pick your name or add a new one.
   - *Create*: enter a group name and your name. A "your group is ready" screen shows the invite code with a Copy button, then takes you into the group.
2. **Predictions**: *Open* and *Resolved* tabs. Each card shows the title, creator, YES % bar, pot, bet count, and deadline or status. The Open tab includes Closed predictions, labelled "Awaiting result".
3. **Prediction detail**:
   - Description, creator, deadline, odds bar and pot
   - Bet form (side, amount, estimated payout) while Open
   - Every bet: who, which side, how much, and the payout once resolved
   - Creator only: **Resolve YES / NO**, and **Cancel** while there are no bets
4. **New prediction**: title, description, optional deadline.
5. **Leaderboard**: members ranked by balance, with the points each has in play on unresolved predictions.

The header always shows the group name, who you are, your balance, a Leave button that signs you out, and the group's invite code with a Copy button.

## REST API

All endpoints are under `/api` and use JSON. Everything behind a token is limited to the caller's group. Errors come back as `{ "error": "message" }` with a status code of 400, 401, 403, 404 or 409.

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /groups` | — | `{ groupName, name }` → `{ token, member }`. Creates the group with you as its first member. |
| `POST /roster` | code | `{ code }` → `{ groupName, names, full }`. Fills the join screen's name picker. |
| `POST /join` | code | `{ code, name }` → `{ token, member }`. Creates the member if the name is new. `member` includes `group: { name, code }`. |
| `POST /logout` | ✓ | Ends the current session. |
| `GET /me` | ✓ | The current member, including `group: { name, code }`. |
| `GET /members` | ✓ | Members of your group: `{ id, name, balance, inPlay }`. |
| `GET /predictions` | ✓ | Your group's predictions, as summaries (pools, status, creator stake). |
| `GET /predictions/:id` | ✓ | A summary plus every bet. |
| `POST /predictions` | ✓ | `{ title, description?, closesAt? }` |
| `DELETE /predictions/:id` | creator | Only while it has no bets. |
| `POST /predictions/:id/bets` | ✓ | `{ side: "YES" \| "NO", amount }` |
| `POST /predictions/:id/resolve` | creator | `{ outcome: "YES" \| "NO" }` |

## Data model (SQLite, Prisma)

- **Group**: id, name, code (unique), createdAt
- **Member**: id, groupId, name (unique per group), balance, createdAt
- **Session**: tokenHash (id), memberId, createdAt
- **Prediction**: id, groupId, title, description, closesAt?, creatorId, outcome?, createdAt, resolvedAt?
- **Bet**: id, predictionId, memberId, side, amount, payout?, createdAt

## Consistency

Every rule that touches balances runs in a single database transaction, and it **writes before it checks**. For example, placing a bet deducts the balance first and then checks that the prediction is still open. That write takes SQLite's write lock, so a prediction can't be resolved or cancelled halfway through someone placing a bet, and a double resolve or a double spend can't slip through.

## Out of scope

Group owners or admin tools (renaming, new codes, removing members), one account across groups, real money, editing predictions, undoing a resolution, comments, notifications, and multi-outcome markets.
