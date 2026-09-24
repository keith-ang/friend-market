import { api } from "../api";
import { ErrorNote, Loading } from "../components";
import { points } from "../format";
import { useApi } from "../hooks";
import { useMe } from "../session";

export default function Leaderboard() {
  const me = useMe();
  const { data: members, error, loading } = useApi(
    () => api.members().then((list) => [...list].sort((a, b) => b.balance - a.balance)),
    [],
  );

  return (
    <>
      <h1>Leaderboard</h1>
      <ErrorNote message={error} />
      {loading && <Loading />}
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
