/**
 * Trade Manager - Handles trade execution and risk management
 */
import { BinanceService } from './BinanceService';
import { PositionManager } from './PositionManager';

// Broadcast function will be injected
let broadcastToClients: ((message: any) => void) | null = null;

export const setBroadcastFunction = (fn: (message: any) => void) => {
  broadcastToClients = fn;
};

interface TradeRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  quantity?: number;
  quote_amount?: number;
  strategy?: string;
}

interface BotConfig {
  max_positions: number;
  daily_loss_limit_percent: number;
  per_trade_risk_percent: number;
  cycle_interval_minutes: number;
  trading_symbols: string[];
  trading_mode?: 'swing' | 'scalp';
}

export class TradeManager {
  private binanceService: BinanceService;
  private positionManager: PositionManager;
  private config: BotConfig;
  private dailyPnl: number = 0;
  private dailyResetDate: string = new Date().toISOString().split('T')[0];

  constructor(
    binanceService: BinanceService,
    positionManager: PositionManager
  ) {
    this.binanceService = binanceService;
    this.positionManager = positionManager;
    this.config = {
      max_positions: 5,
      daily_loss_limit_percent: 1.0,
      per_trade_risk_percent: 0.5,
      cycle_interval_minutes: 15,
      trading_symbols: [],
      trading_mode: 'swing',
    };
  }

  /**
   * Execute a trade from a signal
   */
  async executeTrade(tradeRequest: TradeRequest): Promise<{
    success: boolean;
    message?: string;
    trade?: any;
    error?: string;
  }> {
    try {
      // Check if position already exists
      if (this.positionManager.hasPosition(tradeRequest.symbol)) {
        return {
          success: false,
          error: `Position already exists for ${tradeRequest.symbol}`,
        };
      }

      // Check max positions limit
      const currentPositions = this.positionManager.getPositions();
      if (currentPositions.length >= this.config.max_positions) {
        return {
          success: false,
          error: `Max positions limit reached (${this.config.max_positions})`,
        };
      }

      // Check daily loss limit
      this.checkDailyReset();
      const balance = await this.binanceService.getAccountBalance();
      if (this.isDailyLossLimitHit(balance)) {
        return {
          success: false,
          error: 'Daily loss limit reached',
        };
      }

      // Get current price
      let entryPrice = tradeRequest.entry_price;
      try {
        const currentPrice = await this.binanceService.getCurrentPrice(
          tradeRequest.symbol
        );
        entryPrice = currentPrice; // Use current market price
      } catch (error) {
        console.warn(`Could not fetch current price, using entry_price`);
      }

      // Calculate quantity
      let quantity = tradeRequest.quantity;
      if (!quantity) {
        if (tradeRequest.quote_amount) {
          quantity = tradeRequest.quote_amount / entryPrice;
        } else {
          // Risk-based sizing
          const riskAmount =
            balance * (this.config.per_trade_risk_percent / 100);
          const riskPerShare = Math.abs(entryPrice - tradeRequest.stop_loss);
          if (riskPerShare > 0) {
            quantity = riskAmount / riskPerShare;
          } else {
            quantity = (balance * 0.1) / entryPrice; // Fallback: 10% of balance
          }
        }
      }

      // Place market order
      const orderResult = await this.binanceService.placeMarketOrder(
        tradeRequest.symbol,
        tradeRequest.side,
        quantity
      );

      if (orderResult.error) {
        return {
          success: false,
          error: orderResult.error,
        };
      }

      // Add position
      const position = {
        symbol: tradeRequest.symbol,
        side: tradeRequest.side === 'BUY' ? 'LONG' : 'SHORT',
        entry_price: entryPrice,
        quantity,
        current_price: entryPrice,
        stop_loss: tradeRequest.stop_loss,
        take_profit: tradeRequest.take_profit,
        pnl: 0,
        pnl_percent: 0,
        strategy: tradeRequest.strategy || 'signal_based',
      };

      this.positionManager.addPosition(position);

      // Broadcast trade execution
      if (broadcastToClients) {
        broadcastToClients({
          type: 'trade_executed',
          symbol: tradeRequest.symbol,
          side: tradeRequest.side,
          entry_price: entryPrice,
          quantity,
          stop_loss: tradeRequest.stop_loss,
          take_profit: tradeRequest.take_profit,
          strategy: tradeRequest.strategy || 'signal_based',
          timestamp: new Date().toISOString(),
        });
      }

      return {
        success: true,
        message: `Trade executed: ${tradeRequest.symbol} ${tradeRequest.side}`,
        trade: {
          symbol: tradeRequest.symbol,
          side: tradeRequest.side,
          quantity,
          entry_price: entryPrice,
          stop_loss: tradeRequest.stop_loss,
          take_profit: tradeRequest.take_profit,
          order_id: orderResult.orderId,
        },
      };
    } catch (error: any) {
      console.error('Error executing trade:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Get bot configuration
   */
  getConfig(): BotConfig {
    return { ...this.config };
  }

  /**
   * Update bot configuration
   */
  updateConfig(updates: Partial<BotConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get daily P&L
   */
  getDailyPnl(): number {
    this.checkDailyReset();
    return this.dailyPnl;
  }

  /**
   * Record trade P&L
   */
  recordTradePnl(pnl: number): void {
    this.dailyPnl += pnl;
  }

  /**
   * Check if daily loss limit is hit
   */
  private isDailyLossLimitHit(balance: number): boolean {
    if (balance <= 0) return false;
    const lossPercent = Math.abs(Math.min(this.dailyPnl, 0)) / balance * 100;
    return lossPercent >= this.config.daily_loss_limit_percent;
  }

  /**
   * Check and reset daily P&L if needed
   */
  private checkDailyReset(): void {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.dailyResetDate) {
      this.dailyPnl = 0;
      this.dailyResetDate = today;
    }
  }
}
