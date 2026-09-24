import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { BackLink, ErrorNote, Loading, OddsBar, StatusBadge } from "../components";
import { estimatePayout, formatDate, points } from "../format";
import { useAction, useApi, useAutoRefresh, useChangedWhileEditing } from "../hooks";
import { useMe, useSession } from "../session";
import type { Bet, Side } from "../types";
import "../styles/live.css";

export default function PredictionDetail() {
  const id = Number(useParams().id);
  const me = useMe();
  const { refreshMe } = useSession();
  const navigate = useNavigate();

  const { data: prediction, error: loadError, setData: setPrediction, reload } = useApi(() => api.prediction(id), [id]);
  useAutoRefresh(reload);
  const { busy, error: actionError, run } = useAction();

  const [side, setSide] = useState<Side>("YES");
  const [amount, setAmount] = useState("");
  const oddsChanged = useChangedWhileEditing(amount, prediction ? `${prediction.yesPool}/${prediction.noPool}` : "");

  if (!prediction) {
    if (loadError) {
      return (
        <>
          <BackLink />
          <ErrorNote message={loadError} />
        </>
      );
    }
    return <Loading />;
  }

  const p = prediction;
  const isCreator = p.creator.id === me.id;
  const pot = p.yesPool + p.noPool;
  const stake = Number(amount);
  const validStake = Number.isInteger(stake) && stake > 0 && stake <= me.balance;

  function placeBet(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      setPrediction(await api.placeBet(p.id, side, stake));
      setAmount("");
      await refreshMe();
    });
  }

  function resolve(outcome: Side) {
    if (!confirm(`Resolve as ${outcome}? This is final and pays out ${points(pot)} right away.`)) return;
    run(async () => {
      setPrediction(await api.resolve(p.id, outcome));
      await refreshMe();
    });
  }

  function cancel() {
    if (!confirm("Delete this prediction?")) return;
    run(async () => {
      await api.cancelPrediction(p.id);
      navigate("/");
    });
  }

  return (
    <>
      <BackLink />

      <article className="card detail">
        <div className="card-top">
          <StatusBadge prediction={p} />
          <span className="muted small">
            by {p.creator.name} · {formatDate(p.createdAt)}
          </span>
        </div>
        <h1>{p.title}</h1>
        {p.description && <p className="description">{p.description}</p>}
        <OddsBar prediction={p} />
        <div className="stats">
          <div>
            <span className="stat-value">{points(pot)}</span>
            <span className="muted small">in the pot</span>
          </div>
          <div>
            <span className="stat-value yes-text">{points(p.yesPool)}</span>
            <span className="muted small">on YES</span>
          </div>
          <div>
            <span className="stat-value no-text">{points(p.noPool)}</span>
            <span className="muted small">on NO</span>
          </div>
        </div>
        {p.creatorStake > 0 && p.status !== "RESOLVED" && (
          <p className="notice">
            Heads up: {isCreator ? "you have" : `${p.creator.name} has`} {points(p.creatorStake)} riding on this, and{" "}
            {isCreator ? "you're" : "they're"} the one who resolves it.
          </p>
        )}
        {p.status === "RESOLVED" && p.resolvedAt && (
          <p className={`result ${p.outcome === "YES" ? "yes-text" : "no-text"}`}>
            Resolved <strong>{p.outcome}</strong> on {formatDate(p.resolvedAt)}
          </p>
        )}
      </article>

      <ErrorNote message={actionError} />

      {p.status === "OPEN" && (
        <form className="card stack" onSubmit={placeBet}>
          <h2>Place a bet</h2>
          <div className="side-toggle">
            {(["YES", "NO"] as const).map((s) => (
              <button
                type="button"
                key={s}
                className={`btn side-${s.toLowerCase()} ${side === s ? "selected" : ""}`}
                aria-pressed={side === s}
                onClick={() => setSide(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <label>
            Points (you have {points(me.balance)})
            <input
              type="number"
              min={1}
              max={me.balance}
              step={1}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 50"
            />
          </label>
          {amount !== "" && !validStake && (
            <p className="small no-text">
              {stake > me.balance ? "That's more points than you have." : "Enter a whole number of points."}
            </p>
          )}
          {validStake && (
            <p className="muted small">
              If it resolves {side}, this bet pays about <strong>{points(estimatePayout(p, side, stake))}</strong>{" "}
              (assuming nobody else bets).
            </p>
          )}
          {oddsChanged && (
            <p className="notice odds-changed" role="status">
              Odds changed since you started. The estimate above is updated.
            </p>
          )}
          <button className="btn btn-primary" disabled={busy || !validStake}>
            Bet {validStake ? points(stake) : ""} on {side}
          </button>
        </form>
      )}

      {isCreator && p.status !== "RESOLVED" && (
        <section className="card stack">
          <h2>You created this</h2>
          <p className="muted small">
            Once you know the answer, resolve it and the pot is paid out straight away. You can do this before
            the deadline, but you can't undo it.
          </p>
          <div className="row">
            <button className="btn side-yes selected" disabled={busy} onClick={() => resolve("YES")}>
              It happened: YES
            </button>
            <button className="btn side-no selected" disabled={busy} onClick={() => resolve("NO")}>
              It didn't: NO
            </button>
          </div>
          {p.betCount === 0 && (
            <button className="btn-link danger" disabled={busy} onClick={cancel}>
              Delete prediction (only possible while there are no bets)
            </button>
          )}
        </section>
      )}

      <section className="card">
        <h2>Bets ({p.bets.length})</h2>
        {p.bets.length === 0 ? (
          <p className="muted">No bets yet. Be the first!</p>
        ) : (
          <ul className="bets">
            {p.bets.map((bet) => (
              <BetRow key={bet.id} bet={bet} creatorId={p.creator.id} meId={me.id} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function BetRow({ bet, creatorId, meId }: { bet: Bet; creatorId: number; meId: number }) {
  return (
    <li className="bet">
      <span>
        <strong>{bet.member.id === meId ? "You" : bet.member.name}</strong>
        {bet.member.id === creatorId && <span className="tag">creator</span>}
      </span>
      <span className={bet.side === "YES" ? "yes-text" : "no-text"}>
        {points(bet.amount)} on {bet.side}
      </span>
      <span className="muted small bet-result">
        {bet.payout === null
          ? formatDate(bet.createdAt)
          : bet.payout > 0
            ? `got back ${points(bet.payout)}`
            : "lost"}
      </span>
    </li>
  );
}
