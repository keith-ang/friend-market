import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  /** True until the first response (or failure) for the current deps arrives. */
  loading: boolean;
  /** Refetch in place: the current data stays on screen until the new response lands. */
  reload: () => Promise<void>;
  /** Replace the data with a fresh copy, e.g. the updated record an action returned. */
  setData: (data: T) => void;
}

/**
 * Fetches on mount and whenever `deps` change. Responses that arrive after
 * unmount, or after a newer request started, are ignored.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: DependencyList): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latestRequest = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    try {
      const result = await fetcherRef.current();
      if (request !== latestRequest.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (request !== latestRequest.current) return;
      setError(errorMessage(err));
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setData(null);
    setError(null);
    setLoading(true);
    load();
    return () => {
      // Invalidate whatever is in flight for the old deps.
      latestRequest.current++;
    };
    // Refetch exactly when the caller's deps change; `load` itself is stable.
  }, deps);

  // A fresher copy (e.g. what an action returned) must win over any refetch still in flight.
  const replace = useCallback((next: T) => {
    latestRequest.current++;
    setData(next);
    setError(null);
    setLoading(false);
  }, []);

  return { data, error, loading, reload: load, setData: replace };
}

export interface ActionState {
  busy: boolean;
  error: string | null;
  /** Runs an async action with busy/error handling. Resolves to true if it succeeded. */
  run: (action: () => Promise<void>) => Promise<boolean>;
  setError: (error: string | null) => void;
}

/** Busy and error state for user-triggered actions such as submitting a form. */
export function useAction(): ActionState {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Actions often navigate away (e.g. after signing in), unmounting the page mid-run.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      if (mounted.current) setError(errorMessage(err));
      return false;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  return { busy, error, run, setError };
}

/** How often visible pages refetch, so friends' bets and resolutions show up without a reload. */
export const AUTO_REFRESH_MS = 20_000;

/**
 * Calls `refresh` every `intervalMs` while the page is visible, and straight away
 * when the tab becomes visible again or the window regains focus. The timer is
 * paused while hidden, calls never overlap, and failures are left to the caller
 * (useApi keeps showing the data it already has).
 */
export function useAutoRefresh(
  refresh: () => Promise<unknown>,
  intervalMs = AUTO_REFRESH_MS,
  enabled = true,
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    let running = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const tick = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        await refreshRef.current();
      } catch {
        // A missed background refresh is retried on the next tick.
      } finally {
        running = false;
      }
    };
    const start = () => {
      if (timer === undefined) timer = setInterval(tick, intervalMs);
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", tick);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", tick);
    };
  }, [intervalMs, enabled]);
}

/**
 * True when `quote` differs from what it was when the user started filling in
 * `input` (i.e. when `input` went from empty to non-empty). Resets once `input`
 * is cleared. Used to flag odds that moved under a half-typed bet.
 */
export function useChangedWhileEditing(input: string, quote: string): boolean {
  const [startQuote, setStartQuote] = useState<string | null>(null);

  useEffect(() => {
    setStartQuote((current) => (input === "" ? null : (current ?? quote)));
    // Only a change to the input starts or ends an edit; quote changes are what we compare.
  }, [input]);

  return input !== "" && startQuote !== null && startQuote !== quote;
}
