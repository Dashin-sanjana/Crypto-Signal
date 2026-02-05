/**
 * Unified Signal Generator
 * Combines signals from bot analysis and technical analysis (TP/SL data)
 */

import { analyzeMarket } from './analysis';
import { Candle } from './indicators';
import type { Signal } from '../contexts/SignalContext';

export interface TPSLData {
  symbol: string;
  entry: number;
  tp1: number;
  tp2: number;
  sl: number;
  rr: number;
  direction: 'BUY' | 'SELL';
  timestamp: number;
}

export interface UnifiedSignal extends Signal {
  source: 'bot' | 'technical' | 'combined';
  technicalAnalysis?: TPSLData;
  botAnalysis?: {
    strength: number;
    confluence: Record<string, boolean>;
  };
  verified?: boolean;
  verificationConfidence?: number;
}

/**
 * Generate unified signal by combining bot analysis and technical analysis
 */
export const generateUnifiedSignal = (
  symbol: string,
  candles: Candle[],
  technicalData: TPSLData | null
): UnifiedSignal | null => {
  // 1. Run bot analysis
  const botResult = analyzeMarket(candles);
  
  // 2. Check if bot analysis found a signal
  const hasBotSignal = botResult.signal !== null;
  
  // 3. Check if technical analysis has valid data
  const hasTechnicalSignal = technicalData !== null && 
    technicalData.entry > 0 && 
    technicalData.sl > 0 && 
    technicalData.tp1 > 0;
  
  // 4. Determine signal direction from technical analysis
  const technicalDirection = technicalData?.direction === 'BUY' ? 'LONG' : 'SHORT';
  
  // 5. Combine signals
  let finalSignal: UnifiedSignal | null = null;
  
  if (hasBotSignal && hasTechnicalSignal) {
    // Both signals exist - check if they agree
    const botDirection = botResult.type;
    const directionsMatch = botDirection === technicalDirection;
    
    if (directionsMatch) {
      // Strong signal: Both sources agree
      finalSignal = {
        id: `unified_${symbol}_${Date.now()}`,
        type: botDirection,
        symbol,
        entry: technicalData.entry, // Use technical analysis entry (current price)
        stopLoss: technicalData.sl,
        takeProfit: technicalData.tp2, // Use TP2 as main target
        strength: Math.min(10, botResult.strength + 2), // Boost strength when both agree
        timestamp: Date.now(),
        expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes
        status: 'active',
        source: 'combined',
        technicalAnalysis: technicalData,
        botAnalysis: {
          strength: botResult.strength,
          confluence: botResult.confluence || {}
        },
        confluence: {
          ...botResult.confluence,
          technicalAnalysis: true,
          botAnalysis: true
        }
      };
    } else {
      // Signals disagree - use bot signal but note conflict
      finalSignal = {
        id: `bot_${symbol}_${Date.now()}`,
        type: botDirection,
        symbol,
        entry: botResult.entry,
        stopLoss: botResult.stopLoss,
        takeProfit: botResult.takeProfit,
        strength: Math.max(1, botResult.strength - 2), // Reduce strength due to conflict
        timestamp: Date.now(),
        expiresAt: Date.now() + (15 * 60 * 1000),
        status: 'active',
        source: 'bot',
        botAnalysis: {
          strength: botResult.strength,
          confluence: botResult.confluence || {}
        },
        confluence: {
          ...botResult.confluence,
          technicalAnalysis: false, // Disagrees
          botAnalysis: true
        }
      };
    }
  } else if (hasBotSignal) {
    // Only bot signal
    finalSignal = {
      id: `bot_${symbol}_${Date.now()}`,
      type: botResult.type!,
      symbol,
      entry: botResult.entry,
      stopLoss: botResult.stopLoss,
      takeProfit: botResult.takeProfit,
      strength: botResult.strength,
      timestamp: Date.now(),
      expiresAt: Date.now() + (15 * 60 * 1000),
      status: 'active',
      source: 'bot',
      botAnalysis: {
        strength: botResult.strength,
        confluence: botResult.confluence || {}
      },
      confluence: botResult.confluence || {}
    };
  } else if (hasTechnicalSignal) {
    // Only technical signal
    finalSignal = {
      id: `technical_${symbol}_${Date.now()}`,
      type: technicalDirection,
      symbol,
      entry: technicalData.entry,
      stopLoss: technicalData.sl,
      takeProfit: technicalData.tp2,
      strength: 6, // Default strength for technical-only signals
      timestamp: Date.now(),
      expiresAt: Date.now() + (15 * 60 * 1000),
      status: 'active',
      source: 'technical',
      technicalAnalysis: technicalData,
      confluence: {
        technicalAnalysis: true,
        botAnalysis: false
      }
    };
  }
  
  return finalSignal;
};

/**
 * Generate signals for all watchlist symbols
 */
export const generateUnifiedSignalsForWatchlist = async (
  watchlist: { symbol: string }[],
  fetchKlineData: (symbol: string, interval?: string, limit?: number) => Promise<Candle[]>,
  getTechnicalData: (symbol: string) => TPSLData | null
): Promise<UnifiedSignal[]> => {
  const signals: UnifiedSignal[] = [];
  
  for (const { symbol } of watchlist) {
    try {
      // Fetch candle data
      const candles = await fetchKlineData(symbol, '15m', 150);
      
      if (candles.length < 50) {
        console.warn(`Insufficient data for ${symbol}`);
        continue;
      }
      
      // Get technical analysis data
      const technicalData = getTechnicalData(symbol);
      
      // Generate unified signal
      const signal = generateUnifiedSignal(symbol, candles, technicalData);
      
      if (signal) {
        signals.push(signal);
      }
    } catch (error) {
      console.error(`Error generating signal for ${symbol}:`, error);
    }
  }
  
  return signals;
};
