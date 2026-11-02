import type { VoiceOption } from '@shared/narration/tts-provider';
import { useEffect, useState } from 'react';

import { getVoices } from '@/api/narration';

export type VoicesState =
  | { status: 'loading' }
  | { status: 'ready'; voices: VoiceOption[] }
  /** Server unreachable or it offers no voices: the phone voice is used. */
  | { status: 'unavailable' };

export interface UseVoices {
  state: VoicesState;
  retry: () => void;
}

/** Loads the server's voices on mount and on `retry`. Never throws. */
export function useVoices(): UseVoices {
  const [state, setState] = useState<VoicesState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getVoices().then((result) => {
      if (cancelled) return;
      setState(
        result.ok && result.data.voices.length > 0
          ? { status: 'ready', voices: result.data.voices }
          : { status: 'unavailable' },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  return { state, retry };
}
