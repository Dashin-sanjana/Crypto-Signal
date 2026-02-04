import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { SIGNAL_EXPIRY_MINUTES } from '../utils/constants';
import { generateId } from '../utils/helpers';

export interface Signal {
  id: string;
  type: 'LONG' | 'SHORT';
  symbol: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  strength: number;
  timestamp: number;
  expiresAt: number;
  status: 'active' | 'closed' | 'expired';
  confluence?: Record<string, boolean>;
}

import { usePriceContext } from './PriceContext';
import { useNotificationContext } from './NotificationContext';
import { analyzeMarket } from '../utils/analysis';
import { WATCHLIST } from '../utils/constants';

interface SignalContextType {
  activeSignals: Signal[];
  signalHistory: Signal[];
  addSignal: (signal: Omit<Signal, 'id' | 'timestamp' | 'expiresAt' | 'status'>) => Signal;
  removeSignal: (signalId: string) => void;
  clearAllSignals: () => void;
  updateSignalStatus: (signalId: string, status: Signal['status']) => void;
  scanMarkets: () => Promise<void>;
}

const SignalContext = createContext<SignalContextType | undefined>(undefined);

export const useSignalContext = () => {
  const context = useContext(SignalContext);
  if (!context) {
    throw new Error('useSignalContext must be used within SignalProvider');
  }
  return context;
};

interface SignalProviderProps {
  children: ReactNode;
}

export const SignalProvider: React.FC<SignalProviderProps> = ({ children }) => {
  const [activeSignals, setActiveSignals] = useState<Signal[]>([]);
  const [signalHistory, setSignalHistory] = useState<Signal[]>([]);
  const { fetchKlineData } = usePriceContext();
  const { notifySignal } = useNotificationContext();

  // Add new signal
  const addSignal = useCallback((signal: Omit<Signal, 'id' | 'timestamp' | 'expiresAt' | 'status'>) => {
    const newSignal: Signal = {
      id: generateId(),
      ...signal,
      timestamp: Date.now(),
      expiresAt: Date.now() + (SIGNAL_EXPIRY_MINUTES * 60 * 1000),
      status: 'active'
    };

    setActiveSignals(prev => {
      // Avoid exact duplicates
      if (prev.some(s => s.symbol === signal.symbol && s.type === signal.type)) {
        return prev;
      }
      return [newSignal, ...prev];
    });
    setSignalHistory(prev => [newSignal, ...prev].slice(0, 100));

    return newSignal;
  }, []);

  // Remove signal
  const removeSignal = useCallback((signalId: string) => {
    setActiveSignals(prev => prev.filter(s => s.id !== signalId));
  }, []);

  // Clear all signals
  const clearAllSignals = useCallback(() => {
    setActiveSignals([]);
  }, []);

  // Update signal status
  const updateSignalStatus = useCallback((signalId: string, status: Signal['status']) => {
    setActiveSignals(prev => prev.map(signal => signal.id === signalId ? { ...signal, status } : signal));
    setSignalHistory(prev => prev.map(signal => signal.id === signalId ? { ...signal, status } : signal));
  }, []);

  // Scan Markets (Manual or Auto)
  const scanMarkets = useCallback(async () => {
    console.log('Scanning markets for signals...');
    for (const { symbol } of WATCHLIST) {
      const candles = await fetchKlineData(symbol, '15m', 150); // Fetch more history for indicators
      
      if (candles.length < 50) continue;

      const result = analyzeMarket(candles);

      if (result.signal) {
        const newSignal = addSignal({
          type: result.type as 'LONG' | 'SHORT',
          symbol: symbol,
          entry: result.entry,
          stopLoss: result.stopLoss,
          takeProfit: result.takeProfit,
          strength: result.strength,
          confluence: result.confluence
        });
        if (newSignal) {
          notifySignal(newSignal);
        }
      }
    }
  }, [fetchKlineData, addSignal]);

  // Auto-remove expired signals
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveSignals(prev => prev.filter(signal => signal.expiresAt > now));
    }, 10000); 

    return () => clearInterval(interval);
  }, []);

  const value = {
    activeSignals,
    signalHistory,
    addSignal,
    removeSignal,
    clearAllSignals,
    updateSignalStatus,
    scanMarkets
  };

  return (
    <SignalContext.Provider value={value}>
      {children}
    </SignalContext.Provider>
  );
};

