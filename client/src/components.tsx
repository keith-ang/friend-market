import { useState } from "react";
import { statusLabel, yesPercent } from "./format";
import type { PredictionSummary } from "./types";

export function OddsBar({ prediction }: { prediction: PredictionSummary }) {
  const yes = yesPercent(prediction);
  return (
    <div className="odds">
      <div className="odds-labels">
        <span className="yes-text">YES {yes}%</span>
        <span className="no-text">NO {100 - yes}%</span>
      </div>
      <div className="odds-bar" role="img" aria-label={`${yes}% YES`}>
        <div className="odds-yes" style={{ width: `${yes}%` }} />
      </div>
    </div>
  );
}

export function StatusBadge({ prediction }: { prediction: PredictionSummary }) {
  const tone =
    prediction.status === "RESOLVED"
      ? prediction.outcome === "YES"
        ? "badge-yes"
        : "badge-no"
      : prediction.status === "CLOSED"
        ? "badge-warn"
        : "badge-open";
  return <span className={`badge ${tone}`}>{statusLabel(prediction)}</span>;
}

/** A group's invite code with a copy button. */
export function InviteCode({ code, large = false }: { code: string; large?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      // Clipboard needs a secure context (https or localhost), so this can fail on a LAN address.
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <span className={large ? "invite invite-large" : "invite"}>
      <code>{code}</code>
      <button type="button" className="btn-link" onClick={copy}>
        {state === "copied" ? "Copied!" : state === "failed" ? "Select to copy" : "Copy"}
      </button>
    </span>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  return message ? (
    <p className="error" role="alert">
      {message}
    </p>
  ) : null;
}
