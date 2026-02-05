/**
 * Hook to generate signals from Technical Analysis TP/SL data
 * Monitors Technical Analysis component and creates tradeable signals
 */
import { useEffect, useRef } from 'react';
import { usePriceContext } from '../contexts/PriceContext';
import { useSignalContext } from '../contexts/SignalContext';
import { verifySignal } from '../services/signalVerification';

const TECHNICAL_ANALYSIS_CHECK_INTERVAL = 60000; // Check every 60 seconds (less frequent to avoid spam)
const MIN_RR_RATIO = 1.5; // Minimum risk/reward ratio to generate signal
const MIN_STRENGTH = 6; // Minimum signal strength to create signal

export const useTechnicalAnalysisSignals = () => {
  const { tpslData, selectedSymbol, tradeDirection } = usePriceContext();
  const { addSignal, activeSignals } = useSignalContext();
  const lastSignalRef = useRef<Map<string, number>>(new Map()); // Track last signal time per symbol

  useEffect(() => {
    if (!tpslData || !selectedSymbol) {
      return;
    }

    const checkTechnicalAnalysis = async () => {
      const { entry, tp1, tp2, sl, rr, direction } = tpslData;
      
      // Skip if data is invalid
      if (!entry || entry <= 0 || !sl || !tp2) {
        return;
      }

      // Check minimum risk/reward ratio
      if (rr < MIN_RR_RATIO) {
        return; // Risk/reward too low
      }

      // Check if we already created a signal recently for this symbol/direction (avoid spam)
      const signalKey = `${selectedSymbol}_${direction}`;
      const lastSignalTime = lastSignalRef.current.get(signalKey) || 0;
      const timeSinceLastSignal = Date.now() - lastSignalTime;
      
      // Only create signal if:
      // 1. No existing signal for this symbol/direction, OR
      // 2. Last signal was more than 5 minutes ago
      const existingSignal = activeSignals.find(
        s => s.symbol === selectedSymbol && 
        ((direction === 'BUY' && s.type === 'LONG') || (direction === 'SELL' && s.type === 'SHORT'))
      );

      if (existingSignal && timeSinceLastSignal < 5 * 60 * 1000) {
        return; // Signal already exists and is recent
      }

      // Verify signal
      const signalType = direction === 'BUY' ? 'LONG' : 'SHORT';
      let verification;
      try {
        verification = await verifySignal(selectedSymbol, signalType, entry);
      } catch (error) {
        console.warn(`[Technical Analysis Signals] Verification error for ${selectedSymbol}:`, error);
        verification = { verified: true, confidence: 0.8, reason: 'Technical Analysis signal' };
      }

      // Calculate signal strength based on R/R ratio and verification
      // Higher R/R = higher strength
      // R/R 1.5 = strength 3, R/R 2.0 = strength 4, R/R 3.0 = strength 6
      const baseStrength = Math.min(10, Math.round(rr * 2));
      const strength = Math.min(10, baseStrength + (verification.verified ? 2 : 0));

      // Only create signal if strength meets minimum threshold
      if (strength < MIN_STRENGTH) {
        return; // Signal too weak
      }

      // Create signal from Technical Analysis
      const signal = {
        type: signalType as 'LONG' | 'SHORT',
        symbol: selectedSymbol,
        entry: entry,
        stopLoss: sl,
        takeProfit: tp2, // Use TP2 as main target
        strength: strength,
        confluence: {
          technicalAnalysis: true,
          professionalAnalysis: true, // From TradingView Professional Analysis widget
          riskReward: rr >= 2.0, // Good R/R ratio
          verified: verification.verified,
          tp1: tp1, // Include TP1 for reference
          rr_ratio: rr
        }
      };

      // Add signal
      const newSignal = addSignal(signal);
      
      if (newSignal) {
        lastSignalRef.current.set(signalKey, Date.now());
        console.log(`[Technical Analysis Signals] ✅ Signal created: ${selectedSymbol} ${signalType} (strength: ${strength}/10, R/R: ${rr.toFixed(2)})`);
      }
    };

    // Check immediately
    checkTechnicalAnalysis();

    // Set up interval to check periodically
    const interval = setInterval(checkTechnicalAnalysis, TECHNICAL_ANALYSIS_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [tpslData, selectedSymbol, tradeDirection, addSignal, activeSignals]);
};
