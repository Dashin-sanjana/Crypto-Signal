import { INDICATOR_SETTINGS, FIBONACCI_LEVELS } from './constants';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export const calculateEMA = (data: Candle[], period: number): number[] => {
  if (data.length < period) return [];
  
  const multiplier = 2 / (period + 1);
  const ema: number[] = [];
  
  // Calculate SMA for first value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  ema[period - 1] = sum / period;
  
  // Calculate EMA for remaining values
  for (let i = period; i < data.length; i++) {
    ema[i] = (data[i].close - ema[i - 1]) * multiplier + ema[i - 1];
  }
  
  return ema;
};

/**
 * Calculate Relative Strength Index (RSI)
 */
export const calculateRSI = (data: Candle[], period: number = INDICATOR_SETTINGS.rsi.period): number[] => {
  if (data.length < period + 1) return [];
  
  const rsi: number[] = [];
  let gains = 0;
  let losses = 0;
  
  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  rsi[period] = 100 - (100 / (1 + avgGain / avgLoss));
  
  // Calculate RSI for remaining values
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    rsi[i] = 100 - (100 / (1 + avgGain / avgLoss));
  }
  
  return rsi;
};

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export const calculateMACD = (data: Candle[]) => {
  const { fast, slow, signal } = INDICATOR_SETTINGS.macd;
  
  const emaFast = calculateEMA(data, fast);
  const emaSlow = calculateEMA(data, slow);
  
  const macdLine: number[] = [];
  const signalLine: number[] = [];
  const histogram: number[] = [];
  
  // Calculate MACD line
  for (let i = 0; i < data.length; i++) {
    const fastVal = emaFast[i];
    const slowVal = emaSlow[i];
    macdLine[i] = (fastVal !== undefined && slowVal !== undefined) ? fastVal - slowVal : 0;
  }
  
  // Calculate signal line (EMA of MACD line)
  const macdData = macdLine.map((value) => ({ close: value } as Candle));
  const signalEMA = calculateEMA(macdData, signal);
  
  // Calculate histogram
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== undefined && signalEMA[i] !== undefined) {
      signalLine[i] = signalEMA[i];
      histogram[i] = macdLine[i] - signalEMA[i];
    }
  }
  
  return { macdLine, signalLine, histogram };
};

/**
 * Calculate Bollinger Bands
 */
export const calculateBollingerBands = (data: Candle[], period: number = INDICATOR_SETTINGS.bollinger.period, stdDev: number = INDICATOR_SETTINGS.bollinger.stdDev) => {
  if (data.length < period) return { upper: [], middle: [], lower: [] };
  
  const middle: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    // Calculate SMA (middle band)
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    const sma = sum / period;
    middle[i] = sma;
    
    // Calculate standard deviation
    let variance = 0;
    for (let j = 0; j < period; j++) {
      variance += Math.pow(data[i - j].close - sma, 2);
    }
    const sd = Math.sqrt(variance / period);
    
    // Calculate upper and lower bands
    upper[i] = sma + (sd * stdDev);
    lower[i] = sma - (sd * stdDev);
  }
  
  return { upper, middle, lower };
};

/**
 * Calculate Average True Range (ATR)
 */
export const calculateATR = (data: Candle[], period: number = INDICATOR_SETTINGS.atr.period): number[] => {
  if (data.length < period + 1) return [];
  
  const tr: number[] = [];
  const atr: number[] = [];
  
  // Calculate True Range
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    
    tr[i] = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
  }
  
  // Calculate initial ATR (SMA of TR)
  let sum = 0;
  for (let i = 1; i <= period; i++) {
    sum += tr[i];
  }
  atr[period] = sum / period;
  
  // Calculate ATR for remaining values
  for (let i = period + 1; i < data.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  
  return atr;
};

/**
 * Calculate VWAP (Volume Weighted Average Price)
 */
export const calculateVWAP = (data: Candle[]): number[] => {
  const vwap: number[] = [];
  let cumulativePV = 0;
  let cumulativeVolume = 0;
  
  for (let i = 0; i < data.length; i++) {
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
    const pv = typicalPrice * data[i].volume;
    
    cumulativePV += pv;
    cumulativeVolume += data[i].volume;
    
    vwap[i] = cumulativePV / cumulativeVolume;
  }
  
  return vwap;
};

/**
 * Calculate Fibonacci Retracement Levels
 */
export const calculateFibonacciLevels = (high: number, low: number): Record<number, number> => {
  const diff = high - low;
  const levels: Record<number, number> = {};
  
  FIBONACCI_LEVELS.forEach(level => {
    levels[level] = high - (diff * level);
  });
  
  return levels;
};

/**
 * Detect volume spike
 */
export const detectVolumeSpike = (data: Candle[], threshold: number = 2): boolean => {
  if (data.length < 20) return false;
  
  // Calculate average volume of last 20 candles
  let sum = 0;
  for (let i = data.length - 21; i < data.length - 1; i++) {
    sum += data[i].volume;
  }
  const avgVolume = sum / 20;
  
  // Check if current volume is above threshold
  const currentVolume = data[data.length - 1].volume;
  return currentVolume > avgVolume * threshold;
};

/**
 * Calculate pivot points
 */
export const calculatePivotPoints = (high: number, low: number, close: number) => {
  const pivot = (high + low + close) / 3;
  
  return {
    pivot,
    r1: (2 * pivot) - low,
    r2: pivot + (high - low),
    r3: high + 2 * (pivot - low),
    s1: (2 * pivot) - high,
    s2: pivot - (high - low),
    s3: low - 2 * (high - pivot)
  };
};

/**
 * Detect divergence between price and indicator
 */
export const detectDivergence = (priceData: number[], indicatorData: number[], lookback: number = 5): 'bullish' | 'bearish' | null => {
  if (priceData.length < lookback * 2 || indicatorData.length < lookback * 2) {
    return null;
  }
  
  const len = priceData.length;
  
  // Check for bullish divergence (price making lower lows, indicator making higher lows)
  const priceLowerLow = priceData[len - 1] < priceData[len - lookback];
  const indicatorHigherLow = indicatorData[len - 1] > indicatorData[len - lookback];
  
  if (priceLowerLow && indicatorHigherLow) {
    return 'bullish';
  }
  
  // Check for bearish divergence (price making higher highs, indicator making lower highs)
  const priceHigherHigh = priceData[len - 1] > priceData[len - lookback];
  const indicatorLowerHigh = indicatorData[len - 1] < indicatorData[len - lookback];
  
  if (priceHigherHigh && indicatorLowerHigh) {
    return 'bearish';
  }
  
  return null;
};

/**
 * Calculate Heikin Ashi Candles
 */
export const calculateHeikinAshi = (data: Candle[]): Candle[] => {
  if (data.length === 0) return [];
  
  const haData: Candle[] = [];
  
  // First candle
  haData[0] = {
    ...data[0],
    close: (data[0].open + data[0].high + data[0].low + data[0].close) / 4
  };
  
  for (let i = 1; i < data.length; i++) {
    const prev = haData[i - 1];
    const curr = data[i];
    
    const haClose = (curr.open + curr.high + curr.low + curr.close) / 4;
    const haOpen = (prev.open + prev.close) / 2;
    const haHigh = Math.max(curr.high, haOpen, haClose);
    const haLow = Math.min(curr.low, haOpen, haClose);
    
    haData[i] = {
      ...curr,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose
    };
  }
  
  return haData;
};

/**
 * Detect Candlestick Patterns
 */
export const detectCandlePatterns = (data: Candle[]) => {
  if (data.length < 3) return { bullish: [], bearish: [] };
  
  const bullish: string[] = [];
  const bearish: string[] = [];
  
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  
  const lastBody = Math.abs(last.close - last.open);
  
  // Bullish Engulfing
  if (prev.close < prev.open && last.close > last.open && last.close > prev.open && last.open < prev.close) {
    bullish.push('Engulfing');
  }
  
  // Bearish Engulfing
  if (prev.close > prev.open && last.close < last.open && last.close < prev.open && last.open > prev.close) {
    bearish.push('Engulfing');
  }
  
  // Hammer
  const lastLowerWick = Math.min(last.open, last.close) - last.low;
  const lastUpperWick = last.high - Math.max(last.open, last.close);
  if (lastLowerWick > lastBody * 2 && lastUpperWick < lastBody) {
    bullish.push('Hammer');
  }
  
  // Shooting Star
  if (lastUpperWick > lastBody * 2 && lastLowerWick < lastBody) {
    bearish.push('Shooting Star');
  }
  
  // Doji
  if (lastBody < (last.high - last.low) * 0.1) {
    bullish.push('Doji'); // Could be reversal either way, but often used as consolidation/reversal
  }

  return { bullish, bearish };
};

/**
 * Detect Chart Patterns (Basic)
 */
export const detectChartPatterns = (data: Candle[]) => {
  if (data.length < 20) return { bullish: [], bearish: [] };
  
  const bullish: string[] = [];
  const bearish: string[] = [];
  
  const recent = data.slice(-20);
  const peaks: number[] = [];
  const troughs: number[] = [];
  
  for (let i = 1; i < recent.length - 1; i++) {
    if (recent[i].high > recent[i-1].high && recent[i].high > recent[i+1].high) peaks.push(recent[i].high);
    if (recent[i].low < recent[i-1].low && recent[i].low < recent[i+1].low) troughs.push(recent[i].low);
  }
  
  // Double Bottom
  if (troughs.length >= 2) {
    const t1 = troughs[troughs.length - 1];
    const t2 = troughs[troughs.length - 2];
    if (Math.abs(t1 - t2) < t1 * 0.002) bullish.push('Double Bottom');
  }
  
  // Double Top
  if (peaks.length >= 2) {
    const p1 = peaks[peaks.length - 1];
    const p2 = peaks[peaks.length - 2];
    if (Math.abs(p1 - p2) < p1 * 0.002) bearish.push('Double Top');
  }
  
  return { bullish, bearish };
};
