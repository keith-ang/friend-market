import type { PredictionSummary } from "./types";
import "./styles/prediction-tags.css";

/** Betting has closed on a prediction you created, and it's waiting for you to resolve it. */
export function needsYourCall(p: PredictionSummary, meId: number): boolean {
  return p.status === "CLOSED" && p.creator.id === meId;
}

/** Tags for a prediction card: "Needs your call" and "You're in". */
export function PredictionTags({ prediction: p, meId }: { prediction: PredictionSummary; meId: number }) {
  const youreIn = p.myStake.yes + p.myStake.no > 0;
  const yourCall = needsYourCall(p, meId);
  if (!youreIn && !yourCall) return null;
  return (
    <span className="prediction-tags">
      {yourCall && <span className="badge badge-call">Needs your call</span>}
      {youreIn && <span className="badge badge-in">You're in</span>}
    </span>
  );
}
