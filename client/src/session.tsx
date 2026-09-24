import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, setUnauthorizedHandler } from "./api";
import { AUTO_REFRESH_MS, useAutoRefresh } from "./hooks";
import type { Me } from "./types";

interface Session {
  me: Me | null;
  loading: boolean;
  /** Store the session from a successful join or group creation. */
  signIn: (token: string, member: Me) => void;
  leave: () => Promise<void>;
  /** Re-fetch the current member, e.g. after a bet changes the balance. */
  refreshMe: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const signOutLocally = useCallback(() => {
    setToken(null);
    setMe(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOutLocally);
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setMe)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [signOutLocally]);

  const signIn = useCallback((token: string, member: Me) => {
    setToken(token);
    setMe(member);
  }, []);

  const leave = useCallback(async () => {
    await api.logout().catch(() => {});
    signOutLocally();
  }, [signOutLocally]);

  const refreshMe = useCallback(async () => {
    const token = getToken();
    const fresh = await api.me();
    // Ignore a response that lands after signing out or switching member.
    if (getToken() === token) setMe(fresh);
  }, []);

  // Keep the header balance current: friends' resolutions pay you out too.
  useAutoRefresh(refreshMe, AUTO_REFRESH_MS, me !== null);

  return (
    <SessionContext.Provider value={{ me, loading, signIn, leave, refreshMe }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}

/** The signed-in member. Only use below the welcome gate in App. */
export function useMe(): Me {
  const { me } = useSession();
  if (!me) throw new Error("No signed-in member");
  return me;
}
