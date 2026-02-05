/**
 * Trading Context - Manages bot state, positions, and trade execution
 */
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as tradingApi from '../api/tradingApi';
import { useTradingWebSocket, WebSocketMessage } from '../hooks/useTradingWebSocket';
import TRADING_CONFIG from '../config/trading';
import { storage } from '../utils/helpers';
import { notificationManager } from '../utils/notificationManager';
import { toastSuccess, toastError, toastInfo, toastWarning } from '../utils/toastHelper';
import type { Signal } from './SignalContext';

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

interface TradingContextType {
  // Bot state
  botRunning: boolean;
  botMode: 'dry_run' | 'live';
  tradingMode: 'swing' | 'scalp';
  botConfig: tradingApi.BotConfig | null;
  balance: number;
  dailyPnl: number;
  totalProfit: number; // Total realized + unrealized profit
  realizedProfit: number; // Profit from closed positions
  unrealizedProfit: number; // Profit from open positions
  
  // Positions
  positions: Position[];
  positionsCount: number;
  
  // Auto-trading settings
  autoTradingEnabled: boolean;
  autoTradingMinStrength: number;
  setAutoTradingEnabled: (enabled: boolean) => void;
  setAutoTradingMinStrength: (strength: number) => void;
  
  // Actions
  startBot: () => Promise<void>;
  stopBot: () => Promise<void>;
  updateBotConfig: (config: Partial<tradingApi.BotConfig> & { dry_run?: boolean }) => Promise<void>;
  triggerBotCycle: () => Promise<void>;
  activateKillSwitch: () => Promise<void>;
  
  // Trade execution
  executeTrade: (signal: Signal) => Promise<boolean>;
  
  // Position management
  closePosition: (symbol: string) => Promise<void>;
  closeAllPositions: () => Promise<void>;
  
  // WebSocket
  isConnected: boolean;
  
  // Loading states
  isLoading: boolean;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export const useTradingContext = () => {
  const context = useContext(TradingContext);
  if (!context) {
    throw new Error('useTradingContext must be used within TradingProvider');
  }
  return context;
};

interface TradingProviderProps {
  children: ReactNode;
}

export const TradingProvider: React.FC<TradingProviderProps> = ({ children }) => {
  // Bot state
  const [botRunning, setBotRunning] = useState(false);
  const [botMode, setBotMode] = useState<'dry_run' | 'live'>('dry_run');
  const [tradingMode, setTradingMode] = useState<'swing' | 'scalp'>('swing');
  const [botConfig, setBotConfig] = useState<tradingApi.BotConfig | null>(null);
  const [balance, setBalance] = useState(0);
  const [dailyPnl, setDailyPnl] = useState(0);
  const [realizedProfit, setRealizedProfit] = useState(0); // From closed positions
  
  // Positions
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsCount, setPositionsCount] = useState(0);
  
  // Calculate unrealized profit from open positions
  const unrealizedProfit = positions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
  
  // Total profit = realized + unrealized
  const totalProfit = realizedProfit + unrealizedProfit;
  
  // Auto-trading settings (from localStorage)
  const [autoTradingEnabled, setAutoTradingEnabled] = useState(() => {
    return storage.get<boolean>('auto_trading_enabled', TRADING_CONFIG.AUTO_TRADING_ENABLED) ?? false;
  });
  const [autoTradingMinStrength, setAutoTradingMinStrength] = useState(() => {
    return storage.get<number>('auto_trading_min_strength', TRADING_CONFIG.AUTO_TRADING_MIN_STRENGTH) ?? 6;
  });
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // WebSocket connection
  const { isConnected, lastMessage } = useTradingWebSocket({
    onMessage: (message: WebSocketMessage) => {
      handleWebSocketMessage(message);
    },
    onConnect: () => {
      console.log('Trading WebSocket connected');
    },
    onDisconnect: () => {
      console.log('Trading WebSocket disconnected');
    },
  });

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'initial_state':
        setBotRunning(message.bot_running || false);
        setBotMode(message.mode || 'dry_run');
        setPositions(message.positions || []);
        setPositionsCount(message.positions_count || 0);
        setBalance(message.balance || 0);
        setDailyPnl(message.daily_pnl || 0);
        break;
        
      case 'bot_status':
        setBotRunning(message.status === 'started');
        break;
        
      case 'positions_update':
        setPositions(message.positions || []);
        setPositionsCount(message.positions_count || 0);
        setBalance(message.balance || 0);
        setDailyPnl(message.daily_pnl || 0);
        break;
        
      case 'trade_executed':
        // Only show toast if notification enabled and not throttled
        const tradeKey = `trade_${message.symbol}_ws`;
        toastSuccess(
          `Trade executed: ${message.symbol} ${message.side} @ $${message.entry_price?.toFixed(2)}`,
          tradeKey,
          { isManual: false, isImportant: false }
        );
        // Refresh positions
        loadPositions();
        break;
        
      case 'position_closed':
        // Track realized profit
        const closedPnl = message.pnl || 0;
        setRealizedProfit(prev => prev + closedPnl);
        
        // Only show toast if significant P&L or notification enabled
        const positionKey = `position_${message.symbol}_closed_ws`;
        const pnlFormatted = closedPnl >= 0 
          ? `+$${Math.abs(closedPnl).toFixed(2)}` 
          : `-$${Math.abs(closedPnl).toFixed(2)}`;
        const pnlPercent = message.pnl_percent?.toFixed(2) || '0.00';
        toastInfo(
          `Position closed: ${message.symbol} - P&L: ${pnlFormatted} (${pnlPercent}%)`,
          positionKey,
          { pnl: closedPnl }
        );
        // Refresh positions
        loadPositions();
        break;
        
      default:
        // Handle other message types if needed
        break;
    }
  }, []);

  // Load bot status
  const loadBotStatus = useCallback(async () => {
    try {
      const status = await tradingApi.getBotStatus();
      setBotRunning(status.bot.running);
      setBotMode(status.bot.mode);
      setTradingMode(status.bot.trading_mode);
      setPositions(status.positions || []);
      setPositionsCount(status.positions.length);
      setBalance(status.balance);
      setDailyPnl(status.daily_pnl);
    } catch (error) {
      console.error('Error loading bot status:', error);
    }
  }, []);

  // Load bot config
  const loadBotConfig = useCallback(async () => {
    try {
      const configData = await tradingApi.getBotConfig();
      setBotConfig(configData.config);
      setBotMode(configData.dry_run ? 'dry_run' : 'live');
      setTradingMode(configData.config.trading_mode || 'swing');
    } catch (error) {
      console.error('Error loading bot config:', error);
    }
  }, []);

  // Load positions
  const loadPositions = useCallback(async () => {
    try {
      const response = await tradingApi.getPositions();
      setPositions(response.positions);
      setPositionsCount(response.count);
    } catch (error) {
      console.error('Error loading positions:', error);
    }
  }, []);

  // Start bot
  const startBot = useCallback(async () => {
    try {
      setIsLoading(true);
      await tradingApi.startBot();
      setBotRunning(true);
      toastSuccess('Bot started', 'bot_started');
      await loadBotStatus();
    } catch (error: any) {
      toastError(`Failed to start bot: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadBotStatus]);

  // Stop bot
  const stopBot = useCallback(async () => {
    try {
      setIsLoading(true);
      await tradingApi.stopBot();
      setBotRunning(false);
      toastSuccess('Bot stopped', 'bot_stopped');
      await loadBotStatus();
    } catch (error: any) {
      toastError(`Failed to stop bot: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadBotStatus]);

  // Update bot config
  const updateBotConfig = useCallback(async (config: Partial<tradingApi.BotConfig> & { dry_run?: boolean }) => {
    try {
      setIsLoading(true);
      const result = await tradingApi.updateBotConfig(config);
      setBotConfig(result.current_config);
      if (config.dry_run !== undefined) {
        setBotMode(config.dry_run ? 'dry_run' : 'live');
      }
      toastSuccess('Bot configuration updated', 'bot_config_updated');
      await loadBotConfig();
    } catch (error: any) {
      toastError(`Failed to update config: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadBotConfig]);

  // Trigger bot cycle
  const triggerBotCycle = useCallback(async () => {
    try {
      setIsLoading(true);
      await tradingApi.triggerBotCycle();
      toastSuccess('Bot cycle triggered', 'bot_cycle');
    } catch (error: any) {
      toastError(`Failed to trigger cycle: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Activate kill switch
  const activateKillSwitch = useCallback(async () => {
    if (!window.confirm('This will stop the bot and close ALL positions immediately. Are you sure?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const result = await tradingApi.activateKillSwitch();
      setBotRunning(false);
      setPositions([]);
      setPositionsCount(0);
      toastWarning(`Kill switch activated. Closed ${result.positions_closed} positions.`);
      await loadBotStatus();
    } catch (error: any) {
      toastError(`Failed to activate kill switch: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadBotStatus]);

  // Execute trade from signal
  const executeTrade = useCallback(async (signal: Signal): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const tradeRequest: tradingApi.TradeRequest = {
        symbol: signal.symbol,
        side: signal.type === 'LONG' ? 'BUY' : 'SELL',
        entry_price: signal.entry,
        stop_loss: signal.stopLoss,
        take_profit: signal.takeProfit,
        strategy: 'signal_based',
      };

      const result = await tradingApi.executeTrade(tradeRequest);
      
      if (result.success) {
        // Use notification manager to throttle
        const tradeKey = `trade_${signal.symbol}_auto`;
        toastSuccess(
          `Trade executed: ${signal.symbol} ${signal.type} @ $${signal.entry.toFixed(2)}`,
          tradeKey,
          { isManual: false, isImportant: false }
        );
        await loadPositions();
        return true;
      } else {
        // Always show errors
        toastError(`Trade failed: ${result.message || result.error || 'Unknown error'}`);
        return false;
      }
    } catch (error: any) {
      toastError(`Failed to execute trade: ${error.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadPositions]);

  // Close position
  const closePosition = useCallback(async (symbol: string) => {
    try {
      setIsLoading(true);
      const result = await tradingApi.closePosition(symbol);
      
      // Track realized profit
      if (result.pnl !== undefined) {
        setRealizedProfit(prev => prev + result.pnl);
        
        // Only show notification if significant or enabled
        const positionKey = `position_${symbol}_closed_manual`;
        const pnlFormatted = result.pnl >= 0 
          ? `+$${Math.abs(result.pnl).toFixed(2)}` 
          : `-$${Math.abs(result.pnl).toFixed(2)}`;
        toastSuccess(
          `Position closed: ${symbol} - P&L: ${pnlFormatted}`,
          positionKey,
          { pnl: result.pnl }
        );
      }
      
      await loadPositions();
    } catch (error: any) {
      toastError(`Failed to close position: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadPositions]);

  // Close all positions
  const closeAllPositions = useCallback(async () => {
    if (!window.confirm('Close all positions?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const result = await tradingApi.closeAllPositions();
      toastInfo(`Closed ${result.total_closed} positions`, 'close_all_positions');
      await loadPositions();
    } catch (error: any) {
      toastError(`Failed to close positions: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadPositions]);

  // Save auto-trading settings to localStorage
  useEffect(() => {
    storage.set('auto_trading_enabled', autoTradingEnabled);
  }, [autoTradingEnabled]);

  useEffect(() => {
    storage.set('auto_trading_min_strength', autoTradingMinStrength);
  }, [autoTradingMinStrength]);

  // Load initial data
  useEffect(() => {
    loadBotStatus();
    loadBotConfig();
    loadPositions();
    
    // Refresh periodically
    const interval = setInterval(() => {
      loadBotStatus();
      loadPositions();
    }, 10000); // Every 10 seconds
    
    return () => clearInterval(interval);
  }, [loadBotStatus, loadBotConfig, loadPositions]);

  const value: TradingContextType = {
    botRunning,
    botMode,
    tradingMode,
    botConfig,
    balance,
    dailyPnl,
    totalProfit,
    realizedProfit,
    unrealizedProfit,
    positions,
    positionsCount,
    autoTradingEnabled,
    autoTradingMinStrength,
    setAutoTradingEnabled,
    setAutoTradingMinStrength,
    startBot,
    stopBot,
    updateBotConfig,
    triggerBotCycle,
    activateKillSwitch,
    executeTrade,
    closePosition,
    closeAllPositions,
    isConnected,
    isLoading,
  };

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  );
};
