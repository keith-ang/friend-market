import type { Me, MemberWithInPlay, PredictionDetail, PredictionSummary, Side } from "./types";

const TOKEN_KEY = "friend-market-token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode); the session just won't survive a reload.
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

const PUBLIC_PATHS = ["/groups", "/roster", "/join"];

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && !PUBLIC_PATHS.includes(path)) onUnauthorized();
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  createGroup: (groupName: string, name: string) =>
    request<{ token: string; member: Me }>("POST", "/groups", { groupName, name }),
  roster: (code: string) =>
    request<{ groupName: string; names: string[]; full: boolean }>("POST", "/roster", { code }),
  join: (code: string, name: string) =>
    request<{ token: string; member: Me }>("POST", "/join", { code, name }),
  logout: () => request<void>("POST", "/logout"),
  me: () => request<Me>("GET", "/me"),
  members: () => request<MemberWithInPlay[]>("GET", "/members"),
  predictions: () => request<PredictionSummary[]>("GET", "/predictions"),
  prediction: (id: number) => request<PredictionDetail>("GET", `/predictions/${id}`),
  createPrediction: (input: { title: string; description: string; closesAt: string | null }) =>
    request<PredictionDetail>("POST", "/predictions", input),
  cancelPrediction: (id: number) => request<void>("DELETE", `/predictions/${id}`),
  placeBet: (id: number, side: Side, amount: number) =>
    request<PredictionDetail>("POST", `/predictions/${id}/bets`, { side, amount }),
  resolve: (id: number, outcome: Side) =>
    request<PredictionDetail>("POST", `/predictions/${id}/resolve`, { outcome }),
};
