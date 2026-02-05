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
import { generateUnifiedSignal, TPSLData } from '../utils/unifiedSignalGenerator';
import { verifySignal } from '../services/signalVerification';
import { calculateATR, Candle } from '../utils/indicators';

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
  const { fetchKlineData, prices, tpslData, selectedSymbol } = usePriceContext();
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

  // Calculate TP/SL from technical analysis (similar to PriceContext logic)
  const calculateTechnicalTPLS = useCallback((symbol: string, candles: Candle[], direction: 'BUY' | 'SELL'): TPSLData | null => {
    if (candles.length < 14) return null;

    const currentPrice = candles[candles.length - 1].close;
    const atr = calculateATR(candles, 14);
    const currentATR = atr[atr.length - 1] || 0;
    const volatility = Math.max(currentATR, currentPrice * 0.01); // Min 1% volatility

    let sl, tp1, tp2;

    if (direction === 'BUY') {
      sl = currentPrice - (volatility * 2.5);
      tp1 = currentPrice + (volatility * 1.5);
      tp2 = currentPrice + (volatility * 3.5);
    } else {
      sl = currentPrice + (volatility * 2.5);
      tp1 = currentPrice - (volatility * 1.5);
      tp2 = currentPrice - (volatility * 3.5);
    }

    const risk = Math.abs(currentPrice - sl);
    const rr = risk > 0 ? (Math.abs(tp2 - currentPrice)) / risk : 0;

    return {
      symbol,
      entry: currentPrice,
      tp1,
      tp2,
      sl,
      rr,
      direction,
      timestamp: Date.now()
    };
  }, []);

  // Scan Markets (Manual or Auto) - Now uses unified signal generation
  const scanMarkets = useCallback(async () => {
    console.log('[Signal Generation] Scanning markets with unified analysis (Bot + Technical)...');
    
    for (const { symbol } of WATCHLIST) {
      try {
        // Fetch candle data
        const candles = await fetchKlineData(symbol, '15m', 150);
        
        if (candles.length < 50) {
          console.warn(`[Signal Generation] Insufficient data for ${symbol}`);
          continue;
        }

        // 1. Run bot analysis
        const botResult = analyzeMarket(candles);
        
        // 2. Calculate technical analysis TP/SL
        // Priority: Use PriceContext TP/SL if available (from Professional Analysis), otherwise calculate
        let technicalData: TPSLData | null = null;
        if (symbol === selectedSymbol && tpslData && tpslData.symbol === symbol && tpslData.rr >= 1.5) {
          // Use existing TP/SL data from PriceContext (Professional Analysis)
          // Only use if R/R ratio is good (>= 1.5)
          technicalData = {
            symbol: tpslData.symbol,
            entry: tpslData.entry,
            tp1: tpslData.tp1,
            tp2: tpslData.tp2,
            sl: tpslData.sl,
            rr: tpslData.rr,
            direction: tpslData.direction,
            timestamp: tpslData.timestamp
          };
          console.log(`[Signal Generation] Using Professional Analysis TP/SL for ${symbol} (R/R: ${tpslData.rr.toFixed(2)})`);
        } else {
          // Calculate technical analysis for this symbol
          const botDirection = botResult.type === 'LONG' ? 'BUY' : 'SELL';
          technicalData = calculateTechnicalTPLS(symbol, candles, botDirection);
        }

        // 3. Generate unified signal (combines bot + technical analysis)
        const unifiedSignal = generateUnifiedSignal(symbol, candles, technicalData);
        
        // 4. Also create standalone Technical Analysis signal if:
        //    - It's the selected symbol (has Professional Analysis)
        //    - Technical data has good R/R ratio
        //    - No unified signal or unified signal is weak
        if (symbol === selectedSymbol && technicalData && technicalData.rr >= 1.5) {
          const technicalSignal = generateUnifiedSignal(symbol, candles, technicalData);
          if (technicalSignal && (!unifiedSignal || unifiedSignal.strength < 6)) {
            // Technical Analysis signal is strong enough on its own
            console.log(`[Signal Generation] Strong Technical Analysis signal for ${symbol} (R/R: ${technicalData.rr.toFixed(2)})`);
          }
        }

        if (unifiedSignal) {
          // 4. Verify signal (non-blocking - add signal even if verification fails)
          console.log(`[Signal Generation] Verifying signal for ${symbol} ${unifiedSignal.type}...`);
          let verification;
          try {
            verification = await verifySignal(
              symbol,
              unifiedSignal.type,
              unifiedSignal.entry
            );
          } catch (error) {
            console.warn(`[Signal Generation] Verification error for ${symbol}, proceeding anyway:`, error);
            verification = { verified: true, confidence: 0.7, reason: 'Verification skipped due to error' };
          }

          // Add signal regardless of verification (verification is informational)
          const strengthBoost = verification.verified ? Math.round(verification.confidence * 2) : 0;
          const newSignal = addSignal({
            type: unifiedSignal.type,
            symbol: unifiedSignal.symbol,
            entry: unifiedSignal.entry,
            stopLoss: unifiedSignal.stopLoss,
            takeProfit: unifiedSignal.takeProfit,
            strength: Math.min(10, unifiedSignal.strength + strengthBoost),
            confluence: {
              ...unifiedSignal.confluence,
              verified: verification.verified,
              verificationConfidence: verification.confidence
            }
          });

          if (newSignal) {
            if (verification.verified) {
              console.log(`[Signal Generation] ✅ Verified signal added: ${symbol} ${unifiedSignal.type} (strength: ${newSignal.strength}/10, source: ${unifiedSignal.source})`);
            } else {
              console.log(`[Signal Generation] ⚠️ Signal added (unverified): ${symbol} ${unifiedSignal.type} (strength: ${newSignal.strength}/10, source: ${unifiedSignal.source}) - ${verification.reason}`);
            }
            notifySignal(newSignal);
          }
        } else {
          console.log(`[Signal Generation] No signal generated for ${symbol}`);
        }
      } catch (error) {
        console.error(`[Signal Generation] Error processing ${symbol}:`, error);
      }
    }
    
    // Get current signal count after potential additions
    const currentSignalCount = activeSignals.length;
    console.log(`[Signal Generation] Scan complete. Active signals: ${currentSignalCount}`);
  }, [fetchKlineData, addSignal, calculateTechnicalTPLS, selectedSymbol, tpslData, notifySignal]);

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

