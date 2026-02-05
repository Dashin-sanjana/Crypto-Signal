/**
 * Hook to handle auto-execution of trades from signals
 */
import { useEffect, useRef } from 'react';
import { useSignalContext } from '../contexts/SignalContext';
import { useTradingContext } from '../contexts/TradingContext';

export const useAutoExecution = () => {
  const { activeSignals } = useSignalContext();
  const { autoTradingEnabled, autoTradingMinStrength, executeTrade, positions, isConnected } = useTradingContext();
  const executedSignalsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Always log signal status for debugging
    if (activeSignals.length > 0) {
      console.log(`[Auto-Trading] 📊 Status Check - Signals: ${activeSignals.length}, Auto-Trading: ${autoTradingEnabled ? 'ON' : 'OFF'}, Backend: ${isConnected ? 'Connected' : 'Disconnected'}, Min Strength: ${autoTradingMinStrength}/10`);
      activeSignals.forEach(s => {
        console.log(`  - ${s.symbol} ${s.type}: strength ${s.strength}/10, entry $${s.entry.toFixed(2)}`);
      });
    }

    // Check if backend is connected
    if (!isConnected) {
      if (activeSignals.length > 0) {
        console.warn(`[Auto-Trading] ❌ Backend not connected. Cannot execute trades.`);
      }
      return;
    }

    // Debug: Log auto-trading status
    if (!autoTradingEnabled) {
      if (activeSignals.length > 0) {
        console.log(`[Auto-Trading] ⚠️ Disabled. ${activeSignals.length} active signal(s) ignored. Enable auto-trading in Bot Control to execute trades.`);
      }
      return;
    }

    if (activeSignals.length === 0) {
      return; // No signals to process
    }

    console.log(`[Auto-Trading] ✅ Enabled. Checking ${activeSignals.length} active signal(s) (min strength: ${autoTradingMinStrength}/10)`);

    // Check each active signal for auto-execution
    activeSignals.forEach((signal) => {
      // Skip if already executed
      if (executedSignalsRef.current.has(signal.id)) {
        console.log(`[Auto-Trading] Signal ${signal.symbol} ${signal.type} already executed, skipping`);
        return;
      }

      // Check if signal qualifies (strength threshold)
      if (signal.strength < autoTradingMinStrength) {
        console.log(`[Auto-Trading] Signal ${signal.symbol} ${signal.type} strength ${signal.strength}/10 below threshold ${autoTradingMinStrength}/10, skipping`);
        return;
      }

      // Check if position already exists
      const existingPosition = positions.find((p) => p.symbol === signal.symbol);
      if (existingPosition) {
        console.log(`[Auto-Trading] Position already exists for ${signal.symbol}, skipping signal`);
        executedSignalsRef.current.add(signal.id);
        return;
      }

      // Auto-execute the trade
      console.log(`[Auto-Trading] ✅ Executing trade for ${signal.symbol} ${signal.type} (strength: ${signal.strength}/10, entry: $${signal.entry.toFixed(2)})`);
      executedSignalsRef.current.add(signal.id);
      
      executeTrade(signal).catch((error) => {
        console.error(`[Auto-Trading] ❌ Execution failed for ${signal.symbol}:`, error);
        // Remove from executed set so it can be retried
        executedSignalsRef.current.delete(signal.id);
      });
    });
  }, [activeSignals, autoTradingEnabled, autoTradingMinStrength, executeTrade, positions, isConnected]);

  // Clean up executed signals that are no longer active
  useEffect(() => {
    const activeSignalIds = new Set(activeSignals.map((s) => s.id));
    executedSignalsRef.current.forEach((id) => {
      if (!activeSignalIds.has(id)) {
        executedSignalsRef.current.delete(id);
      }
    });
  }, [activeSignals]);
};
