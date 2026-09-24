import { useEffect, useState } from "react";
import { api } from "../api";
import { ErrorNote } from "../components";
import { points } from "../format";
import { useMe } from "../session";
import type { MemberWithInPlay } from "../types";

export default function Leaderboard() {
  const me = useMe();
  const [members, setMembers] = useState<MemberWithInPlay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .members()
      .then((list) => setMembers([...list].sort((a, b) => b.balance - a.balance)))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <h1>Leaderboard</h1>
      <ErrorNote message={error} />
      {members === null && !error && <p className="muted">Loading…</p>}
      {members && (
        <ol className="card leaderboard">
          {members.map((m, i) => (
            <li key={m.id} className={m.id === me.id ? "leader me-row" : "leader"}>
              <span className="rank">{i + 1}</span>
              <span className="leader-name">{m.name}</span>
              <span className="leader-points">
                <strong>{points(m.balance)}</strong>
                {m.inPlay > 0 && <span className="muted small">+{points(m.inPlay)} in play</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
