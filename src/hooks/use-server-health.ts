import { useEffect, useState } from 'react';

import { getHealth } from '@/api/health';

export type ServerHealthState =
  | { status: 'checking' }
  | { status: 'ok'; version: string }
  | { status: 'unreachable'; message: string };

export interface UseServerHealth {
  state: ServerHealthState;
  /** Run the check again. */
  recheck: () => void;
}

/** Calls `getHealth()` on mount and whenever `recheck` is called. Never throws. */
export function useServerHealth(): UseServerHealth {
  const [state, setState] = useState<ServerHealthState>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getHealth().then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: 'ok', version: result.data.version }
          : { status: 'unreachable', message: result.error.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const recheck = () => {
    setState({ status: 'checking' });
    setAttempt((n) => n + 1);
  };

  return { state, recheck };
}
