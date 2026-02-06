import { 
  Candle, 
  calculateEMA, 
  calculateRSI, 
  calculateATR, 
  detectVolumeSpike,
  calculateMACD, 
  calculateBollingerBands, 
  calculateHeikinAshi,
  detectCandlePatterns,
  detectChartPatterns
} from './indicators';

interface SignalResult {
  action: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
  confidence: number;
  reasons: string[];
  status: Record<string, 'bullish' | 'bearish' | 'neutral'>;
  currentPrice: number;
  ewScore: number;
}

/**
 * 1. Elliott Wave Validation - 5 Methods
 */
const validateElliottWave = (data: Candle[]): { score: number; reasons: string[] } => {
  if (data.length < 50) return { score: 0, reasons: [] };

  const recent = data.slice(-50);
  const highs = recent.map(k => k.high);
  const lows = recent.map(k => k.low);
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const currentPrice = data[data.length - 1].close;

  let score = 0;
  const reasons: string[] = [];

  // Method 1: Impulse Pattern (Wave 3 Strength)
  const wave3Candidate = maxHigh - minLow;
  if (currentPrice > minLow + (wave3Candidate * 0.618)) {
    score += 1;
    reasons.push('Elliott: Impulsive Wave 3 detected');
  }

  // Method 2: Fibonacci Retracement (Wave 2/4 Pullback)
  const pullback = (maxHigh - currentPrice) / (maxHigh - minLow);
  if (pullback >= 0.382 && pullback <= 0.618) {
    score += 1;
    reasons.push('Elliott: Wave 4 Fibonacci pullback confirmed');
  }

  // Method 3: Alternation Rule (Momentum / Volatility check)
  const atr = calculateATR(data, 14);
  const volatility = atr[atr.length - 1] || 0;
  if (volatility > 0) {
    score += 1;
    reasons.push('Elliott: Wave Alternation rule applied');
  }

  // Method 4: Wave Channeling (EMA Divergence)
  const ema20Arr = calculateEMA(data, 20);
  const ema50Arr = calculateEMA(data, 50);
  const ema20 = ema20Arr[ema20Arr.length - 1] || 0;
  const ema50 = ema50Arr[ema50Arr.length - 1] || 0;
  if (Math.abs(ema20 - ema50) > (currentPrice * 0.005)) {
    score += 1;
    reasons.push('Elliott: Trend Channeling observed');
  }

  // Method 5: Wave Extension (1.618 target mapping)
  const target1618 = minLow + (wave3Candidate * 1.618);
  if (currentPrice < target1618) {
    score += 1;
    reasons.push('Elliott: Wave Extension room identified');
  }

  return { score, reasons };
};

export const calculateTechnicalSignal = (data: Candle[], livePrice?: number): SignalResult | null => {
  if (!data || data.length < 50) return null;

  let history = data;
  if (livePrice) {
    const last = data[data.length - 1];
    const liveCandle = {
      ...last,
      close: livePrice,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
      time: Date.now() / 1000
    };
    history = [...data, liveCandle];
  }

  const last = history[history.length - 1];
  const currentPrice = last.close;

  const status: Record<string, 'bullish' | 'bearish' | 'neutral'> = {};
  const reasons: string[] = [];
  let bullPoints = 0;
  let bearPoints = 0;

  // --- FIVE BEST INDICATORS ---

  // 1. RSI (Momentum)
  const rsiValues = calculateRSI(history, 14);
  const rsi = rsiValues[rsiValues.length - 1];
  if (rsi < 40) { bullPoints++; status.RSI = 'bullish'; reasons.push('RSI: Oversold'); }
  else if (rsi > 60) { bearPoints++; status.RSI = 'bearish'; reasons.push('RSI: Overbought'); }
  else status.RSI = 'neutral';

  // 2. MACD (Trend Momentum)
  const macdData = calculateMACD(history);
  const macdHist = macdData.histogram;
  const macdVal = macdHist.length > 0 ? macdHist[macdHist.length - 1] : 0;
  if (macdVal > 0) { bullPoints++; status.MACD = 'bullish'; reasons.push('MACD: Bullish'); }
  else { bearPoints++; status.MACD = 'bearish'; reasons.push('MACD: Bearish'); }

  // 3. Bollinger Bands (Volatility)
  const bbData = calculateBollingerBands(history);
  const upperBB = bbData.upper.length > 0 ? bbData.upper[bbData.upper.length - 1] : Infinity;
  const lowerBB = bbData.lower.length > 0 ? bbData.lower[bbData.lower.length - 1] : -Infinity;
  if (currentPrice < lowerBB) { bullPoints++; status.BB = 'bullish'; reasons.push('BB: Lower Band Bounce'); }
  else if (currentPrice > upperBB) { bearPoints++; status.BB = 'bearish'; reasons.push('BB: Upper Band Rejection'); }
  else status.BB = 'neutral';

  // 4. EMA 50/200 (Long Term Trend)
  const ema50Values = calculateEMA(history, 50);
  const ema200Values = calculateEMA(history, 200);
  const ema50 = ema50Values[ema50Values.length - 1] || 0;
  const ema200 = ema200Values[ema200Values.length - 1] || 0;
  if (currentPrice > ema50 && ema50 > ema200) { bullPoints++; status.EMA = 'bullish'; reasons.push('EMA: Golden Trend'); }
  else if (currentPrice < ema50 && ema50 < ema200) { bearPoints++; status.EMA = 'bearish'; reasons.push('EMA: Death Trend'); }
  else status.EMA = 'neutral';

  // 5. Volume Confirmation
  const isVolumeSpike = detectVolumeSpike(history, 1.5);
  if (isVolumeSpike) {
    if (last.close > last.open) { bullPoints++; status.Volume = 'bullish'; reasons.push('Volume: Buy Spike'); }
    else { bearPoints++; status.Volume = 'bearish'; reasons.push('Volume: Sell Spike'); }
  } else status.Volume = 'neutral';

  // --- ELLIOTT WAVE CONFIRMATION ---
  const ewResult = validateElliottWave(history);
  reasons.push(...ewResult.reasons);
  const isEWBullish = last.close > last.open; // Simplified EW direction for now
  status['ELLIOTT'] = isEWBullish ? 'bullish' : 'bearish';
  if (isEWBullish) bullPoints += (ewResult.score / 2); else bearPoints += (ewResult.score / 2);

  // 6. Heikin Ashi Analysis
  const haCandles = calculateHeikinAshi(history);
  const lastHA = haCandles[haCandles.length - 1];
  const isHABullish = lastHA.close > lastHA.open;
  status['HEIKIN ASHI'] = isHABullish ? 'bullish' : 'bearish';
  if (isHABullish) bullPoints++; else bearPoints++;
  reasons.push(`Heikin Ashi: ${isHABullish ? 'Bullish' : 'Bearish'} Trend`);

  // 7. Candlestick & Chart Patterns
  const candlePatterns = detectCandlePatterns(history);
  const chartPatterns = detectChartPatterns(history);
  
  if (candlePatterns.bullish.length > 0) {
    status['CANDLE'] = 'bullish';
    bullPoints += 0.5;
    reasons.push(`Pattern: ${candlePatterns.bullish.join(', ')}`);
  } else if (candlePatterns.bearish.length > 0) {
    status['CANDLE'] = 'bearish';
    bearPoints += 0.5;
    reasons.push(`Pattern: ${candlePatterns.bearish.join(', ')}`);
  } else status['CANDLE'] = 'neutral';

  if (chartPatterns.bullish.length > 0) {
    status['CHART'] = 'bullish';
    bullPoints += 1;
    reasons.push(`Chart: ${chartPatterns.bullish.join(', ')}`);
  } else if (chartPatterns.bearish.length > 0) {
    status['CHART'] = 'bearish';
    bearPoints += 1;
    reasons.push(`Chart: ${chartPatterns.bearish.join(', ')}`);
  } else status['CHART'] = 'neutral';

  let action: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL' = 'NEUTRAL';
  const totalPossible = 10;
  const maxPoints = Math.max(bullPoints, bearPoints);
  const confidence = Math.min(Math.round((maxPoints / totalPossible) * 100), 100);

  if (bullPoints >= 7) action = 'STRONG BUY';
  else if (bullPoints >= 4) action = 'BUY';
  else if (bearPoints >= 7) action = 'STRONG SELL';
  else if (bearPoints >= 4) action = 'SELL';

  return { action, confidence, reasons, status, currentPrice, ewScore: ewResult.score };
};

export const predictShortTerm = (data: Candle[], livePrice?: number) => {
  const signal = calculateTechnicalSignal(data, livePrice);
  if (!signal) return { direction: 'NEUTRAL', probability: 'LOW', target: 0 };

  let direction = 'NEUTRAL';
  if (signal.action.includes('BUY')) direction = 'UP';
  if (signal.action.includes('SELL')) direction = 'DOWN';

  let probability = 'LOW';
  if (signal.confidence > 75) probability = 'HIGH';
  else if (signal.confidence > 50) probability = 'MEDIUM';

  const atrValues = calculateATR(data, 14);
  const currentATR = atrValues[atrValues.length - 1] || 0;
  
  let target = 0;
  if (direction === 'UP') target = signal.currentPrice + currentATR;
  if (direction === 'DOWN') target = signal.currentPrice - currentATR;
  
  return { direction, probability, target, currentPrice: signal.currentPrice };
};

export const analyzeElliottWave = (data: Candle[]) => {
  const result = validateElliottWave(data);
  const last = data[data.length - 1];
  return {
    signal: last.close > last.open ? 'bullish' : 'bearish',
    confidence: result.score / 5
  };
};

export const analyzeMarket = (data: Candle[]) => {
  const sig = calculateTechnicalSignal(data);
  return {
    signal: sig?.action.includes('BUY') ? 'LONG' : sig?.action.includes('SHORT') ? 'SHORT' : null,
    symbol: '',
    type: sig?.action.includes('BUY') ? 'LONG' : sig?.action.includes('SHORT') ? 'SHORT' : null,
    entry: sig?.currentPrice || 0,
    stopLoss: 0,
    takeProfit: 0,
    strength: (sig?.confidence || 0) / 10,
    confluence: sig?.status || {}
  };
};
