const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { BinanceService } = require('./binanceService.cjs');
const { RiskManager } = require('./riskManager.cjs');
const { TelegramBotService } = require('./telegramBot.cjs');

// Load env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });


const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize services
const binance = new BinanceService();
const riskManager = new RiskManager();
const telegramBot = new TelegramBotService();

// Setup Telegram bot commands if enabled
if (telegramBot.isEnabled()) {
    telegramBot.setupCommands(riskManager, binance);
    // Message is logged inside setupCommands based on enableCommands flag
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', testnet: binance.isTestnet() });
});

// Get account info
app.get('/api/account', async (req, res) => {
    try {
        const account = await binance.getAccountInfo();
        res.json(account);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get current positions
app.get('/api/positions', async (req, res) => {
    try {
        const positions = await binance.getOpenPositions();
        res.json(positions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Place a new order
app.post('/api/order', async (req, res) => {
    try {
        const { symbol, side, quantity, type = 'MARKET', price, stopLoss, takeProfit } = req.body;

        // Risk checks
        const riskCheck = await riskManager.checkOrderAllowed({
            symbol,
            side,
            quantity,
            currentPrice: price || (await binance.getCurrentPrice(symbol))
        });

        if (!riskCheck.allowed) {
            console.warn(`Order rejected by RiskManager: ${riskCheck.reason}`);
            return res.status(400).json({ error: riskCheck.reason });
        }

        console.log(`Executing ${side} order for ${symbol}...`);

        // Place main order
        const order = await binance.placeOrder({
            symbol,
            side,
            type,
            quantity: riskCheck.adjustedQuantity || quantity,
            price
        });

        console.log(`Main order placed successfully:`, order.orderId);

        // Place stop-loss if provided
        if (stopLoss && order.orderId) {
            await binance.placeStopLoss(symbol, side === 'BUY' ? 'SELL' : 'BUY', quantity, stopLoss);
        }

        // Place take-profit if provided
        if (takeProfit && order.orderId) {
            await binance.placeTakeProfit(symbol, side === 'BUY' ? 'SELL' : 'BUY', quantity, takeProfit);
        }

        // Track the trade
        const executedPrice = order.fills?.[0]?.price || price;
        const executedQuantity = riskCheck.adjustedQuantity || quantity;
        
        riskManager.recordTrade({
            symbol,
            side,
            quantity: executedQuantity,
            price: executedPrice,
            orderId: order.orderId
        });

        // Send Telegram notification
        if (telegramBot.isEnabled()) {
            telegramBot.sendTradeExecution(
                symbol,
                side,
                executedQuantity,
                executedPrice,
                order.orderId
            ).catch(err => console.error('Failed to send Telegram notification:', err));
        }

        res.json(order);
    } catch (error) {
        console.error('Order Execution Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Cancel all orders for a symbol
app.delete('/api/orders/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const result = await binance.cancelAllOrders(symbol);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Kill switch - cancel all orders and close positions
app.post('/api/kill-switch', async (req, res) => {
    try {
        const result = await binance.emergencyCloseAll();
        riskManager.activateKillSwitch();
        
        // Send Telegram notification
        if (telegramBot.isEnabled()) {
            telegramBot.sendKillSwitchAlert().catch(err => 
                console.error('Failed to send Telegram notification:', err)
            );
        }
        
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get risk status
app.get('/api/risk-status', (req, res) => {
    res.json(riskManager.getStatus());
});

// Reset daily limits
app.post('/api/risk-reset', (req, res) => {
    riskManager.resetDaily();
    res.json({ success: true });
});

// Get trade history
app.get('/api/trades', (req, res) => {
    res.json(riskManager.getTradeHistory());
});

// Send signal alert via Telegram
app.post('/api/telegram/signal', async (req, res) => {
    try {
        const { symbol, action, confidence, price, reason, tpSlData } = req.body;
        
        if (!symbol || !action) {
            return res.status(400).json({ error: 'Missing required fields: symbol, action' });
        }

        // Debug logging
        console.log('[Telegram Signal] Received:', { symbol, action, confidence, price, hasTpSlData: !!tpSlData });
        if (tpSlData) {
            console.log('[Telegram Signal] TP/SL Data:', tpSlData);
        }

        if (telegramBot.isEnabled()) {
            await telegramBot.sendSignal(symbol, action, confidence, price, reason, tpSlData);
            res.json({ success: true, message: 'Signal sent to Telegram' });
        } else {
            res.json({ success: false, message: 'Telegram bot not configured' });
        }
    } catch (error) {
        console.error('Failed to send signal alert:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get open trades - syncs tracked trades with actual Binance balances
app.get('/api/open-trades', async (req, res) => {
    try {
        // Get locally tracked trades
        const localTrades = riskManager.getOpenTrades();

        // Get actual positions from Binance (account balances)
        const positions = await binance.getOpenPositions();

        // Create a map of Binance balances by symbol (include all assets with balance > 0.001, exclude USDT/stablecoins)
        const excludedAssets = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP'];
        const balanceMap = new Map();
        positions.forEach(pos => {
            const asset = pos.asset;
            const total = parseFloat(pos.free) + parseFloat(pos.locked);
            if (total > 0.001 && !excludedAssets.includes(asset)) {
                balanceMap.set(`${asset}USDT`, total);
            }
        });

        // Sync local trades with actual balances
        const syncedTrades = localTrades.map(trade => {
            const actualBalance = balanceMap.get(trade.symbol);
            if (actualBalance !== undefined) {
                // Update quantity to match actual balance
                balanceMap.delete(trade.symbol); // Remove from map so we don't show it twice
                return {
                    ...trade,
                    quantity: actualBalance,
                    synced: true
                };
            }
            return trade;
        }).filter(trade => {
            // Keep synced trades (still on Binance) or local trades that still have balance
            if (trade.synced) return true;
            const actualBalance = balanceMap.get(trade.symbol);
            return actualBalance !== undefined && actualBalance > 0;
        });

        // Add any remaining balances that aren't being tracked
        const untrackedPositions = Array.from(balanceMap.entries()).map(([symbol, quantity]) => ({
            symbol,
            side: 'BUY',
            quantity,
            price: 0, // Unknown entry price
            orderId: `balance-${symbol.replace('USDT', '')}`,
            timestamp: Date.now(),
            isBalance: true
        }));

        res.json([...syncedTrades, ...untrackedPositions]);
    } catch (error) {
        console.error('Error fetching open trades:', error.message);
        // Fallback to just local trades if Binance API fails
        res.json(riskManager.getOpenTrades());
    }
});


app.listen(PORT, () => {
    console.log(`Trading server running on port ${PORT}`);
    console.log(`Mode: ${binance.isTestnet() ? 'TESTNET' : 'PRODUCTION'}`);
});
