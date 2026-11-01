import type { NarrationResponse } from '@shared/api/narration';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ClientError } from '@/api/client';
import { requestNarration } from '@/api/narration';

export type NarrationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: ClientError }
  | { status: 'done'; narration: NarrationResponse };

export interface UseNarration {
  state: NarrationState;
  narrate: (landmarkId: string) => void;
}

/** Requests one narration (medium, walking); a response from an older request is ignored. */
export function useNarration(): UseNarration {
  const [state, setState] = useState<NarrationState>({ status: 'idle' });
  const latest = useRef(0);

  useEffect(() => {
    const ref = latest;
    return () => {
      ref.current += 1; // ignore responses after unmount
    };
  }, []);

  const narrate = useCallback((landmarkId: string) => {
    const id = ++latest.current;
    setState({ status: 'loading' });
    requestNarration({ landmarkId, length: 'medium', travelMode: 'walking' }).then((result) => {
      if (id !== latest.current) return;
      setState(result.ok ? { status: 'done', narration: result.data } : { status: 'error', error: result.error });
    });
  }, []);

  return { state, narrate };
}
