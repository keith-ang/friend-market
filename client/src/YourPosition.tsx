import { payoutsByMember } from "@friend-market/shared";
import { points } from "./format";
import type { PredictionDetail, Side } from "./types";
import "./styles/position.css";

/** Signed points, e.g. "+220 pts" or "−200 pts". */
function net(n: number) {
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${points(Math.abs(n))}`;
}

function stakeText(yes: number, no: number) {
  if (yes > 0 && no > 0) return `${points(yes)} on YES and ${points(no)} on NO`;
  return yes > 0 ? `${points(yes)} on YES` : `${points(no)} on NO`;
}

/** The signed-in member's stake in a prediction, and what they'd get back for each outcome. */
export function YourPosition({ prediction: p, meId }: { prediction: PredictionDetail; meId: number }) {
  const { yes, no } = p.myStake;
  const staked = yes + no;
  if (staked === 0) return null;

  if (p.status === "RESOLVED") {
    const back = p.bets.filter((b) => b.member.id === meId).reduce((acc, b) => acc + (b.payout ?? 0), 0);
    return (
      <section className="card position">
        <h2>Your position</h2>
        <p>
          You had {stakeText(yes, no)} and got back <strong>{points(back)}</strong>{" "}
          <span className={back >= staked ? "yes-text" : "no-text"}>({net(back - staked)})</span>.
        </p>
      </section>
    );
  }

  const bets = p.bets.map((b) => ({ id: b.id, memberId: b.member.id, side: b.side, amount: b.amount }));
  const backIf = (outcome: Side) => payoutsByMember(bets, outcome).get(meId) ?? 0;

  return (
    <section className="card position">
      <h2>Your position</h2>
      <p>You have {stakeText(yes, no)}.</p>
      <div className="position-outcomes">
        {(["YES", "NO"] as const).map((outcome) => {
          const back = backIf(outcome);
          return (
            <div key={outcome} className="position-outcome">
              <span className={`position-label ${outcome === "YES" ? "yes-text" : "no-text"}`}>If {outcome}</span>
              <span>
                you get back <strong>{points(back)}</strong>
              </span>
              <span className={back >= staked ? "yes-text small" : "no-text small"}>{net(back - staked)}</span>
            </div>
          );
        })}
      </div>
      <p className="muted small">Based on the pot right now. It shifts as others bet.</p>
    </section>
  );
}
