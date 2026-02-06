const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { BinanceService } = require('./binanceService.cjs');
const { RiskManager } = require('./riskManager.cjs');

// Load env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });


const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize services
const binance = new BinanceService();
const riskManager = new RiskManager();

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
            return res.status(400).json({ error: riskCheck.reason });
        }

        // Place main order
        const order = await binance.placeOrder({
            symbol,
            side,
            type,
            quantity: riskCheck.adjustedQuantity || quantity,
            price
        });

        // Place stop-loss if provided
        if (stopLoss && order.orderId) {
            await binance.placeStopLoss(symbol, side === 'BUY' ? 'SELL' : 'BUY', quantity, stopLoss);
        }

        // Place take-profit if provided
        if (takeProfit && order.orderId) {
            await binance.placeTakeProfit(symbol, side === 'BUY' ? 'SELL' : 'BUY', quantity, takeProfit);
        }

        // Track the trade
        riskManager.recordTrade({
            symbol,
            side,
            quantity: riskCheck.adjustedQuantity || quantity,
            price: order.fills?.[0]?.price || price,
            orderId: order.orderId
        });

        res.json(order);
    } catch (error) {
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

// Get open trades - syncs tracked trades with actual Binance balances
app.get('/api/open-trades', async (req, res) => {
    try {
        // Get locally tracked trades
        const localTrades = riskManager.getOpenTrades();

        // Get actual positions from Binance (account balances)
        const positions = await binance.getOpenPositions();

        // List of major crypto assets we care about
        const majorAssets = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'LINK', 'AVAX', 'MATIC', 'LTC', 'TRX', 'SHIB', 'APT', 'SUI', 'OP', 'ARB', 'INJ', 'FIL', 'ATOM', 'UNI', 'NEAR', 'PEPE', 'WIF'];

        // Create a map of Binance balances by symbol
        const balanceMap = new Map();
        positions.forEach(pos => {
            const asset = pos.asset;
            const total = parseFloat(pos.free) + parseFloat(pos.locked);
            if (total > 0.001 && majorAssets.includes(asset)) {
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
            // Remove trades where balance is now 0 (position was closed on Binance)
            const actualBalance = balanceMap.get(trade.symbol);
            return actualBalance === undefined || actualBalance > 0 || trade.synced;
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
