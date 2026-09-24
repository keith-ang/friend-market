import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { payoutsByMember } from "@friend-market/shared";
import { api } from "../api";
import { ConfirmDialog } from "../ConfirmDialog";
import { BackLink, ErrorNote, Loading, OddsBar, StatusBadge } from "../components";
import { estimatePayout, formatDate, points } from "../format";
import { useAction, useApi, useAutoRefresh, useChangedWhileEditing } from "../hooks";
import { QuickAmounts } from "../QuickAmounts";
import { useMe, useSession } from "../session";
import type { Bet, PredictionDetail as Detail, Side } from "../types";
import { YourPosition } from "../YourPosition";
import "../styles/live.css";
import "../styles/resolve.css";

/** Which irreversible action is waiting for the creator to confirm. */
type PendingAction = { kind: "resolve"; outcome: Side } | { kind: "delete" };

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
  const [pending, setPending] = useState<PendingAction | null>(null);

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

  async function confirmPending() {
    if (!pending) return;
    if (pending.kind === "resolve") {
      const { outcome } = pending;
      await run(async () => {
        setPrediction(await api.resolve(p.id, outcome));
        await refreshMe();
      });
    } else {
      await run(async () => {
        await api.cancelPrediction(p.id);
        navigate("/");
      });
    }
    // On failure the error shows on the page, behind the closed dialog.
    setPending(null);
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

      <YourPosition prediction={p} meId={me.id} />

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
          <QuickAmounts balance={me.balance} amount={amount} onPick={setAmount} />
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
          <div className="resolve-choices">
            <div className="resolve-choice">
              <button
                className="btn resolve-yes"
                disabled={busy}
                onClick={() => setPending({ kind: "resolve", outcome: "YES" })}
              >
                Resolve as YES
              </button>
              <span className="hint">It happened</span>
            </div>
            <div className="resolve-choice">
              <button
                className="btn resolve-no"
                disabled={busy}
                onClick={() => setPending({ kind: "resolve", outcome: "NO" })}
              >
                Resolve as NO
              </button>
              <span className="hint">It didn't happen</span>
            </div>
          </div>
          {p.betCount === 0 && (
            <button className="btn-link danger" disabled={busy} onClick={() => setPending({ kind: "delete" })}>
              Delete prediction
            </button>
          )}
        </section>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "resolve" ? `Resolve as ${pending.outcome}?` : "Delete this prediction?"}
        confirmLabel={pending?.kind === "resolve" ? `Resolve as ${pending.outcome}` : "Delete prediction"}
        tone={pending?.kind === "resolve" ? (pending.outcome === "YES" ? "yes" : "no") : "danger"}
        busy={busy}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === "resolve" ? (
          <ResolvePreview prediction={p} outcome={pending.outcome} meId={me.id} />
        ) : (
          <p>Nobody has bet on it yet, so no points are affected.</p>
        )}
      </ConfirmDialog>

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

/** Who gets what if the creator resolves `outcome` now. */
function ResolvePreview({ prediction: p, outcome, meId }: { prediction: Detail; outcome: Side; meId: number }) {
  const pot = p.yesPool + p.noPool;
  if (pot === 0) {
    return <p>Nobody has bet on this, so no points change hands. This can't be undone.</p>;
  }

  const payouts = payoutsByMember(
    p.bets.map((b) => ({ id: b.id, memberId: b.member.id, side: b.side, amount: b.amount })),
    outcome,
  );
  const names = new Map(p.bets.map((b) => [b.member.id, b.member.id === meId ? "You" : b.member.name]));
  const rows = [...payouts].sort((a, b) => b[1] - a[1]);
  const refund = (outcome === "YES" ? p.yesPool : p.noPool) === 0;

  return (
    <>
      <p>
        {refund
          ? `Nobody backed ${outcome}, so everyone gets their ${points(pot)} back.`
          : `The ${points(pot)} pot is paid out like this:`}
      </p>
      <ul className="payout-preview">
        {rows.map(([memberId, payout]) => {
          const name = names.get(memberId);
          const verb = name === "You" ? "get" : "gets";
          return (
            <li key={memberId}>
              <span>
                {name} {verb}
              </span>
              <strong className={payout > 0 ? "yes-text" : "muted"}>{payout > 0 ? points(payout) : "nothing"}</strong>
            </li>
          );
        })}
      </ul>
      <p className="muted small">This can't be undone.</p>
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
