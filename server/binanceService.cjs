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

        // Cache exchange info for LOT_SIZE (cache TTL 1 hour)
        this._exchangeInfoCache = null;
        this._exchangeInfoCacheTime = 0;
        this._exchangeInfoCacheTtlMs = 60 * 60 * 1000;

        // Cache /account to avoid Binance rate limit (IP ban on "way too much request weight")
        this._accountCache = null;
        this._accountCacheTime = 0;
        this._accountCacheTtlMs = 30 * 1000;

        console.log(`Binance Service initialized. Mode: ${this.testnet ? 'TESTNET' : 'PRODUCTION'}, Dry Run: ${this.dryRun}`);
    }

    /**
     * Get exchange info (symbols + filters). Uses cache to avoid repeated requests.
     */
    async getExchangeInfo() {
        const now = Date.now();
        if (this._exchangeInfoCache && now - this._exchangeInfoCacheTime < this._exchangeInfoCacheTtlMs) {
            return this._exchangeInfoCache;
        }
        const response = await fetch(`${this.baseUrl}/exchangeInfo`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.msg || 'Failed to fetch exchange info');
        this._exchangeInfoCache = data;
        this._exchangeInfoCacheTime = now;
        return data;
    }

    /**
     * Get LOT_SIZE filter for a symbol (minQty, maxQty, stepSize).
     */
    async getLotSizeFilter(symbol) {
        const info = await this.getExchangeInfo();
        const sym = info.symbols?.find((s) => s.symbol === symbol);
        if (!sym) return null;
        const lotSize = sym.filters?.find((f) => f.filterType === 'LOT_SIZE');
        return lotSize || null;
    }

    /**
     * Round quantity to comply with LOT_SIZE (stepSize, minQty, maxQty).
     * Returns a number; caller should format with correct decimals when sending to API.
     */
    async roundQuantityToLotSize(symbol, quantity) {
        const lot = await this.getLotSizeFilter(symbol);
        if (!lot) return quantity;

        const minQty = parseFloat(lot.minQty);
        const maxQty = parseFloat(lot.maxQty);
        const stepSize = parseFloat(lot.stepSize);

        if (quantity <= 0) return minQty;

        // Round down to stepSize multiple (avoid float noise)
        const precision = stepSize < 1 ? (lot.stepSize.toString().split('.')[1]?.length || 8) : 0;
        const steps = Math.floor(quantity / stepSize);
        let rounded = steps * stepSize;
        rounded = parseFloat(rounded.toFixed(precision));

        if (rounded < minQty) rounded = minQty;
        if (rounded > maxQty) rounded = maxQty;

        return rounded;
    }

    /**
     * Format quantity string for Binance API (correct decimals for stepSize).
     */
    _formatQuantityForLotSize(quantity, stepSizeStr) {
        const step = stepSizeStr || '0.001';
        const frac = step.includes('.') ? step.split('.')[1] : '';
        const decimals = frac ? frac.replace(/0+$/, '').length : 0;
        return quantity.toFixed(Math.min(decimals, 8));
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

    getAccountInfo() {
        const now = Date.now();
        if (this._accountCache && (now - this._accountCacheTime) < this._accountCacheTtlMs) {
            return Promise.resolve(this._accountCache);
        }
        return this.signedRequest('/account')
            .then((data) => {
                this._accountCache = data;
                this._accountCacheTime = Date.now();
                return data;
            })
            .catch((err) => {
                if (this._accountCache && /request weight|IP banned/i.test(err.message || '')) {
                    return this._accountCache;
                }
                throw err;
            });
    }

    invalidateAccountCache() {
        this._accountCache = null;
        this._accountCacheTime = 0;
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
        const roundedQty = await this.roundQuantityToLotSize(params.symbol, params.quantity);
        const lot = await this.getLotSizeFilter(params.symbol);
        const qtyStr = lot ? this._formatQuantityForLotSize(roundedQty, lot.stepSize) : String(roundedQty);

        const orderParams = {
            symbol: params.symbol,
            side: params.side,
            type: params.type,
            quantity: qtyStr
        };

        if (params.type === 'LIMIT' && params.price) {
            orderParams.price = params.price.toFixed(2);
            orderParams.timeInForce = params.timeInForce || 'GTC';
        }

        console.log(`${this.dryRun ? '[DRY RUN] ' : ''}Placing ${params.type} ${params.side} order for ${params.symbol}: ${qtyStr} (requested: ${params.quantity})`);

        return this.signedRequest('/order', 'POST', orderParams);
    }

    async placeStopLoss(symbol, side, quantity, stopPrice) {
        const roundedQty = await this.roundQuantityToLotSize(symbol, quantity);
        const lot = await this.getLotSizeFilter(symbol);
        const qtyStr = lot ? this._formatQuantityForLotSize(roundedQty, lot.stepSize) : String(roundedQty);

        const params = {
            symbol,
            side,
            type: 'STOP_LOSS_LIMIT',
            quantity: qtyStr,
            stopPrice: stopPrice.toFixed(2),
            price: stopPrice.toFixed(2),
            timeInForce: 'GTC'
        };

        console.log(`${this.dryRun ? '[DRY RUN] ' : ''}Placing stop-loss for ${symbol} at ${stopPrice}`);
        return this.signedRequest('/order', 'POST', params);
    }

    async placeTakeProfit(symbol, side, quantity, price) {
        const roundedQty = await this.roundQuantityToLotSize(symbol, quantity);
        const lot = await this.getLotSizeFilter(symbol);
        const qtyStr = lot ? this._formatQuantityForLotSize(roundedQty, lot.stepSize) : String(roundedQty);

        const params = {
            symbol,
            side,
            type: 'TAKE_PROFIT_LIMIT',
            quantity: qtyStr,
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
