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
