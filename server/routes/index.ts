/**
 * API Routes
 */
import { Router } from 'express';
import { TradeManager } from '../services/TradeManager';
import { PositionManager } from '../services/PositionManager';
import { BinanceService } from '../services/BinanceService';

export const routes = (
  tradeManager: TradeManager,
  positionManager: PositionManager,
  binanceService: BinanceService
) => {
  const router = Router();

  // ==================== Status ====================
  router.get('/status', async (req, res) => {
    try {
      const positions = positionManager.getPositions();
      const balance = await binanceService.getAccountBalance();
      const dailyPnl = tradeManager.getDailyPnl();

      res.json({
        bot: {
          running: true, // Always running in this lightweight version
          mode: process.env.BINANCE_DRY_RUN === 'true' ? 'dry_run' : 'live',
          trading_mode: 'swing',
          cycle_count: 0,
        },
        positions: positions.map((p) => ({
          symbol: p.symbol,
          side: p.side,
          entry_price: p.entry_price,
          quantity: p.quantity,
          current_price: p.current_price,
          stop_loss: p.stop_loss,
          take_profit: p.take_profit,
          pnl: p.pnl,
          pnl_percent: p.pnl_percent,
          strategy: p.strategy,
        })),
        balance,
        daily_pnl: dailyPnl,
        daily_trades: 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Bot Control ====================
  router.post('/bot/start', (req, res) => {
    res.json({ status: 'started', started_at: new Date().toISOString() });
  });

  router.post('/bot/stop', (req, res) => {
    res.json({ status: 'stopped' });
  });

  router.post('/bot/trigger', (req, res) => {
    res.json({
      status: 'completed',
      cycle_count: 0,
      last_cycle: new Date().toISOString(),
    });
  });

  router.post('/bot/kill', async (req, res) => {
    try {
      const closed = await positionManager.closeAllPositions();
      res.json({
        status: 'killed',
        bot_stopped: true,
        positions_closed: closed.length,
        details: closed.map((c) => ({ symbol: c.symbol, result: c })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/bot/config', (req, res) => {
    const config = tradeManager.getConfig();
    res.json({
      config,
      mode: process.env.BINANCE_DRY_RUN === 'true' ? 'dry_run' : 'live',
      dry_run: process.env.BINANCE_DRY_RUN === 'true',
    });
  });

  router.post('/bot/config', (req, res) => {
    try {
      tradeManager.updateConfig(req.body);
      const config = tradeManager.getConfig();
      res.json({
        status: 'updated',
        updated_fields: req.body,
        current_config: config,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Positions ====================
  router.get('/positions', (req, res) => {
    try {
      const positions = positionManager.getPositions();
      const totalExposure = positions.reduce(
        (sum, p) => sum + p.entry_price * p.quantity,
        0
      );

      res.json({
        positions: positions.map((p) => ({
          symbol: p.symbol,
          side: p.side,
          entry_price: p.entry_price,
          quantity: p.quantity,
          current_price: p.current_price,
          stop_loss: p.stop_loss,
          take_profit: p.take_profit,
          pnl: p.pnl,
          pnl_percent: p.pnl_percent,
          strategy: p.strategy,
        })),
        count: positions.length,
        total_exposure: totalExposure,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/positions/:symbol/close', async (req, res) => {
    try {
      const { symbol } = req.params;
      
      // Check if position exists first
      const existingPosition = positionManager.getPosition(symbol);
      if (!existingPosition) {
        return res.status(404).json({ 
          error: 'Position not found',
          symbol 
        });
      }

      // Close position
      const position = await positionManager.closePosition(symbol, 'manual');
      
      if (position) {
        // Record P&L in trade manager
        tradeManager.recordTradePnl(position.pnl);
        
        res.json({ 
          status: 'closed', 
          symbol,
          pnl: position.pnl,
          pnl_percent: position.pnl_percent,
          exit_price: position.current_price,
          reason: 'manual'
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to close position',
          symbol 
        });
      }
    } catch (error: any) {
      console.error(`Error in close position endpoint:`, error);
      res.status(500).json({ 
        error: error.message || 'Failed to close position',
        symbol: req.params.symbol
      });
    }
  });

  router.post('/positions/close-all', async (req, res) => {
    try {
      const results = await positionManager.closeAllPositions();
      
      // Record P&L for successfully closed positions
      const successful = results.filter(r => !r.error);
      successful.forEach((r) => {
        tradeManager.recordTradePnl(r.pnl);
      });

      const errors = results.filter(r => r.error);
      
      res.json({
        closed: successful.map((c) => ({ 
          symbol: c.symbol, 
          pnl: c.pnl 
        })),
        errors: errors.map((e) => ({
          symbol: e.symbol,
          error: e.error || 'Unknown error'
        })),
        total_closed: successful.length,
        total_errors: errors.length,
        total_attempted: results.length,
      });
    } catch (error: any) {
      console.error(`Error in close-all positions endpoint:`, error);
      res.status(500).json({ 
        error: error.message || 'Failed to close all positions'
      });
    }
  });

  // ==================== Trade Execution ====================
  router.post('/trades/execute', async (req, res) => {
    try {
      const result = await tradeManager.executeTrade(req.body);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Trade History ====================
  router.get('/trades/history', (req, res) => {
    // Simple in-memory history (can be enhanced with database)
    res.json({
      trades: [],
      total_count: 0,
    });
  });

  // ==================== Market Regime ====================
  router.get('/regime', (req, res) => {
    res.json({
      regime: 'neutral',
      confidence: 0.5,
      factors: {},
    });
  });

  return router;
};
