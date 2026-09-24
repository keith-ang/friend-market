import { useState, type FormEvent, type ReactNode } from "react";
import { LIMITS, MAX_MEMBERS, STARTING_BALANCE } from "@friend-market/shared";
import { api } from "../api";
import { ErrorNote, InviteCode } from "../components";
import { useAction } from "../hooks";
import { useSession } from "../session";
import type { Me } from "../types";

const startingPoints = STARTING_BALANCE.toLocaleString();

type Step =
  | { kind: "home" }
  | { kind: "join-code" }
  | { kind: "join-name"; code: string; groupName: string; names: string[]; full: boolean }
  | { kind: "create" }
  | { kind: "created"; token: string; member: Me };

export default function WelcomePage() {
  const { signIn } = useSession();
  const [step, setStep] = useState<Step>({ kind: "home" });
  const { busy, error, run, setError } = useAction();

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  const back = (
    <button type="button" className="btn-link" onClick={() => go({ kind: "home" })}>
      ← Back
    </button>
  );

  return (
    <main className="container welcome">
      <div className="card welcome-card">
        {step.kind === "home" && (
          <div className="stack">
            <h1>🔮 Friend Market</h1>
            <p className="muted">
              Bet play points on what your friends will do next. Private to your group of up to {MAX_MEMBERS}.
            </p>
            <button className="btn btn-primary btn-big" onClick={() => go({ kind: "join-code" })}>
              Join a group
            </button>
            <button className="btn btn-big" onClick={() => go({ kind: "create" })}>
              Create a group
            </button>
          </div>
        )}

        {step.kind === "join-code" && (
          <JoinCodeForm
            busy={busy}
            back={back}
            onSubmit={(code) =>
              run(async () => {
                const roster = await api.roster(code);
                go({ kind: "join-name", code, ...roster });
              })
            }
          />
        )}

        {step.kind === "join-name" && (
          <JoinNameStep
            step={step}
            busy={busy}
            back={back}
            onJoin={(name) =>
              run(async () => {
                const { token, member } = await api.join(step.code, name);
                signIn(token, member);
              })
            }
          />
        )}

        {step.kind === "create" && (
          <CreateGroupForm
            busy={busy}
            back={back}
            onSubmit={(groupName, name) =>
              run(async () => {
                const { token, member } = await api.createGroup(groupName, name);
                go({ kind: "created", token, member });
              })
            }
          />
        )}

        {step.kind === "created" && (
          <div className="stack">
            <h1>🎉 {step.member.group.name} is ready</h1>
            <p>Share this invite code with your friends so they can join:</p>
            <InviteCode code={step.member.group.code} large />
            <p className="muted small">
              Up to {MAX_MEMBERS} people can join. You can find the code again at the top of every page.
            </p>
            <button className="btn btn-primary" onClick={() => signIn(step.token, step.member)}>
              Go to {step.member.group.name}
            </button>
          </div>
        )}

        <ErrorNote message={error} />
      </div>
    </main>
  );
}

function JoinCodeForm({
  busy,
  back,
  onSubmit,
}: {
  busy: boolean;
  back: ReactNode;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(code.trim());
  }
  return (
    <form onSubmit={submit} className="stack">
      <h1>Join a group</h1>
      <label>
        Invite code
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          autoComplete="off"
          autoCapitalize="none"
          placeholder="e.g. tidy-otter-4821"
        />
      </label>
      <button className="btn btn-primary" disabled={busy || !code.trim()}>
        Continue
      </button>
      {back}
    </form>
  );
}

function JoinNameStep({
  step,
  busy,
  back,
  onJoin,
}: {
  step: Extract<Step, { kind: "join-name" }>;
  busy: boolean;
  back: ReactNode;
  onJoin: (name: string) => void;
}) {
  const [newName, setNewName] = useState("");
  return (
    <div className="stack">
      <h1>Join {step.groupName}</h1>
      {step.names.length > 0 && (
        <>
          <h2>Who are you?</h2>
          <div className="name-grid">
            {step.names.map((name) => (
              <button key={name} className="btn" disabled={busy} onClick={() => onJoin(name)}>
                {name}
              </button>
            ))}
          </div>
        </>
      )}
      {step.full ? (
        <p className="muted">This group is full ({MAX_MEMBERS} members), so pick your name above.</p>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            onJoin(newName.trim());
          }}
        >
          <label>
            {step.names.length > 0 ? "New here? Add your name" : "Your name"}
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={LIMITS.memberName.max}
              placeholder="e.g. Sam"
            />
          </label>
          <button className="btn btn-primary" disabled={busy || !newName.trim()}>
            Join with {startingPoints} points
          </button>
        </form>
      )}
      {back}
    </div>
  );
}

function CreateGroupForm({
  busy,
  back,
  onSubmit,
}: {
  busy: boolean;
  back: ReactNode;
  onSubmit: (groupName: string, name: string) => void;
}) {
  const [groupName, setGroupName] = useState("");
  const [name, setName] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(groupName.trim(), name.trim());
  }
  return (
    <form onSubmit={submit} className="stack">
      <h1>Create a group</h1>
      <label>
        Group name
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          maxLength={LIMITS.groupName.max}
          autoFocus
          placeholder="e.g. Dinner Club"
        />
      </label>
      <label>
        Your name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIMITS.memberName.max}
          placeholder="e.g. Sam"
        />
      </label>
      <p className="muted small">You'll get an invite code to share. Everyone starts with {startingPoints} points.</p>
      <button className="btn btn-primary" disabled={busy || !groupName.trim() || !name.trim()}>
        Create group
      </button>
      {back}
    </form>
  );
}
