const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { BinanceFuturesService } = require('./binanceFuturesService.cjs');
const { RiskManager } = require('./riskManager.cjs');
const { TelegramBotService } = require('./telegramBot.cjs');
const db = require('./db.cjs');

// Load env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let binance;
let riskManager;
let telegramBot;

async function start() {
    await db.init();
    const persistedSettings = db.getSettings();
    const riskOptions = {};
    if (persistedSettings.maxPositionSize != null) riskOptions.maxPositionSize = Number(persistedSettings.maxPositionSize);
    if (persistedSettings.dailyLossLimit != null) riskOptions.dailyLossLimit = Number(persistedSettings.dailyLossLimit);
    if (persistedSettings.maxOpenTrades != null) riskOptions.maxOpenTrades = Number(persistedSettings.maxOpenTrades);

    // Use USDT-M futures adapter (testnet or mainnet based on .env)
    binance = new BinanceFuturesService();
    riskManager = new RiskManager(riskOptions);
    telegramBot = new TelegramBotService();

    if (telegramBot.isEnabled()) {
        telegramBot.setupCommands(riskManager, binance);
    }

// Health check (includes DB readability)
app.get('/health', (req, res) => {
    let dbStatus = 'ok';
    try {
        db.getSettings();
    } catch (err) {
        dbStatus = 'error';
    }
    res.json({ status: 'ok', testnet: binance.isTestnet(), db: dbStatus });
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

// Get current positions (normalized futures positions)
app.get('/api/positions', async (req, res) => {
    try {
        const positions = await binance.getOpenPositions();
        res.json(positions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Place a new order
const ORDER_COOLDOWN_MS = 60000;

app.post('/api/order', async (req, res) => {
    try {
        const { symbol, side, quantity, type = 'MARKET', price, stopLoss, takeProfit, source } = req.body;

        if (db.hasOpenTradeInDb(symbol)) {
            return res.status(400).json({ error: `Already have open position in ${symbol} (from DB)` });
        }
        const lastOrder = db.getLastOrderAttemptInDb(symbol, ORDER_COOLDOWN_MS);
        if (lastOrder) {
            return res.status(400).json({ error: `Order cooldown for ${symbol}; try again after ${Math.ceil(ORDER_COOLDOWN_MS / 1000)}s` });
        }

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

        // Place main order (futures)
        const order = await binance.placeOrder({
            symbol,
            side, // BUY = open long, SELL = open short in one-way mode
            type,
            quantity: riskCheck.adjustedQuantity || quantity,
            price
        });

        console.log(`Main order placed successfully:`, order.orderId);
        binance.invalidateAccountCache();

        // Place stop-loss / take-profit if provided
        if (stopLoss && order.orderId) {
            await binance.placeStopLoss(symbol, side === 'BUY' ? 'SELL' : 'BUY', riskCheck.adjustedQuantity || quantity, stopLoss);
        }

        if (takeProfit && order.orderId) {
            await binance.placeTakeProfit(symbol, side === 'BUY' ? 'SELL' : 'BUY', riskCheck.adjustedQuantity || quantity, takeProfit);
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

        db.recordTradeInDb({
            symbol,
            side,
            quantity: executedQuantity,
            price: parseFloat(executedPrice) || 0,
            orderId: String(order.orderId),
            timestamp: Date.now(),
            source: source || 'single'
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

// Close a single futures position by symbol (e.g. BTCUSDT); updates DB so cooldown/open-trade checks stay correct
app.post('/api/close-position', async (req, res) => {
    try {
        const { symbol } = req.body;
        if (!symbol || typeof symbol !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid symbol' });
        }
        if (!symbol.endsWith('USDT')) {
            return res.status(400).json({ error: 'Symbol must be a USDT pair (e.g. BTCUSDT)' });
        }
        const positions = await binance.getOpenPositions();
        const position = positions.find((p) => p.symbol === symbol);
        if (!position) {
            return res.status(404).json({ error: `No open position for ${symbol}` });
        }

        // Close via reduce-only market order for the full size
        const closeSide = position.side === 'LONG' ? 'SELL' : 'BUY';

        await binance.cancelAllOrders(symbol).catch(() => {});
        const order = await binance.placeOrder({
            symbol,
            side: closeSide,
            type: 'MARKET',
            quantity: position.quantity,
            reduceOnly: true
        });

        const exitPrice = order.fills?.[0]?.price
            ? parseFloat(order.fills[0].price)
            : await binance.getCurrentPrice(symbol);
        riskManager.closeTrade(symbol, exitPrice);
        db.closeTradeInDb(symbol);
        binance.invalidateAccountCache();
        res.json(order);
    } catch (error) {
        console.error('Close position error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Kill switch - cancel all orders and close positions
app.post('/api/kill-switch', async (req, res) => {
    try {
        const result = await binance.emergencyCloseAll();
        binance.invalidateAccountCache();
        db.closeAllTradesInDb();
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

// Get persisted settings (from DB)
app.get('/api/settings', (req, res) => {
    res.json(db.getSettings());
});

// Update settings (persist to DB and update risk manager)
app.patch('/api/settings', (req, res) => {
    const { maxPositionSize, dailyLossLimit, maxOpenTrades } = req.body;
    const updates = {};
    if (maxPositionSize != null) {
        updates.maxPositionSize = Number(maxPositionSize);
        db.setSetting('maxPositionSize', updates.maxPositionSize);
    }
    if (dailyLossLimit != null) {
        updates.dailyLossLimit = Number(dailyLossLimit);
        db.setSetting('dailyLossLimit', updates.dailyLossLimit);
    }
    if (maxOpenTrades != null) {
        updates.maxOpenTrades = Math.max(0, Math.floor(Number(maxOpenTrades)));
        db.setSetting('maxOpenTrades', updates.maxOpenTrades);
    }
    if (Object.keys(updates).length) riskManager.updateSettings(updates);
    res.json(db.getSettings());
});

// Get trade history
app.get('/api/trades', (req, res) => {
    res.json(riskManager.getTradeHistory());
});

// Dedupe Telegram signals: same symbol+action within cooldown = skip send (limit: one signal per symbol+action per cooldown)
const TELEGRAM_SIGNAL_COOLDOWN_MS = parseInt(process.env.TELEGRAM_SIGNAL_COOLDOWN_MS || '', 10) || 5 * 60 * 1000; // default 5 min
const lastTelegramSignalByKey = new Map(); // key = `${symbol}:${action}`

// Send signal alert via Telegram
app.post('/api/telegram/signal', async (req, res) => {
    try {
        const { symbol, action, confidence, price, reason, tpSlData } = req.body;

        if (!symbol || !action) {
            return res.status(400).json({ error: 'Missing required fields: symbol, action' });
        }

        const dedupeKey = `${symbol}:${action}`;
        const now = Date.now();
        const last = lastTelegramSignalByKey.get(dedupeKey);
        if (last != null && (now - last) < TELEGRAM_SIGNAL_COOLDOWN_MS) {
            res.json({ success: true, message: 'Signal deduplicated (cooldown)' });
            return;
        }

        if (telegramBot.isEnabled()) {
            await telegramBot.sendSignal(symbol, action, confidence, price, reason, tpSlData);
            lastTelegramSignalByKey.set(dedupeKey, now);
            db.recordSignal(symbol, action, confidence || 0, price, true);
            res.json({ success: true, message: 'Signal sent to Telegram' });
        } else {
            res.json({ success: false, message: 'Telegram bot not configured' });
        }
    } catch (error) {
        console.error('Failed to send signal alert:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get open trades - syncs tracked trades with actual Binance futures positions; falls back to DB when Binance fails
app.get('/api/open-trades', async (req, res) => {
    try {
        const dbTrades = db.getOpenTradesFromDb();
        const memoryTrades = riskManager.getOpenTrades();
        const bySymbol = new Map();
        dbTrades.forEach(t => bySymbol.set(t.symbol, { ...t }));
        memoryTrades.forEach(t => bySymbol.set(t.symbol, { ...t }));
        const localTrades = Array.from(bySymbol.values());

        let positions;
        try {
            positions = await binance.getOpenPositions();
        } catch (binanceError) {
            console.warn('Binance getOpenPositions failed, returning DB/memory open trades:', binanceError.message);
            return res.json(localTrades);
        }

        // Map futures positions by symbol
        const positionMap = new Map();
        positions.forEach((pos) => {
            positionMap.set(pos.symbol, pos);
        });

        // Sync local trades with actual futures positions
        const syncedTrades = localTrades.map((trade) => {
            const pos = positionMap.get(trade.symbol);
            if (pos) {
                // Update quantity to match actual futures position size
                positionMap.delete(trade.symbol);
                return {
                    ...trade,
                    quantity: pos.quantity,
                    side: pos.side === 'LONG' ? 'BUY' : 'SELL',
                    synced: true
                };
            }
            return trade;
        }).filter((trade) => {
            // Keep synced trades (still on Binance) or local trades that we still track
            if (trade.synced) return true;
            const pos = positionMap.get(trade.symbol);
            return !!pos;
        });

        // Add any remaining positions that aren't being tracked locally
        const untrackedPositions = Array.from(positionMap.values()).map((pos) => ({
            symbol: pos.symbol,
            side: pos.side === 'LONG' ? 'BUY' : 'SELL',
            quantity: pos.quantity,
            price: pos.entryPrice,
            orderId: `position-${pos.symbol}`,
            timestamp: Date.now(),
            isPosition: true
        }));

        res.json([...syncedTrades, ...untrackedPositions]);
    } catch (error) {
        console.error('Error fetching open trades:', error.message);
        // Fallback to merged DB + memory so DB-backed trades are still included
        try {
            const dbTrades = db.getOpenTradesFromDb();
            const memoryTrades = riskManager.getOpenTrades();
            const bySymbol = new Map();
            dbTrades.forEach(t => bySymbol.set(t.symbol, { ...t }));
            memoryTrades.forEach(t => bySymbol.set(t.symbol, { ...t }));
            return res.json(Array.from(bySymbol.values()));
        } catch (fallbackErr) {
            res.json(riskManager.getOpenTrades());
        }
    }
});


    app.listen(PORT, () => {
        console.log(`Trading server running on port ${PORT}`);
        console.log(`Mode: ${binance.isTestnet() ? 'TESTNET' : 'PRODUCTION'}`);
    });

    function shutdown() {
        if (telegramBot) telegramBot.stopPolling();
    }
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

start().catch(err => {
    console.error('Server failed to start:', err);
    process.exit(1);
});
