// API Endpoints
export const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws';
export const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

// Crypto Symbols
export const WATCHLIST = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', ticker: 'BTC' },
  { symbol: 'ETHUSDT', name: 'Ethereum', ticker: 'ETH' },
  { symbol: 'SOLUSDT', name: 'Solana', ticker: 'SOL' },
  { symbol: 'BNBUSDT', name: 'Binance Coin', ticker: 'BNB' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', ticker: 'AVAX' },
];

// Timeframes
export const TIMEFRAMES = [
  { label: '1m', value: '1m', seconds: 60 },
  { label: '5m', value: '5m', seconds: 300 },
  { label: '15m', value: '15m', seconds: 900 },
  { label: '1h', value: '1h', seconds: 3600 },
];

// Signal Settings
export const SIGNAL_STRENGTH_THRESHOLD = 7; // Minimum score out of 10
export const SIGNAL_EXPIRY_MINUTES = 15; // Signal expires after 15 minutes
export const MIN_RISK_REWARD = 2; // Minimum 1:2 risk/reward ratio

// News Sources
export const NEWS_SOURCES = [
  { name: 'CoinDesk', rss: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name: 'Cointelegraph', rss: 'https://cointelegraph.com/rss' },
  { name: 'Decrypt', rss: 'https://decrypt.co/feed' },
  { name: 'CryptoSlate', rss: 'https://cryptoslate.com/feed/' },
];

// Sentiment Keywords
export const BULLISH_KEYWORDS = [
  'bullish', 'rally', 'surge', 'pump', 'moon', 'breakout', 
  'adoption', 'partnership', 'upgrade', 'positive', 'growth', 'gains'
];

export const BEARISH_KEYWORDS = [
  'bearish', 'crash', 'dump', 'fall', 'drop', 'breakdown',
  'regulation', 'ban', 'hack', 'negative', 'decline', 'losses'
];

// Technical Indicator Settings
export const INDICATOR_SETTINGS = {
  ema: {
    fast: 20,
    medium: 50,
    slow: 200
  },
  rsi: {
    period: 14,
    overbought: 70,
    oversold: 30
  },
  macd: {
    fast: 12,
    slow: 26,
    signal: 9
  },
  bollinger: {
    period: 20,
    stdDev: 2
  },
  atr: {
    period: 14
  }
};

// Fibonacci Levels
export const FIBONACCI_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

// Chart Colors
export const CHART_COLORS = {
  up: '#00ff88',
  down: '#ff4444',
  wick: '#718096',
  volume: {
    up: 'rgba(0, 255, 136, 0.3)',
    down: 'rgba(255, 68, 68, 0.3)'
  },
  support: '#00d4ff',
  resistance: '#ff6b6b',
  ema20: '#fbbf24',
  ema50: '#a855f7',
  ema200: '#3b82f6'
};

// Notification Sounds
export const NOTIFICATION_SOUNDS = {
  bullish: '/sounds/bullish-signal.mp3',
  bearish: '/sounds/bearish-signal.mp3',
  news: '/sounds/news-alert.mp3'
};

// Update Intervals (milliseconds)
export const UPDATE_INTERVALS = {
  price: 1000, // 1 second
  news: 300000, // 5 minutes
  analysis: 5000, // 5 seconds
};

// Local Storage Keys
export const STORAGE_KEYS = {
  watchlist: 'crypto_watchlist',
  notifications: 'notification_preferences',
  theme: 'theme_preference',
  signalHistory: 'signal_history'
};
