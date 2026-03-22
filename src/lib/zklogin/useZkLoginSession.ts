"use client";

import { useEffect, useState } from "react";
import type { ZkLoginSession } from "./types";
import { loadZkLoginSession, subscribeZkLoginSessionChanged } from "./zkLoginSession";

/**
 * React hook that returns the current zkLogin session (if any) and updates
 * reactively when the user logs in/out.
 */
export function useZkLoginSession(): ZkLoginSession | null {
  const [session, setSession] = useState<ZkLoginSession | null>(() => loadZkLoginSession());

  useEffect(() => {
    const unsub = subscribeZkLoginSessionChanged(() => setSession(loadZkLoginSession()));
    return unsub;
  }, []);

  return session;
}
