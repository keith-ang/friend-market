/** Game rules and field limits. The server enforces them; the client uses them for hints and form limits. */

export const MAX_MEMBERS = 10;
export const STARTING_BALANCE = 1000;

export const LIMITS = {
  memberName: { max: 30 },
  groupName: { max: 40 },
  title: { min: 3, max: 140 },
  description: { max: 1000 },
} as const;
