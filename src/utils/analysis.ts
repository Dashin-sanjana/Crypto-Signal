import { Candle, calculateEMA, calculateRSI, calculateATR, calculatePivotPoints, detectVolumeSpike } from './indicators';

interface AnalysisResult {
  signal: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-1
}

/**
 * 1. Elliott Wave Analysis (Simplified)
 * Detects if we are in an impulsive (trend) or corrective phase.
 */
export const analyzeElliottWave = (data: Candle[]): AnalysisResult => {
  if (data.length < 50) return { signal: 'neutral', confidence: 0 };
  
  // Simplified: Check trend using EMA 20/50/200 alignment
  const ema20 = calculateEMA(data, 20);
  const ema50 = calculateEMA(data, 50);
  const ema200 = calculateEMA(data, 200);
  
  const last = data.length - 1;
  const price = data[last].close;

  // Bullish Impulse: Price > EMA20 > EMA50 > EMA200
  if (price > ema20[last] && ema20[last] > ema50[last] && ema50[last] > ema200[last]) {
    // Check for pullback (Wave 2 or 4) logic could be added here
    return { signal: 'bullish', confidence: 0.8 };
  }
  
  // Bearish Impulse: Price < EMA20 < EMA50 < EMA200
  if (price < ema20[last] && ema20[last] < ema50[last] && ema50[last] < ema200[last]) {
    return { signal: 'bearish', confidence: 0.8 };
  }

  return { signal: 'neutral', confidence: 0.5 };
};

/**
 * 2. Candlestick Pattern Recognition
 * Detects Hammer, Shooting Star, Engulfing patterns.
 */
export const analyzePatterns = (data: Candle[]): AnalysisResult => {
  if (data.length < 3) return { signal: 'neutral', confidence: 0 };

  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  
  const bodySize = Math.abs(last.close - last.open);
  const wickTop = last.high - Math.max(last.open, last.close);
  const wickBottom = Math.min(last.open, last.close) - last.low;
  
  // Bullish Engulfing
  if (prev.close < prev.open && // Prev red
      last.close > last.open && // Last green
      last.open < prev.close && // Open below prev close
      last.close > prev.open) { // Close above prev open
    return { signal: 'bullish', confidence: 0.9 };
  }

  // Bearish Engulfing
  if (prev.close > prev.open && // Prev green
      last.close < last.open && // Last red
      last.open > prev.close && // Open above prev close
      last.close < prev.open) { // Close below prev open
    return { signal: 'bearish', confidence: 0.9 };
  }

  // Hammer (Bullish Reversal)
  if (wickBottom > bodySize * 2 && wickTop < bodySize) {
    return { signal: 'bullish', confidence: 0.7 };
  }

  // Shooting Star (Bearish Reversal)
  if (wickTop > bodySize * 2 && wickBottom < bodySize) {
    return { signal: 'bearish', confidence: 0.7 };
  }

  return { signal: 'neutral', confidence: 0 };
};

/**
 * 3. Support & Resistance Analysis
 * Uses Pivot Points.
 */
export const analyzeSupportResistance = (data: Candle[]): AnalysisResult => {
  if (data.length < 2) return { signal: 'neutral', confidence: 0 };

  const last = data[data.length - 1];
  const prev = data[data.length - 2]; // Use previous completed candle for Pivot Calculation
  
  const { pivot, r1, s1 } = calculatePivotPoints(prev.high, prev.low, prev.close);

  // Bounce off Support (S1) -> Bullish
  if (last.low <= s1 && last.close > s1) {
    return { signal: 'bullish', confidence: 0.75 };
  }

  // Rejection at Resistance (R1) -> Bearish
  if (last.high >= r1 && last.close < r1) {
    return { signal: 'bearish', confidence: 0.75 };
  }

  // Breakout above Resistance -> Bullish
  if (prev.close < r1 && last.close > r1) {
    return { signal: 'bullish', confidence: 0.8 };
  }

  // Breakdown below Support -> Bearish
  if (prev.close > s1 && last.close < s1) {
    return { signal: 'bearish', confidence: 0.8 };
  }

  return { signal: 'neutral', confidence: 0.5 };
};

/**
 * 4. Volume Analysis
 * Checks for volume spikes confirming trends.
 */
export const analyzeVolume = (data: Candle[]): AnalysisResult => {
  if (data.length < 20) return { signal: 'neutral', confidence: 0 };

  const isSpike = detectVolumeSpike(data, 2.0); // 2x average volume
  const last = data[data.length - 1];

  if (isSpike) {
    if (last.close > last.open) {
      return { signal: 'bullish', confidence: 0.85 };
    } else {
      return { signal: 'bearish', confidence: 0.85 };
    }
  }

  return { signal: 'neutral', confidence: 0.5 };
};

/**
 * 5. Market Structure & Momentum (RSI)
 */
export const analyzeMarketStructure = (data: Candle[]): AnalysisResult => {
  if (data.length < 14) return { signal: 'neutral', confidence: 0 };

  const rsi = calculateRSI(data, 14);
  const currentRSI = rsi[rsi.length - 1];

  // Oversold -> Bullish
  if (currentRSI < 30) {
    return { signal: 'bullish', confidence: 0.8 };
  }

  // Overbought -> Bearish
  if (currentRSI > 70) {
    return { signal: 'bearish', confidence: 0.8 };
  }

  return { signal: 'neutral', confidence: 0.5 };
};

/**
 * 6. Momentum Analysis (15m/1h Gainers)
 */
export const analyzeMomentum = (data: Candle[]): AnalysisResult => {
  // Assuming data is 15m candles
  if (data.length < 5) return { signal: 'neutral', confidence: 0 };
  
  const last = data[data.length - 1];
  const close = last.close;
  
  // 15m Change (Current candle body)
  const change15m = ((close - last.open) / last.open) * 100;
  
  // 1h Change (Approx last 4 candles)
  const candle1hAgo = data[data.length - 5]; 
  // If we don't have enough history, fallback to just 15m
  const baseOpen = candle1hAgo ? candle1hAgo.open : data[0].open;
  
  const change1h = ((close - baseOpen) / baseOpen) * 100;

  // Thresholds: 1.5% for 1h, 0.8% for 15m (aggressive for crypto)
  if (change1h > 1.5 || change15m > 0.8) {
    return { signal: 'bullish', confidence: 0.9 };
  }
  if (change1h < -1.5 || change15m < -0.8) {
    return { signal: 'bearish', confidence: 0.9 };
  }

  return { signal: 'neutral', confidence: 0.5 };
};

/**
 * Main Analysis Function - Combines all 6 methods
 */
export const analyzeMarket = (data: Candle[]) => {
  const elliott = analyzeElliottWave(data);
  const patterns = analyzePatterns(data);
  const sr = analyzeSupportResistance(data);
  const volume = analyzeVolume(data);
  const structure = analyzeMarketStructure(data);
  const momentum = analyzeMomentum(data);

  const results = {
    elliottWave: elliott,
    patterns: patterns,
    supportResistance: sr,
    volume: volume,
    marketStructure: structure,
    momentum: momentum
  };

  // Calculate Confluence
  let bullishCount = 0;
  let bearishCount = 0;
  const confluenceDetail: Record<string, boolean> = {};

  Object.entries(results).forEach(([key, result]) => {
    if (result.signal === 'bullish') {
      bullishCount++;
      confluenceDetail[key] = true;
    } else if (result.signal === 'bearish') {
      bearishCount++;
      confluenceDetail[key] = true; // Mark as "triggered"
    } else {
      confluenceDetail[key] = false;
    }
  });

  // Determine Final Decision
  // We need at least 3 indicators pointing in the same direction
  let finalSignal: 'LONG' | 'SHORT' | null = null;
  let strength = 0;
  const totalMethods = 6;

  if (bullishCount >= 3) {
    finalSignal = 'LONG';
    strength = Math.round((bullishCount / totalMethods) * 10);
  } else if (bearishCount >= 3) {
    finalSignal = 'SHORT';
    strength = Math.round((bearishCount / totalMethods) * 10);
  }

  // Calculate Risk Params (ATR based)
  const atr = calculateATR(data, 14);
  const currentATR = atr[atr.length - 1] || 0;
  const lastParam = data[data.length - 1];
  const close = lastParam.close;

  let stopLoss = 0;
  let takeProfit = 0;

  if (finalSignal === 'LONG') {
    stopLoss = close - (currentATR * 1.5); // 1.5 ATR SL
    takeProfit = close + (currentATR * 3); // 1:2 Risk Reward
  } else if (finalSignal === 'SHORT') {
    stopLoss = close + (currentATR * 1.5);
    takeProfit = close - (currentATR * 3);
  }

  return {
    signal: finalSignal,
    symbol: '', // To be filled by caller
    type: finalSignal,
    entry: close,
    stopLoss,
    takeProfit,
    strength,
    confluence: confluenceDetail
  };
};

/**
 * 7. Short Term Prediction (Next 5 Minutes)
 * Uses 5m data to forecast immediate price action.
 */
export const predictShortTerm = (data: Candle[]) => {
  if (data.length < 20) return { direction: 'NEUTRAL', probability: 'LOW', target: 0 };

  const last = data[data.length - 1];
  const ema9 = calculateEMA(data, 9);
  const ema21 = calculateEMA(data, 21);
  const rsi = calculateRSI(data, 9);
  
  const currentEMA9 = ema9[ema9.length - 1];
  const currentEMA21 = ema21[ema21.length - 1];
  const currentRSI = rsi[rsi.length - 1];
  
  let direction = 'NEUTRAL';
  let probability = 'LOW';
  
  // Trend Logic
  if (currentEMA9 > currentEMA21) {
    direction = 'UP';
    probability = currentRSI < 70 ? 'HIGH' : 'MEDIUM'; // High prob if not overbought
  } else if (currentEMA9 < currentEMA21) {
    direction = 'DOWN';
    probability = currentRSI > 30 ? 'HIGH' : 'MEDIUM'; // High prob if not oversold
  }
  
  // ATR for Target
  const atr = calculateATR(data, 14);
  const currentATR = atr[atr.length - 1] || 0;
  
  // 5m Forecast Target (approx 1 ATR move)
  let target = 0;
  if (direction === 'UP') target = last.close + currentATR;
  if (direction === 'DOWN') target = last.close - currentATR;
  
  return { direction, probability, target, currentPrice: last.close };
};
