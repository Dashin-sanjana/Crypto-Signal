/**
 * Trading API client for crypto_market_analyzer backend
 */
import TRADING_CONFIG from '../config/trading';

const API_BASE = `${TRADING_CONFIG.API_URL}/api`;

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(error.detail || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// ==================== Bot Control APIs ====================

export interface BotStatus {
  bot: {
    running: boolean;
    mode: 'dry_run' | 'live';
    trading_mode: 'swing' | 'scalp';
    started_at?: string;
    last_cycle?: string;
    cycle_count: number;
  };
  positions: Array<{
    symbol: string;
    side: 'LONG' | 'SHORT';
    entry_price: number;
    quantity: number;
    current_price: number;
    stop_loss: number;
    take_profit: number;
    pnl: number;
    pnl_percent: number;
    strategy?: string;
  }>;
  balance: number;
  daily_pnl: number;
  daily_trades: number;
}

export async function getBotStatus(): Promise<BotStatus> {
  return fetchApi<BotStatus>('/status');
}

export async function startBot(): Promise<{ status: string; started_at?: string }> {
  return fetchApi('/bot/start', { method: 'POST' });
}

export async function stopBot(): Promise<{ status: string }> {
  return fetchApi('/bot/stop', { method: 'POST' });
}

export async function triggerBotCycle(): Promise<{
  status: string;
  cycle_count?: number;
  last_cycle?: string;
  message?: string;
}> {
  return fetchApi('/bot/trigger', { method: 'POST' });
}

export async function activateKillSwitch(): Promise<{
  status: string;
  bot_stopped: boolean;
  positions_closed: number;
  details: Array<{ symbol: string; result: unknown }>;
}> {
  return fetchApi('/bot/kill', { method: 'POST' });
}

// ==================== Bot Configuration APIs ====================

export interface BotConfig {
  max_positions: number;
  daily_loss_limit_percent: number;
  per_trade_risk_percent: number;
  cycle_interval_minutes: number;
  trading_symbols: string[];
  trading_mode?: 'swing' | 'scalp';
}

export interface BotConfigResponse {
  config: BotConfig;
  mode: string;
  dry_run: boolean;
}

export async function getBotConfig(): Promise<BotConfigResponse> {
  return fetchApi<BotConfigResponse>('/bot/config');
}

export async function updateBotConfig(config: Partial<BotConfig> & { dry_run?: boolean }): Promise<{
  status: string;
  updated_fields: Record<string, unknown>;
  current_config: BotConfig;
}> {
  return fetchApi('/bot/config', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

// ==================== Position APIs ====================

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  quantity: number;
  current_price: number;
  stop_loss: number;
  take_profit: number;
  pnl: number;
  pnl_percent: number;
  strategy?: string;
}

export interface PositionsResponse {
  positions: Position[];
  count: number;
  total_exposure: number;
}

export async function getPositions(): Promise<PositionsResponse> {
  return fetchApi<PositionsResponse>('/positions');
}

export async function closePosition(symbol: string): Promise<{ status: string; pnl?: number }> {
  return fetchApi(`/positions/${symbol}/close`, { method: 'POST' });
}

export async function closeAllPositions(): Promise<{
  closed: Array<{ symbol: string; pnl: number }>;
  errors: Array<{ symbol: string; error: string }>;
  total_closed: number;
  total_errors: number;
}> {
  return fetchApi('/positions/close-all', { method: 'POST' });
}

// ==================== Trade Execution APIs ====================

export interface TradeRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  quantity?: number;
  quote_amount?: number; // USDT amount
  strategy?: string;
}

export interface TradeExecutionResult {
  success: boolean;
  message?: string;
  trade?: {
    symbol: string;
    side: string;
    quantity: number;
    entry_price: number;
    stop_loss: number;
    take_profit: number;
    order_id?: string;
  };
  error?: string;
}

export async function executeTrade(tradeRequest: TradeRequest): Promise<TradeExecutionResult> {
  return fetchApi<TradeExecutionResult>('/trades/execute', {
    method: 'POST',
    body: JSON.stringify(tradeRequest),
  });
}

// ==================== Trade History APIs ====================

export interface Trade {
  id: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  action: string;
  strategy?: string;
  quantity: number;
  entry_price: number;
  exit_price: number;
  pnl: number;
  pnl_percent: number;
  fees: number;
  timestamp: string;
}

export async function getTradeHistory(limit: number = 50, symbol?: string): Promise<{
  trades: Trade[];
  total_count: number;
}> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (symbol) params.set('symbol', symbol);
  return fetchApi(`/trades/history?${params}`);
}

// ==================== Market Regime APIs ====================

export interface RegimeInfo {
  regime: string;
  confidence: number;
  factors: Record<string, unknown>;
}

export async function getRegime(): Promise<RegimeInfo> {
  return fetchApi<RegimeInfo>('/regime');
}
