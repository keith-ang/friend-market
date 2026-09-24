export type Side = "YES" | "NO";
export type Status = "OPEN" | "CLOSED" | "RESOLVED";

export interface Member {
  id: number;
  name: string;
  balance: number;
}

export interface GroupInfo {
  name: string;
  code: string;
}

/** The signed-in member, with their group's invite code for sharing. */
export interface Me extends Member {
  group: GroupInfo;
}

export interface MemberWithInPlay extends Member {
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

export interface Bet {
  id: number;
  side: Side;
  amount: number;
  payout: number | null;
  createdAt: string;
  member: MemberRef;
}

export interface PredictionDetail extends PredictionSummary {
  bets: Bet[];
}
