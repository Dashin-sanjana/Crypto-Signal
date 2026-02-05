import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { WATCHLIST, BINANCE_WS_BASE, BINANCE_API_BASE } from '../utils/constants';

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
  const [setupTimeframe, setSetupTimeframe] = useState<string>('5m');
  const [volatility, setVolatility] = useState<number>(0.01); // Default non-zero
  const [liquidationPrice, setLiquidationPrice] = useState<number | null>(null);
  const [tpslData, setTpslData] = useState<TPSLData | null>(null);
  const [watchlist, setWatchlist] = useState(WATCHLIST);
  const [activeConnections, setActiveConnections] = useState<Record<string, WebSocket>>({});
  const [tradeDirection, setTradeDirection] = useState<TradeDirection>('BUY');

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

  // Calculate volatility (ATR-like) once when symbol or setup timeframe changes
  useEffect(() => {
    const updateVolatility = async () => {
      const klines = await fetchKlineData(selectedSymbol, setupTimeframe, 50);
      if (klines.length > 0) {
        const ranges = klines.slice(-14).map(k => k.high - k.low);
        const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
        // Ensure some volatility exists to prevent overlapping lines (min 1% for safety)
        setVolatility(Math.max(avgRange, (klines[klines.length-1].close * 0.01)));
      }
    };
    updateVolatility();
    setLiquidationPrice(null); // Reset liquidation on symbol change
  }, [selectedSymbol, setupTimeframe, fetchKlineData]);

  // Update TP/SL on every price tick
  useEffect(() => {
    const currentPrice = prices[selectedSymbol]?.price;
    if (currentPrice && volatility > 0) {
      let sl, tp1, tp2;

      if (tradeDirection === 'BUY') {
        if (liquidationPrice && liquidationPrice < currentPrice) {
          // Safe SL: Positioned at least 20% away from liquidation OR standard ATR
          const liqDistance = currentPrice - liquidationPrice;
          const safeBuffer = liqDistance * 0.2; 
          sl = liquidationPrice + safeBuffer;
          
          tp1 = currentPrice + (Math.abs(currentPrice - sl) * 1.5);
          tp2 = currentPrice + (Math.abs(currentPrice - sl) * 3);
        } else {
          // Standard Stable Logic for BUY
          sl = currentPrice - (volatility * 2.5);
          tp1 = currentPrice + (volatility * 1.5);
          tp2 = currentPrice + (volatility * 3.5);
        }
      } else {
        // SELL Direction Logic
        if (liquidationPrice && liquidationPrice > currentPrice) {
          const liqDistance = liquidationPrice - currentPrice;
          const safeBuffer = liqDistance * 0.2;
          sl = liquidationPrice - safeBuffer;
          
          tp1 = currentPrice - (Math.abs(sl - currentPrice) * 1.5);
          tp2 = currentPrice - (Math.abs(sl - currentPrice) * 3);
        } else {
          // Standard Stable Logic for SELL
          sl = currentPrice + (volatility * 2.5);
          tp1 = currentPrice - (volatility * 1.5);
          tp2 = currentPrice - (volatility * 3.5);
        }
      }
      
      const risk = Math.abs(currentPrice - sl);
      const rr = risk > 0 ? (Math.abs(tp2 - currentPrice)) / risk : 0;

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
  }, [prices, selectedSymbol, volatility, liquidationPrice, tradeDirection]);

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
    setTradeDirection
  };

  return (
    <PriceContext.Provider value={value}>
      {children}
    </PriceContext.Provider>
  );
};

