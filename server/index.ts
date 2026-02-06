import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { BinanceService } from './binanceService.js';
import { RiskManager } from './riskManager.js';

dotenv.config({ path: '../.env' });

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
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get current positions
app.get('/api/positions', async (req, res) => {
    try {
        const positions = await binance.getOpenPositions();
        res.json(positions);
    } catch (error: any) {
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
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel all orders for a symbol
app.delete('/api/orders/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const result = await binance.cancelAllOrders(symbol);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Kill switch - cancel all orders and close positions
app.post('/api/kill-switch', async (req, res) => {
    try {
        const result = await binance.emergencyCloseAll();
        riskManager.activateKillSwitch();
        res.json({ success: true, result });
    } catch (error: any) {
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

app.listen(PORT, () => {
    console.log(`Trading server running on port ${PORT}`);
    console.log(`Mode: ${binance.isTestnet() ? 'TESTNET' : 'PRODUCTION'}`);
});
