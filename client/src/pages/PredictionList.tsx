import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { ErrorNote, Loading, OddsBar, StatusBadge } from "../components";
import { points } from "../format";
import { useApi, useAutoRefresh } from "../hooks";

type Tab = "open" | "resolved";

export default function PredictionList() {
  const { data: predictions, error, loading, reload } = useApi(() => api.predictions(), []);
  useAutoRefresh(reload);
  const [tab, setTab] = useState<Tab>("open");

  const shown = (predictions ?? []).filter((p) =>
    tab === "open" ? p.status !== "RESOLVED" : p.status === "RESOLVED",
  );

  return (
    <>
      <div className="page-head">
        <h1>Predictions</h1>
        <Link to="/new" className="btn btn-primary">
          + New prediction
        </Link>
      </div>

      <div className="tabs" role="tablist">
        {(["open", "resolved"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "tab active" : "tab"}
            onClick={() => setTab(t)}
          >
            {t === "open" ? "Open" : "Resolved"}
          </button>
        ))}
      </div>

      <ErrorNote message={error} />
      {loading && <Loading />}
      {predictions !== null && shown.length === 0 && (
        <p className="muted empty">
          {tab === "open" ? "Nothing open right now. Make a prediction!" : "Nothing resolved yet."}
        </p>
      )}

      <div className="list">
        {shown.map((p) => (
          <Link to={`/p/${p.id}`} key={p.id} className="card prediction-card">
            <div className="card-top">
              <StatusBadge prediction={p} />
              <span className="muted small">by {p.creator.name}</span>
            </div>
            <h2>{p.title}</h2>
            <OddsBar prediction={p} />
            <div className="muted small">
              {points(p.yesPool + p.noPool)} in the pot · {p.betCount} {p.betCount === 1 ? "bet" : "bets"}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
