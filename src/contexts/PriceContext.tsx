import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { WATCHLIST, BINANCE_WS_BASE, BINANCE_API_BASE } from '../utils/constants';
import { calculateTechnicalSignal } from '../utils/analysis';

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  lastUpdate: number;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type TradeDirection = 'BUY' | 'SELL';

interface TPSLData {
  symbol: string;
  entry: number;
  tp1: number;
  tp2: number;
  sl: number;
  rr: number;
  direction: TradeDirection;
  timestamp: number;
}

interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
}

interface PriceContextType {
  prices: Record<string, PriceData>;
  priceHistory: Record<string, Candle[]>;
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  timeframe: string;
  setTimeframe: (tf: string) => void;
  isConnected: boolean;
  fetchKlineData: (symbol: string, interval?: string, limit?: number) => Promise<Candle[]>;
  allSymbols: SymbolInfo[];
  tpslData: TPSLData | null;
  watchlist: { symbol: string; name: string; ticker: string }[];
  addToWatchlist: (symbol: SymbolInfo) => void;
  setupTimeframe: string;
  setSetupTimeframe: (tf: string) => void;
  liquidationPrice: number | null;
  setLiquidationPrice: (price: number | null) => void;
  tradeDirection: TradeDirection;
  setTradeDirection: (dir: TradeDirection) => void;
  recommendation: {
    action: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
    confidence: number;
    reasons: string[];
    ewScore: number;
  };
  indicatorStatus: Record<string, 'bullish' | 'bearish' | 'neutral'>;
}

const PriceContext = createContext<PriceContextType | undefined>(undefined);

export const usePriceContext = () => {
  const context = useContext(PriceContext);
  if (!context) {
    throw new Error('usePriceContext must be used within PriceProvider');
  }
  return context;
};

interface PriceProviderProps {
  children: ReactNode;
}

export const PriceProvider: React.FC<PriceProviderProps> = ({ children }) => {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [priceHistory, setPriceHistory] = useState<Record<string, Candle[]>>({});
  const [selectedSymbol, setSelectedSymbol] = useState<string>(WATCHLIST[0].symbol);
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [allSymbols, setAllSymbols] = useState<SymbolInfo[]>([]);
  const [setupTimeframe, setSetupTimeframe] = useState<string>('5m'); // Strictly 5m for predictions
  const [liquidationPrice, setLiquidationPrice] = useState<number | null>(null);
  const [tpslData, setTpslData] = useState<TPSLData | null>(null);
  const [watchlist, setWatchlist] = useState(WATCHLIST);
  const [activeConnections, setActiveConnections] = useState<Record<string, WebSocket>>({});
  const [tradeDirection, setTradeDirection] = useState<TradeDirection>('BUY');
  const [recommendation, setRecommendation] = useState<{
    action: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
    confidence: number;
    reasons: string[];
    ewScore: number;
  }>({ action: 'NEUTRAL', confidence: 0, reasons: [], ewScore: 0 });
  const [indicatorStatus, setIndicatorStatus] = useState<Record<string, 'bullish' | 'bearish' | 'neutral'>>({});

  // Fetch all available symbols from Binance
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const response = await fetch(`${BINANCE_API_BASE}/exchangeInfo`);
        const data = await response.json();
        const usdtSymbols = data.symbols
          .filter((s: any) => s.quoteAsset === 'USDT' && s.status === 'TRADING')
          .map((s: any) => ({
            symbol: s.symbol,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset
          }));
        setAllSymbols(usdtSymbols);
      } catch (error) {
        console.error('Error fetching exchange info:', error);
      }
    };
    fetchSymbols();
  }, []);

  // Fetch historical kline data
  const fetchKlineData = useCallback(async (symbol: string, interval: string = '5m', limit: number = 500) => {
    try {
      const response = await fetch(
        `${BINANCE_API_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
      );
      const data = await response.json();
      
      const candles: Candle[] = data.map((candle: any) => ({
        time: candle[0] / 1000,
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));

      setPriceHistory(prev => ({
        ...prev,
        [`${symbol}_${interval}`]: candles
      }));

      return candles;
    } catch (error) {
      console.error(`Error fetching kline data for ${symbol}:`, error);
      return [];
    }
  }, []);

  // Fetch history when symbol changes
  useEffect(() => {
    fetchKlineData(selectedSymbol, setupTimeframe, 50); // Consistent 50 candles
    setLiquidationPrice(null);
  }, [selectedSymbol, setupTimeframe, fetchKlineData]);

  // Helper to find swing points for Fibonacci
  const getSwingPoints = useCallback((klines: Candle[]) => {
    if (klines.length < 20) return null;
    const recent = klines.slice(-30); // Look at last 30 candles for recent move
    const highs = recent.map(k => k.high);
    const lows = recent.map(k => k.low);
    return {
      high: Math.max(...highs),
      low: Math.min(...lows)
    };
  }, []);

  // Update TP/SL on every price tick
  useEffect(() => {
    const currentPrice = prices[selectedSymbol]?.price;
    const history = priceHistory[`${selectedSymbol}_${setupTimeframe}`];
    
    if (currentPrice && history && history.length >= 20) {
      const swings = getSwingPoints(history);
      if (!swings) return;
      
      const { high, low } = swings;
      const range = Math.max(0.0001, high - low);
      
      let sl, tp1, tp2;

      if (tradeDirection === 'BUY') {
        // Stop Loss below recent low (Wave 2/4 base)
        sl = low - (range * 0.236); 
        tp1 = high + (range * 0.618);
        tp2 = high + (range * 1.618);
        
        // Logical check: SL must be below current price
        sl = Math.min(sl, currentPrice * 0.985); 
      } else {
        // Stop Loss above recent high
        sl = high + (range * 0.236); 
        tp1 = low - (range * 0.618);
        tp2 = low - (range * 1.618);
        
        // Logical check: SL must be above current price
        sl = Math.max(sl, currentPrice * 1.015);
      }
      
      const risk = Math.abs(currentPrice - sl);
      const rr = risk > 0 ? (Math.abs(tp2 - currentPrice)) / risk : 0;
      
      const signal = calculateTechnicalSignal(history, currentPrice);
      if (signal) {
        setRecommendation({
          action: signal.action,
          confidence: signal.confidence,
          reasons: signal.reasons,
          ewScore: signal.ewScore
        });
        setIndicatorStatus(signal.status);
      }

      setTpslData({
        symbol: selectedSymbol,
        entry: currentPrice,
        tp1,
        tp2,
        sl,
        rr,
        direction: tradeDirection,
        timestamp: Date.now()
      });
    }
  }, [prices, selectedSymbol, priceHistory, setupTimeframe, tradeDirection, getSwingPoints]);

  // Connect to Binance WebSocket for real-time prices
  const connectWebSocket = useCallback((symbol: string) => {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    const ws = new WebSocket(`${BINANCE_WS_BASE}/${streamName}`);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // STRICT FIX: Ensure we only update if the symbol matches
      if (data.s === symbol) {
        setPrices(prev => ({
          ...prev,
          [symbol]: {
            symbol: data.s,
            price: parseFloat(data.c),
            change24h: parseFloat(data.P),
            high24h: parseFloat(data.h),
            low24h: parseFloat(data.l),
            volume24h: parseFloat(data.v),
            lastUpdate: Date.now()
          }
        }));
      }
    };

    ws.onclose = () => {
      // Reconnect logic managed by effect
    };

    return ws;
  }, []);

  // Manage WebSocket connections based on watchlist
  useEffect(() => {
    const newConnections: Record<string, WebSocket> = { ...activeConnections };
    
    // Connect to new symbols
    watchlist.forEach(({ symbol }) => {
      if (!newConnections[symbol]) {
        newConnections[symbol] = connectWebSocket(symbol);
      }
    });

    setActiveConnections(newConnections);

    return () => {
      // Cleanup on unmount
    };
  }, [watchlist, connectWebSocket]);

  const addToWatchlist = (symbolInfo: SymbolInfo) => {
    if (!watchlist.find(s => s.symbol === symbolInfo.symbol)) {
      setWatchlist([...watchlist, {
        symbol: symbolInfo.symbol,
        name: symbolInfo.baseAsset,
        ticker: symbolInfo.baseAsset
      }]);
    }
    setSelectedSymbol(symbolInfo.symbol);
  };

  const value = {
    prices,
    priceHistory,
    selectedSymbol,
    setSelectedSymbol,
    timeframe,
    setTimeframe,
    isConnected,
    fetchKlineData,
    allSymbols,
    tpslData,
    watchlist,
    setWatchlist,
    addToWatchlist,
    setupTimeframe,
    setSetupTimeframe,
    liquidationPrice,
    setLiquidationPrice,
    tradeDirection,
    setTradeDirection,
    recommendation,
    indicatorStatus
  };

  return (
    <PriceContext.Provider value={value}>
      {children}
    </PriceContext.Provider>
  );
};

