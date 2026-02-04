import { useEffect, useRef } from 'react';
import { useSignalContext } from '../contexts/SignalContext';

const SIGNAL_INTERVAL = 15 * 60 * 1000; // 15 minutes

export const useSignalGenerator = () => {
  const { scanMarkets } = useSignalContext();
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Initial scan on mount
    scanMarkets();

    // Schedule regular interval
    timerRef.current = setInterval(scanMarkets, SIGNAL_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [scanMarkets]);
};
