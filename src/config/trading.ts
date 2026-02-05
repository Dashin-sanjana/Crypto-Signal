/**
 * Trading bot configuration
 */

export const TRADING_CONFIG = {
  // Backend API URL (local backend)
  API_URL: import.meta.env.VITE_TRADING_API_URL || 'http://localhost:3001',
  
  // WebSocket URL (local backend)
  WS_URL: import.meta.env.VITE_TRADING_WS_URL || 'ws://localhost:3002',
  
  // Auto-trading settings
  AUTO_TRADING_ENABLED: import.meta.env.VITE_AUTO_TRADING_ENABLED === 'true' || false,
  AUTO_TRADING_MIN_STRENGTH: Number(import.meta.env.VITE_AUTO_TRADING_MIN_STRENGTH) || 6, // Lowered from 8 to allow 4 indicators (strength 7)
  
  // Risk management defaults
  DEFAULT_MAX_POSITIONS: 5,
  DEFAULT_DAILY_LOSS_LIMIT: 1.0, // 1%
  DEFAULT_PER_TRADE_RISK: 0.5, // 0.5%
  DEFAULT_CYCLE_INTERVAL: 15, // minutes
};

export default TRADING_CONFIG;
