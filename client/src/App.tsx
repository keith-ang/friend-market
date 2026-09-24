import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { InviteCode } from "./components";
import { points } from "./format";
import Leaderboard from "./pages/Leaderboard";
import NewPrediction from "./pages/NewPrediction";
import PredictionDetail from "./pages/PredictionDetail";
import PredictionList from "./pages/PredictionList";
import WelcomePage from "./pages/WelcomePage";
import { useSession } from "./session";

export default function App() {
  const { me, loading, leave } = useSession();

  if (loading) return <main className="container muted">Loading…</main>;
  if (!me) return <WelcomePage />;

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="brand">
            🔮 {me.group.name}
          </Link>
          <nav className="nav">
            <NavLink to="/" end>
              Predictions
            </NavLink>
            <NavLink to="/leaderboard">Leaderboard</NavLink>
          </nav>
          <div className="me">
            <span>
              <strong>{me.name}</strong> · {points(me.balance)}
            </span>
            <button className="btn-link" onClick={leave}>
              Leave
            </button>
          </div>
        </div>
        <div className="container invite-bar">
          <span className="muted small">Invite friends with code</span>
          <InviteCode code={me.group.code} />
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<PredictionList />} />
          <Route path="/new" element={<NewPrediction />} />
          <Route path="/p/:id" element={<PredictionDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
