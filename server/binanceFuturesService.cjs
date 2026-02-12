const crypto = require('crypto');

/**
 * Binance USDT-M Futures adapter.
 *
 * This mirrors the public surface of the existing spot BinanceService
 * but talks to the USDT-M futures REST API instead of spot.
 *
 * Spot URLs:
 *   - Testnet: https://testnet.binance.vision/api/v3
 *   - Prod:    https://api.binance.com/api/v3
 *
 * Futures URLs (USDT-M):
 *   - Testnet: https://testnet.binancefuture.com/fapi
 *   - Prod:    https://fapi.binance.com/fapi
 *
 * Endpoints we call always include the version prefix, e.g. /v1/order, /v2/account.
 */
class BinanceFuturesService {
    constructor() {
        this.apiKey = process.env.BINANCE_API_KEY || '';
        this.apiSecret = process.env.BINANCE_API_SECRET || '';
        this.testnet = process.env.BINANCE_TESTNET === 'true';
        this.dryRun = process.env.BINANCE_DRY_RUN === 'true';

        // Allow overriding the base URL via env so we can target
        // Demo, Testnet, or Prod explicitly.
        const envBase = process.env.BINANCE_FAPI_BASE_URL;
        if (envBase && envBase.trim().length > 0) {
            // Strip any trailing slashes to keep endpoint building simple
            this.baseUrl = envBase.replace(/\/+$/, '');
        } else {
            this.baseUrl = this.testnet
                ? 'https://testnet.binancefuture.com/fapi'
                : 'https://fapi.binance.com/fapi';
        }

        if (!this.apiKey || !this.apiSecret) {
            console.warn('Binance Futures API credentials not configured');
        }

        // Cache exchange info for LOT_SIZE / NOTIONAL filters (TTL 1h)
        this._exchangeInfoCache = null;
        this._exchangeInfoCacheTime = 0;
        this._exchangeInfoCacheTtlMs = 60 * 60 * 1000;

        // Cache /account to avoid hammering Binance (TTL 30s)
        this._accountCache = null;
        this._accountCacheTime = 0;
        this._accountCacheTtlMs = 30 * 1000;

        console.log(
            `Binance Futures Service initialized. Mode: ${this.testnet ? 'TESTNET' : 'PRODUCTION'}, Dry Run: ${this.dryRun}, Base URL: ${this.baseUrl}`
        );
    }

    async getExchangeInfo() {
        const now = Date.now();
        if (this._exchangeInfoCache && now - this._exchangeInfoCacheTime < this._exchangeInfoCacheTtlMs) {
            return this._exchangeInfoCache;
        }
        const response = await fetch(`${this.baseUrl}/v1/exchangeInfo`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.msg || 'Failed to fetch futures exchange info');
        this._exchangeInfoCache = data;
        this._exchangeInfoCacheTime = now;
        return data;
    }

    async getLotSizeFilter(symbol) {
        const info = await this.getExchangeInfo();
        const sym = info.symbols?.find((s) => s.symbol === symbol);
        if (!sym) return null;
        const lotSize = sym.filters?.find((f) => f.filterType === 'LOT_SIZE');
        return lotSize || null;
    }

    _formatQuantityForLotSize(quantity, stepSizeStr) {
        const step = stepSizeStr || '0.001';
        const frac = step.includes('.') ? step.split('.')[1] : '';
        const decimals = frac ? frac.replace(/0+$/, '').length : 0;
        return quantity.toFixed(Math.min(decimals, 8));
    }

    async roundQuantityToLotSize(symbol, quantity) {
        const lot = await this.getLotSizeFilter(symbol);
        if (!lot) return quantity;

        const minQty = parseFloat(lot.minQty);
        const maxQty = parseFloat(lot.maxQty);
        const stepSize = parseFloat(lot.stepSize);

        if (quantity <= 0) return minQty;

        const precision = stepSize < 1 ? (lot.stepSize.toString().split('.')[1]?.length || 8) : 0;
        const steps = Math.floor(quantity / stepSize);
        let rounded = steps * stepSize;
        rounded = parseFloat(rounded.toFixed(precision));

        if (rounded < minQty) rounded = minQty;
        if (rounded > maxQty) rounded = maxQty;

        return rounded;
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
            console.log('[DRY RUN] Params:', params);

            if (endpoint === '/v1/order') {
                return { orderId: 'Simulated-' + Date.now(), status: 'FILLED', symbol: params.symbol };
            }
            if (endpoint === '/v1/allOpenOrders' && method === 'DELETE') {
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
            console.error(`Binance Futures API Error (${endpoint}):`, data.msg || response.status);
            throw new Error(data.msg || `API Error: ${response.status}`);
        }

        return data;
    }

    getAccountInfo() {
        const now = Date.now();
        if (this._accountCache && now - this._accountCacheTime < this._accountCacheTtlMs) {
            return Promise.resolve(this._accountCache);
        }
        return this.signedRequest('/v2/account')
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
        const response = await fetch(`${this.baseUrl}/v1/ticker/price?symbol=${symbol}`);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.msg || 'Failed to fetch futures price');
        }
        return parseFloat(data.price);
    }

    /**
     * Get open futures positions as a normalized list.
     * Only non-zero positions are returned.
     */
    async getOpenPositions() {
        const account = await this.getAccountInfo();
        const positions = account.positions || [];
        return positions
            .filter((p) => parseFloat(p.positionAmt) !== 0)
            .map((p) => {
                const amt = parseFloat(p.positionAmt);
                const side = amt > 0 ? 'LONG' : 'SHORT';
                const quantity = Math.abs(amt);
                return {
                    symbol: p.symbol,
                    side,
                    quantity,
                    entryPrice: parseFloat(p.entryPrice),
                    markPrice: parseFloat(p.markPrice || '0'),
                    unrealizedPnl: parseFloat(p.unrealizedProfit || '0'),
                    leverage: parseFloat(p.leverage || '1')
                };
            });
    }

    async getOpenOrders(symbol) {
        const params = {};
        if (symbol) params.symbol = symbol;
        return this.signedRequest('/v1/openOrders', 'GET', params);
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

        if (params.positionSide) {
            orderParams.positionSide = params.positionSide;
        }

        if (params.reduceOnly) {
            orderParams.reduceOnly = 'true';
        }

        if (params.type === 'LIMIT' && params.price) {
            orderParams.price = params.price.toFixed(2);
            orderParams.timeInForce = params.timeInForce || 'GTC';
        }

        console.log(
            `${this.dryRun ? '[DRY RUN] ' : ''}Placing ${params.type} ${params.side} order for ${params.symbol}: ${qtyStr} (requested: ${params.quantity})`
        );

        return this.signedRequest('/v1/order', 'POST', orderParams);
    }

    /**
     * Create a futures stop-loss that will close the entire position when hit.
     */
    async placeStopLoss(symbol, side, quantity, stopPrice) {
        const roundedQty = await this.roundQuantityToLotSize(symbol, quantity);
        const lot = await this.getLotSizeFilter(symbol);
        const qtyStr = lot ? this._formatQuantityForLotSize(roundedQty, lot.stepSize) : String(roundedQty);

        const params = {
            symbol,
            side,
            type: 'STOP_MARKET',
            stopPrice: stopPrice.toFixed(2),
            closePosition: 'true',
            quantity: qtyStr
        };

        console.log(
            `${this.dryRun ? '[DRY RUN] ' : ''}Placing futures stop-loss for ${symbol} at ${stopPrice} (qty ${qtyStr})`
        );
        return this.signedRequest('/v1/order', 'POST', params);
    }

    /**
     * Create a futures take-profit that will close the entire position when hit.
     */
    async placeTakeProfit(symbol, side, quantity, price) {
        const roundedQty = await this.roundQuantityToLotSize(symbol, quantity);
        const lot = await this.getLotSizeFilter(symbol);
        const qtyStr = lot ? this._formatQuantityForLotSize(roundedQty, lot.stepSize) : String(roundedQty);

        const params = {
            symbol,
            side,
            type: 'TAKE_PROFIT_MARKET',
            stopPrice: price.toFixed(2),
            closePosition: 'true',
            quantity: qtyStr
        };

        console.log(
            `${this.dryRun ? '[DRY RUN] ' : ''}Placing futures take-profit for ${symbol} at ${price} (qty ${qtyStr})`
        );
        return this.signedRequest('/v1/order', 'POST', params);
    }

    async cancelOrder(symbol, orderId) {
        return this.signedRequest('/v1/order', 'DELETE', { symbol, orderId: orderId.toString() });
    }

    async cancelAllOrders(symbol) {
        const params = {};
        if (symbol) params.symbol = symbol;
        return this.signedRequest('/v1/allOpenOrders', 'DELETE', params);
    }

    /**
     * Close a single position for a symbol by sending a reduce-only market order
     * in the opposite direction for the full size of the current position.
     */
    async closePosition(symbol) {
        const positions = await this.getOpenPositions();
        const pos = positions.find((p) => p.symbol === symbol);
        if (!pos) {
            throw new Error(`No open futures position for ${symbol}`);
        }

        const closeSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
        return this.placeOrder({
            symbol,
            side: closeSide,
            type: 'MARKET',
            quantity: pos.quantity,
            reduceOnly: true
        });
    }

    /**
     * Kill switch: cancel all open orders and close all positions.
     */
    async emergencyCloseAll() {
        const results = [];

        // Cancel all open orders
        const openOrders = await this.getOpenOrders();
        const symbols = [...new Set(openOrders.map((o) => o.symbol))];
        for (const symbol of symbols) {
            try {
                const result = await this.cancelAllOrders(symbol);
                results.push({ symbol, action: 'cancelled_orders', result });
            } catch (error) {
                results.push({ symbol, action: 'cancel_error', error: error.message });
            }
        }

        // Close all open positions
        const positions = await this.getOpenPositions();
        for (const pos of positions) {
            try {
                const closeSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
                const result = await this.placeOrder({
                    symbol: pos.symbol,
                    side: closeSide,
                    type: 'MARKET',
                    quantity: pos.quantity,
                    reduceOnly: true
                });
                results.push({ symbol: pos.symbol, action: 'closed_position', result });
            } catch (error) {
                results.push({ symbol: pos.symbol, action: 'close_error', error: error.message });
            }
        }

        return results;
    }
}

module.exports = { BinanceFuturesService };

