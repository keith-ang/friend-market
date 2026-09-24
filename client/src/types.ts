// API types live in the shared package, next to the server code that produces them.
// Re-exported here under the client's shorter names.
export type {
  BetDto as Bet,
  GroupInfo,
  Me,
  MemberDto as Member,
  MemberRef,
  MemberWithInPlay,
  PredictionDetail,
  PredictionSummary,
  Side,
  Status,
} from "@friend-market/shared";
