import 'dart:math';
import '../models/candle.dart';

class AnalysisService {
  static List<double> calculateRSI(List<Candle> candles, {int period = 14}) {
    if (candles.length <= period) return [];
    
    List<double> rsiValues = [];
    double gain = 0;
    double loss = 0;

    for (int i = 1; i <= period; i++) {
      double diff = candles[i].close - candles[i - 1].close;
      if (diff >= 0) {
        gain += diff;
      } else {
        loss -= diff;
      }
    }

    double avgGain = gain / period;
    double avgLoss = loss / period;
    
    double rs = avgLoss == 0 ? 100 : avgGain / avgLoss;
    rsiValues.add(100 - (100 / (1 + rs)));

    for (int i = period + 1; i < candles.length; i++) {
      double diff = candles[i].close - candles[i - 1].close;
      double currentGain = diff >= 0 ? diff : 0;
      double currentLoss = diff < 0 ? -diff : 0;

      avgGain = (avgGain * (period - 1) + currentGain) / period;
      avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

      rs = avgLoss == 0 ? 100 : avgGain / avgLoss;
      rsiValues.add(100 - (100 / (1 + rs)));
    }

    return rsiValues;
  }

  static List<double> calculateEMA(List<double> values, int period) {
    if (values.length < period) return [];
    
    List<double> ema = [];
    double multiplier = 2 / (period + 1);
    
    double initialSma = values.take(period).reduce((a, b) => a + b) / period;
    ema.add(initialSma);

    for (int i = period; i < values.length; i++) {
      ema.add((values[i] - ema.last) * multiplier + ema.last);
    }
    
    return ema;
  }

  static Map<String, List<double>> calculateMACD(List<Candle> candles) {
    final closes = candles.map((c) => c.close).toList();
    final ema12 = calculateEMA(closes, 12);
    final ema26 = calculateEMA(closes, 26);
    
    if (ema12.isEmpty || ema26.isEmpty) return {'macd': [], 'signal': [], 'histogram': []};

    int offset = ema12.length - ema26.length;
    List<double> macdLine = [];
    for (int i = 0; i < ema26.length; i++) {
      macdLine.add(ema12[i + offset] - ema26[i]);
    }

    final signalLine = calculateEMA(macdLine, 9);
    
    int signalOffset = macdLine.length - signalLine.length;
    List<double> histogram = [];
    for (int i = 0; i < signalLine.length; i++) {
      histogram.add(macdLine[i + signalOffset] - signalLine[i]);
    }

    return {
      'macd': macdLine,
      'signal': signalLine,
      'histogram': histogram,
    };
  }

  static Map<String, List<double>> calculateBollingerBands(List<Candle> candles, {int period = 20, double stdDev = 2.0}) {
    if (candles.length < period) return {'upper': [], 'middle': [], 'lower': []};
    
    List<double> upper = [];
    List<double> middle = [];
    List<double> lower = [];

    for (int i = period - 1; i < candles.length; i++) {
      final slice = candles.sublist(i - period + 1, i + 1).map((c) => c.close);
      double sma = slice.reduce((a, b) => a + b) / period;
      
      double variance = slice.map((c) => pow(c - sma, 2)).reduce((a, b) => a + b) / period;
      double sd = sqrt(variance);

      middle.add(sma);
      upper.add(sma + (stdDev * sd));
      lower.add(sma - (stdDev * sd));
    }

    return {'upper': upper, 'middle': middle, 'lower': lower};
  }
  static List<double> calculateATR(List<Candle> candles, {int period = 14}) {
    if (candles.length <= period) return [];
    
    List<double> trValues = [];
    for (int i = 1; i < candles.length; i++) {
      double h = candles[i].high;
      double l = candles[i].low;
      double pc = candles[i - 1].close;
      trValues.add([h - l, (h - pc).abs(), (l - pc).abs()].reduce(max));
    }

    List<double> atrValues = [];
    double initialSum = trValues.take(period).reduce((a, b) => a + b);
    atrValues.add(initialSum / period);

    for (int i = period; i < trValues.length; i++) {
      atrValues.add((atrValues.last * (period - 1) + trValues[i]) / period);
    }
    
    return atrValues;
  }

  static List<Map<String, double>> calculateHeikinAshi(List<Candle> candles) {
    if (candles.isEmpty) return [];
    
    List<Map<String, double>> haData = [];
    
    // First candle
    haData.add({
      'open': candles[0].open,
      'high': candles[0].high,
      'low': candles[0].low,
      'close': (candles[0].open + candles[0].high + candles[0].low + candles[0].close) / 4,
    });

    for (int i = 1; i < candles.length; i++) {
      double prevOpen = haData[i - 1]['open']!;
      double prevClose = haData[i - 1]['close']!;
      
      double close = (candles[i].open + candles[i].high + candles[i].low + candles[i].close) / 4;
      double open = (prevOpen + prevClose) / 2;
      double high = [candles[i].high, open, close].reduce(max);
      double low = [candles[i].low, open, close].reduce(min);
      
      haData.add({'open': open, 'high': high, 'low': low, 'close': close});
    }
    
    return haData;
  }

  static bool detectVolumeSpike(List<Candle> candles, {double threshold = 2.0}) {
    if (candles.length < 20) return false;
    double avgVolume = candles.sublist(candles.length - 21, candles.length - 1)
        .map((c) => c.volume).reduce((a, b) => a + b) / 20;
    return candles.last.volume > avgVolume * threshold;
  }

  static Map<String, List<String>> detectCandlePatterns(List<Candle> data) {
    if (data.length < 3) return {'bullish': [], 'bearish': []};
    List<String> bullish = [];
    List<String> bearish = [];
    
    final last = data.last;
    final prev = data[data.length - 2];
    double lastBody = (last.close - last.open).abs();

    // Engulfing
    if (prev.close < prev.open && last.close > last.open && last.close > prev.open && last.open < prev.close) bullish.add('Engulfing');
    if (prev.close > prev.open && last.close < last.open && last.close < prev.open && last.open > prev.close) bearish.add('Engulfing');

    // Hammer / Shooting Star
    double lastLowerWick = min(last.open, last.close) - last.low;
    double lastUpperWick = last.high - max(last.open, last.close);
    if (lastLowerWick > lastBody * 2 && lastUpperWick < lastBody) bullish.add('Hammer');
    if (lastUpperWick > lastBody * 2 && lastLowerWick < lastBody) bearish.add('Shooting Star');

    return {'bullish': bullish, 'bearish': bearish};
  }

  static Map<String, dynamic> validateElliottWave(List<Candle> data) {
    if (data.length < 50) return {'score': 0, 'reasons': [], 'direction': 'neutral'};
    
    final recent = data.sublist(data.length - 50);
    double maxHigh = recent.map((c) => c.high).reduce(max);
    double minLow = recent.map((c) => c.low).reduce(min);
    double currentPrice = data.last.close;
    double range = maxHigh - minLow;
    
    bool isUpTrend = currentPrice > (maxHigh + minLow) / 2;
    int score = 0;
    List<String> reasons = [];

    if (isUpTrend) {
      if (currentPrice > minLow + (range * 0.618)) { score++; reasons.add('Elliott: Bullish Impulse'); }
      double pullback = (maxHigh - currentPrice) / range;
      if (pullback >= 0.236 && pullback <= 0.618) { score++; reasons.add('Elliott: Wave 4 Pullback'); }
    } else {
      if (currentPrice < maxHigh - (range * 0.618)) { score++; reasons.add('Elliott: Bearish Impulse'); }
      double pullback = (currentPrice - minLow) / range;
      if (pullback >= 0.236 && pullback <= 0.618) { score++; reasons.add('Elliott: Wave 2 Pullback'); }
    }

    return {'score': score, 'reasons': reasons, 'direction': isUpTrend ? 'bullish' : 'bearish'};
  }

  static Map<String, dynamic> calculateTechnicalSignal(List<Candle> data) {
    if (data.length < 50) return {'action': 'NEUTRAL', 'confidence': 0, 'reasons': [], 'status': {}};
    
    double bullPoints = 0;
    double bearPoints = 0;
    List<String> reasons = [];
    Map<String, String> status = {};
    double currentPrice = data.last.close;

    // 1. RSI
    final rsiValues = calculateRSI(data);
    double rsi = rsiValues.isNotEmpty ? rsiValues.last : 50;
    if (rsi < 40) { bullPoints++; status['RSI'] = 'bullish'; reasons.add('RSI: Oversold'); }
    else if (rsi > 60) { bearPoints++; status['RSI'] = 'bearish'; reasons.add('RSI: Overbought'); }

    // 2. MACD
    final macd = calculateMACD(data);
    if (macd['histogram']!.isNotEmpty) {
      bool isBull = macd['histogram']!.last > 0;
      if (isBull) bullPoints++; else bearPoints++;
      status['MACD'] = isBull ? 'bullish' : 'bearish';
    }

    // 3. Bollinger Bands
    final bb = calculateBollingerBands(data);
    if (bb['upper']!.isNotEmpty) {
      if (currentPrice < bb['lower']!.last) { bullPoints++; status['BB'] = 'bullish'; reasons.add('BB: Oversold'); }
      else if (currentPrice > bb['upper']!.last) { bearPoints++; status['BB'] = 'bearish'; reasons.add('BB: Overbought'); }
    }

    // 4. Volume
    if (detectVolumeSpike(data)) {
      bool isBull = data.last.close > data.last.open;
      if (isBull) bullPoints++; else bearPoints++;
      status['Volume'] = isBull ? 'bullish' : 'bearish';
      reasons.add('Volume: ${isBull ? 'Buy' : 'Sell'} Spike');
    }

    // 5. Elliott Wave
    final ew = validateElliottWave(data);
    reasons.addAll(List<String>.from(ew['reasons']));
    if (ew['direction'] == 'bullish') bullPoints += (ew['score'] / 2);
    else bearPoints += (ew['score'] / 2);

    // 6. Heikin Ashi
    final ha = calculateHeikinAshi(data);
    bool isHABull = ha.last['close']! > ha.last['open']!;
    if (isHABull) bullPoints++; else bearPoints++;
    status['HEIKIN ASHI'] = isHABull ? 'bullish' : 'bearish';

    // 7. Patterns
    final patterns = detectCandlePatterns(data);
    if (patterns['bullish']!.isNotEmpty) { bullPoints += 0.5; reasons.add('Candle: Bullish Pattern'); }
    if (patterns['bearish']!.isNotEmpty) { bearPoints += 0.5; reasons.add('Candle: Bearish Pattern'); }

    double maxPoints = max(bullPoints, bearPoints);
    int confidence = ((maxPoints / 10) * 100).round().clamp(0, 100);
    String action = 'NEUTRAL';
    if (bullPoints >= 7) action = 'STRONG BUY';
    else if (bullPoints >= 4) action = 'BUY';
    else if (bearPoints >= 7) action = 'STRONG SELL';
    else if (bearPoints >= 4) action = 'SELL';

    return {'action': action, 'confidence': confidence, 'reasons': reasons, 'status': status, 'currentPrice': currentPrice};
  }
}
