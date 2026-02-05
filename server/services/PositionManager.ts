/**
 * Position Manager - Tracks open positions and monitors SL/TP
 */
import { BinanceService } from './BinanceService';

// Broadcast function will be injected
let broadcastToClients: ((message: any) => void) | null = null;

export const setBroadcastFunction = (fn: (message: any) => void) => {
  broadcastToClients = fn;
};

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
  opened_at: string;
}

export class PositionManager {
  private positions: Map<string, Position> = new Map();
  private binanceService: BinanceService;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  constructor(binanceService: BinanceService) {
    this.binanceService = binanceService;
  }

  /**
   * Add a new position
   */
  addPosition(position: Omit<Position, 'opened_at'>): void {
    const fullPosition: Position = {
      ...position,
      opened_at: new Date().toISOString(),
    };
    this.positions.set(position.symbol, fullPosition);
    console.log(`Position opened: ${position.symbol} ${position.side} @ ${position.entry_price}`);
  }

  /**
   * Remove a position
   */
  removePosition(symbol: string): Position | null {
    const position = this.positions.get(symbol);
    if (position) {
      this.positions.delete(symbol);
      console.log(`Position closed: ${symbol}`);
      return position;
    }
    return null;
  }

  /**
   * Get position by symbol
   */
  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  /**
   * Get all positions
   */
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Check if position exists
   */
  hasPosition(symbol: string): boolean {
    return this.positions.has(symbol);
  }

  /**
   * Update position's current price and P&L
   */
  async updatePositionPrice(symbol: string): Promise<void> {
    const position = this.positions.get(symbol);
    if (!position) {
      // Position might have been closed, skip
      return;
    }

    try {
      const currentPrice = await this.binanceService.getCurrentPrice(symbol);
      
      // Double-check position still exists (might have been closed during price fetch)
      const currentPosition = this.positions.get(symbol);
      if (!currentPosition) {
        return; // Position was closed, skip update
      }

      const pnl = this.calculatePnL(currentPosition, currentPrice);
      const pnlPercent = this.calculatePnLPercent(currentPosition, currentPrice);

      currentPosition.current_price = currentPrice;
      currentPosition.pnl = pnl;
      currentPosition.pnl_percent = pnlPercent;

      // Check stop loss (with small buffer to avoid false triggers)
      const slBuffer = 0.001; // 0.1% buffer
      if (currentPosition.side === 'LONG' && currentPrice <= (currentPosition.stop_loss * (1 + slBuffer))) {
        console.log(`Stop loss triggered for ${symbol} LONG: ${currentPrice} <= ${currentPosition.stop_loss}`);
        await this.closePosition(symbol, 'stop_loss');
        return;
      }
      if (currentPosition.side === 'SHORT' && currentPrice >= (currentPosition.stop_loss * (1 - slBuffer))) {
        console.log(`Stop loss triggered for ${symbol} SHORT: ${currentPrice} >= ${currentPosition.stop_loss}`);
        await this.closePosition(symbol, 'stop_loss');
        return;
      }

      // Check take profit (with small buffer)
      if (currentPosition.side === 'LONG' && currentPrice >= (currentPosition.take_profit * (1 - slBuffer))) {
        console.log(`Take profit triggered for ${symbol} LONG: ${currentPrice} >= ${currentPosition.take_profit}`);
        await this.closePosition(symbol, 'take_profit');
        return;
      }
      if (currentPosition.side === 'SHORT' && currentPrice <= (currentPosition.take_profit * (1 + slBuffer))) {
        console.log(`Take profit triggered for ${symbol} SHORT: ${currentPrice} <= ${currentPosition.take_profit}`);
        await this.closePosition(symbol, 'take_profit');
        return;
      }
    } catch (error: any) {
      console.error(`Error updating price for ${symbol}:`, error.message || error);
      // Don't throw - continue monitoring other positions
    }
  }

  /**
   * Calculate P&L
   */
  private calculatePnL(position: Position, currentPrice: number): number {
    if (position.side === 'LONG') {
      return (currentPrice - position.entry_price) * position.quantity;
    } else {
      return (position.entry_price - currentPrice) * position.quantity;
    }
  }

  /**
   * Calculate P&L percentage
   */
  private calculatePnLPercent(position: Position, currentPrice: number): number {
    if (position.side === 'LONG') {
      return ((currentPrice - position.entry_price) / position.entry_price) * 100;
    } else {
      return ((position.entry_price - currentPrice) / position.entry_price) * 100;
    }
  }

  /**
   * Close a position
   */
  async closePosition(symbol: string, reason: string = 'manual'): Promise<Position | null> {
    const position = this.positions.get(symbol);
    if (!position) {
      console.warn(`Position not found for ${symbol}`);
      return null;
    }

    try {
      // CRITICAL: Update price and P&L before closing to get accurate final P&L
      await this.updatePositionPrice(symbol);
      
      // Get updated position after price update
      const updatedPosition = this.positions.get(symbol);
      if (!updatedPosition) {
        console.warn(`Position ${symbol} was removed during price update`);
        return null;
      }

      // Execute market order to close
      const side = updatedPosition.side === 'LONG' ? 'SELL' : 'BUY';
      const orderResult = await this.binanceService.placeMarketOrder(
        symbol, 
        side, 
        updatedPosition.quantity
      );

      // Check if order was successful
      if (orderResult.error && !orderResult.dryRun) {
        throw new Error(`Failed to execute close order: ${orderResult.error}`);
      }

      // Get exit price (use order fill price if available, otherwise current price)
      let exitPrice = updatedPosition.current_price;
      
      if (orderResult.fills && orderResult.fills.length > 0) {
        // Use weighted average fill price if multiple fills
        const totalQty = orderResult.fills.reduce((sum: number, fill: any) => 
          sum + parseFloat(fill.qty || '0'), 0
        );
        const weightedPrice = orderResult.fills.reduce((sum: number, fill: any) => 
          sum + (parseFloat(fill.price || '0') * parseFloat(fill.qty || '0')), 0
        ) / totalQty;
        
        if (!isNaN(weightedPrice) && weightedPrice > 0) {
          exitPrice = weightedPrice;
        } else if (orderResult.fills[0]?.price) {
          exitPrice = parseFloat(orderResult.fills[0].price);
        }
      } else if (orderResult.price) {
        exitPrice = parseFloat(orderResult.price);
      }
      
      // Fallback: if exit price is invalid, use current price
      if (!exitPrice || exitPrice <= 0) {
        console.warn(`Invalid exit price for ${symbol}, using current price: ${updatedPosition.current_price}`);
        exitPrice = updatedPosition.current_price;
      }

      // Calculate final P&L with exit price
      const finalPnL = this.calculatePnL(updatedPosition, exitPrice);
      const finalPnLPercent = this.calculatePnLPercent(updatedPosition, exitPrice);

      // Create closed position object with final P&L
      const closedPosition: Position = {
        ...updatedPosition,
        current_price: exitPrice,
        pnl: finalPnL,
        pnl_percent: finalPnLPercent,
      };

      // Remove position from map
      this.removePosition(symbol);
      
      console.log(`Position closed: ${symbol} ${updatedPosition.side} - P&L: $${finalPnL.toFixed(2)} (${finalPnLPercent.toFixed(2)}%) - Reason: ${reason}`);
      
      // Broadcast position closed event
      if (broadcastToClients) {
        broadcastToClients({
          type: 'position_closed',
          symbol,
          reason,
          pnl: finalPnL,
          pnl_percent: finalPnLPercent,
          exit_price: exitPrice,
          timestamp: new Date().toISOString(),
        });
      }

      return closedPosition;
    } catch (error: any) {
      console.error(`Error closing position ${symbol}:`, error);
      // Don't remove position if close failed
      throw new Error(`Failed to close position ${symbol}: ${error.message || error}`);
    }
  }

  /**
   * Close all positions
   */
  async closeAllPositions(): Promise<Array<{ symbol: string; pnl: number; error?: string }>> {
    const results: Array<{ symbol: string; pnl: number; error?: string }> = [];
    const symbols = Array.from(this.positions.keys());

    if (symbols.length === 0) {
      console.log('No positions to close');
      return results;
    }

    console.log(`Closing ${symbols.length} position(s)...`);

    for (const symbol of symbols) {
      try {
        const position = await this.closePosition(symbol, 'close_all');
        if (position) {
          results.push({ symbol, pnl: position.pnl });
        } else {
          results.push({ symbol, pnl: 0, error: 'Position not found' });
        }
      } catch (error: any) {
        console.error(`Error closing ${symbol}:`, error);
        results.push({ 
          symbol, 
          pnl: 0, 
          error: error.message || 'Unknown error' 
        });
      }
    }

    const successCount = results.filter(r => !r.error).length;
    console.log(`Closed ${successCount}/${symbols.length} positions successfully`);
    
    return results;
  }

  /**
   * Start monitoring positions for SL/TP
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      const symbols = Array.from(this.positions.keys());
      for (const symbol of symbols) {
        await this.updatePositionPrice(symbol);
      }
    }, 1000); // Check every second

    console.log('Position monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('Position monitoring stopped');
  }
}
