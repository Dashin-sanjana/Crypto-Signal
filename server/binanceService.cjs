const crypto = require('crypto');

class BinanceService {
    constructor() {
        this.apiKey = process.env.BINANCE_API_KEY || '';
        this.apiSecret = process.env.BINANCE_API_SECRET || '';
        this.testnet = process.env.BINANCE_TESTNET === 'true';
        this.dryRun = process.env.BINANCE_DRY_RUN === 'true';

        // Use testnet or production URLs
        this.baseUrl = this.testnet
            ? 'https://testnet.binance.vision/api/v3'
            : 'https://api.binance.com/api/v3';

        if (!this.apiKey || !this.apiSecret) {
            console.warn('Binance API credentials not configured');
        }

        console.log(`Binance Service initialized. Mode: ${this.testnet ? 'TESTNET' : 'PRODUCTION'}, Dry Run: ${this.dryRun}`);
    }

    isDryRun() {
        return this.dryRun;
    }

    isTestnet() {
        return this.testnet;
    }

    sign(queryString) {
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }

    async signedRequest(endpoint, method = 'GET', params = {}) {
        const timestamp = Date.now();
        const queryParams = new URLSearchParams({
            ...params,
            timestamp: timestamp.toString(),
            recvWindow: '5000'
        });

        const signature = this.sign(queryParams.toString());
        queryParams.append('signature', signature);

        const url = `${this.baseUrl}${endpoint}?${queryParams.toString()}`;

        // Dry run: bypass mutations
        if (this.dryRun && (method === 'POST' || method === 'DELETE')) {
            console.log(`[DRY RUN] Simulating ${method} request to ${endpoint}`);
            console.log(`[DRY RUN] Params:`, params);
            
            // Return mock success responses
            if (endpoint === '/order') {
                return { orderId: 'Simulated-' + Date.now(), status: 'FILLED', symbol: params.symbol };
            }
            if (endpoint === '/openOrders' && method === 'DELETE') {
                return { msg: 'Simulated cancel all success' };
            }
            return { success: true, simulated: true };
        }

        const response = await fetch(url, {
            method,
            headers: {
                'X-MBX-APIKEY': this.apiKey,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`Binance API Error (${endpoint}):`, data.msg || response.status);
            throw new Error(data.msg || `API Error: ${response.status}`);
        }

        return data;
    }

    async getAccountInfo() {
        return this.signedRequest('/account');
    }

    async getCurrentPrice(symbol) {
        const response = await fetch(`${this.baseUrl}/ticker/price?symbol=${symbol}`);
        const data = await response.json();
        return parseFloat(data.price);
    }

    async getOpenPositions() {
        const account = await this.getAccountInfo();
        return account.balances?.filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0) || [];
    }

    async getOpenOrders(symbol) {
        const params = {};
        if (symbol) params.symbol = symbol;
        return this.signedRequest('/openOrders', 'GET', params);
    }

    async placeOrder(params) {
        const orderParams = {
            symbol: params.symbol,
            side: params.side,
            type: params.type,
            quantity: params.quantity.toFixed(6)
        };

        if (params.type === 'LIMIT' && params.price) {
            orderParams.price = params.price.toFixed(2);
            orderParams.timeInForce = params.timeInForce || 'GTC';
        }

        console.log(`${this.dryRun ? '[DRY RUN] ' : ''}Placing ${params.type} ${params.side} order for ${params.symbol}: ${params.quantity}`);

        return this.signedRequest('/order', 'POST', orderParams);
    }

    async placeStopLoss(symbol, side, quantity, stopPrice) {
        const params = {
            symbol,
            side,
            type: 'STOP_LOSS_LIMIT',
            quantity: quantity.toFixed(6),
            stopPrice: stopPrice.toFixed(2),
            price: stopPrice.toFixed(2),
            timeInForce: 'GTC'
        };

        console.log(`${this.dryRun ? '[DRY RUN] ' : ''}Placing stop-loss for ${symbol} at ${stopPrice}`);
        return this.signedRequest('/order', 'POST', params);
    }

    async placeTakeProfit(symbol, side, quantity, price) {
        const params = {
            symbol,
            side,
            type: 'TAKE_PROFIT_LIMIT',
            quantity: quantity.toFixed(6),
            stopPrice: price.toFixed(2),
            price: price.toFixed(2),
            timeInForce: 'GTC'
        };

        console.log(`${this.dryRun ? '[DRY RUN] ' : ''}Placing take-profit for ${symbol} at ${price}`);
        return this.signedRequest('/order', 'POST', params);
    }

    async cancelOrder(symbol, orderId) {
        return this.signedRequest('/order', 'DELETE', { symbol, orderId: orderId.toString() });
    }

    async cancelAllOrders(symbol) {
        return this.signedRequest('/openOrders', 'DELETE', { symbol });
    }

    async emergencyCloseAll() {
        const results = [];

        // Get all open orders
        const openOrders = await this.getOpenOrders();

        // Cancel all open orders
        const symbols = [...new Set(openOrders.map((o) => o.symbol))];
        for (const symbol of symbols) {
            try {
                const result = await this.cancelAllOrders(symbol);
                results.push({ symbol, action: 'cancelled', result });
            } catch (error) {
                results.push({ symbol, action: 'error', error: error.message });
            }
        }

        // Close all positions (sell all non-USDT balances)
        const positions = await this.getOpenPositions();
        for (const position of positions) {
            if (position.asset !== 'USDT' && parseFloat(position.free) > 0) {
                try {
                    const symbol = `${position.asset}USDT`;
                    const result = await this.placeOrder({
                        symbol,
                        side: 'SELL',
                        type: 'MARKET',
                        quantity: parseFloat(position.free)
                    });
                    results.push({ symbol, action: 'closed', result });
                } catch (error) {
                    results.push({ asset: position.asset, action: 'error', error: error.message });
                }
            }
        }

        return results;
    }
}

module.exports = { BinanceService };
