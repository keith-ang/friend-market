import type { Side, Status } from "./payout";

// JSON shapes the API returns. The server's serializers are typed against these,
// so a change on one side that isn't made on the other fails `npm run typecheck`.
// Dates are ISO 8601 strings.

export interface MemberDto {
  id: number;
  name: string;
  balance: number;
}

export interface GroupInfo {
  name: string;
  code: string;
}

/** The signed-in member, with their group's invite code for sharing. */
export interface Me extends MemberDto {
  group: GroupInfo;
}

export interface MemberWithInPlay extends MemberDto {
  /** Points staked on predictions that haven't resolved yet. */
  inPlay: number;
}

export interface MemberRef {
  id: number;
  name: string;
}

export interface PredictionSummary {
  id: number;
  title: string;
  description: string;
  creator: MemberRef;
  closesAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
  outcome: Side | null;
  status: Status;
  yesPool: number;
  noPool: number;
  betCount: number;
  creatorStake: number;
}

export interface BetDto {
  id: number;
  side: Side;
  amount: number;
  /** null while unresolved; 0 for a losing bet */
  payout: number | null;
  createdAt: string;
  member: MemberRef;
}

export interface PredictionDetail extends PredictionSummary {
  bets: BetDto[];
}

/** POST /groups and POST /join */
export interface AuthResponse {
  token: string;
  member: Me;
}

/** POST /roster */
export interface RosterResponse {
  groupName: string;
  names: string[];
  full: boolean;
}
