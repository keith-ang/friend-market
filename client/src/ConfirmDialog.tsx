import { useEffect, useRef, type ReactNode } from "react";
import "./styles/confirm-dialog.css";

export type ConfirmTone = "primary" | "danger" | "yes" | "no";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Colours the confirm button: YES/NO outcomes, or danger for destructive actions. */
  tone?: ConfirmTone;
  /** While true, both buttons are disabled and Escape / backdrop clicks are ignored. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * An in-app replacement for window.confirm, built on the native <dialog>:
 * showModal() makes the rest of the page inert and traps focus. The cancel
 * button (the safe choice) gets focus on open, and focus returns to whatever
 * opened the dialog when it closes.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusTo.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocusTo.current?.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      // Escape fires "cancel"; route it through onCancel so the parent's state stays the source of truth.
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      // A click on the dialog element itself (not its contents) is a click on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="confirm-dialog-body">
        <h2 id="confirm-dialog-title">{title}</h2>
        {children}
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="btn" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn confirm-${tone}`} disabled={busy} onClick={onConfirm}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
