import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { BackLink, ErrorNote } from "../components";
import { useAction } from "../hooks";

export default function NewPrediction() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const { busy, error, run } = useAction();

  function submit(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      const created = await api.createPrediction({
        title,
        description,
        // datetime-local gives local time without a zone; Date parses it as local.
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
      });
      navigate(`/p/${created.id}`);
    });
  }

  return (
    <>
      <BackLink />
      <form className="card stack" onSubmit={submit}>
        <h1>New prediction</h1>
        <label>
          Prediction
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            placeholder="Sam will be late to dinner"
            autoFocus
          />
          <span className="hint">A yes/no statement about something that will happen.</span>
        </label>
        <label>
          Details <span className="muted">(optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="How exactly will it be judged?"
          />
        </label>
        <label>
          Betting closes <span className="muted">(optional)</span>
          <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          <span className="hint">Leave blank to keep betting open until you resolve it.</span>
        </label>
        <ErrorNote message={error} />
        <button className="btn btn-primary" disabled={busy || title.trim().length < 3}>
          Post prediction
        </button>
      </form>
    </>
  );
}
