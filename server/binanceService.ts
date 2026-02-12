import crypto from 'crypto';

interface OrderParams {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT_LIMIT';
    quantity: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

interface LotSizeFilter {
    filterType: string;
    minQty: string;
    maxQty: string;
    stepSize: string;
}

export class BinanceService {
    private apiKey: string;
    private apiSecret: string;
    private baseUrl: string;
    private testnet: boolean;
    private exchangeInfoCache: any = null;
    private exchangeInfoCacheTime = 0;
    private readonly exchangeInfoCacheTtlMs = 60 * 60 * 1000;

    constructor() {
        this.apiKey = process.env.BINANCE_API_KEY || '';
        this.apiSecret = process.env.BINANCE_API_SECRET || '';
        this.testnet = process.env.BINANCE_TESTNET === 'true';

        // Use testnet or production URLs
        this.baseUrl = this.testnet
            ? 'https://testnet.binance.vision/api/v3'
            : 'https://api.binance.com/api/v3';

        if (!this.apiKey || !this.apiSecret) {
            console.warn('Binance API credentials not configured');
        }
    }

    private async getExchangeInfo(): Promise<any> {
        const now = Date.now();
        if (this.exchangeInfoCache && now - this.exchangeInfoCacheTime < this.exchangeInfoCacheTtlMs) {
            return this.exchangeInfoCache;
        }
        const response = await fetch(`${this.baseUrl}/exchangeInfo`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.msg || 'Failed to fetch exchange info');
        this.exchangeInfoCache = data;
        this.exchangeInfoCacheTime = now;
        return data;
    }

    private async getLotSizeFilter(symbol: string): Promise<LotSizeFilter | null> {
        const info = await this.getExchangeInfo();
        const sym = info.symbols?.find((s: any) => s.symbol === symbol);
        if (!sym) return null;
        const lotSize = sym.filters?.find((f: any) => f.filterType === 'LOT_SIZE');
        return lotSize || null;
    }

    private async roundQuantityToLotSize(symbol: string, quantity: number): Promise<number> {
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

        return Math.min(maxQty, Math.max(minQty, rounded));
    }

    private formatQuantityForLotSize(quantity: number, stepSizeStr: string): string {
        const frac = stepSizeStr?.includes('.') ? stepSizeStr.split('.')[1] : '';
        const decimals = frac ? frac.replace(/0+$/, '').length : 0;
        return quantity.toFixed(Math.min(decimals, 8));
    }

    isTestnet(): boolean {
        return this.testnet;
    }

    private sign(queryString: string): string {
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }

    private async signedRequest(
        endpoint: string,
        method: 'GET' | 'POST' | 'DELETE' = 'GET',
        params: Record<string, any> = {}
    ): Promise<any> {
        const timestamp = Date.now();
        const queryParams = new URLSearchParams({
            ...params,
            timestamp: timestamp.toString(),
            recvWindow: '5000'
        });

        const signature = this.sign(queryParams.toString());
        queryParams.append('signature', signature);

        const url = `${this.baseUrl}${endpoint}?${queryParams.toString()}`;

        const response = await fetch(url, {
            method,
            headers: {
                'X-MBX-APIKEY': this.apiKey,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.msg || `API Error: ${response.status}`);
        }

        return data;
    }

    async getAccountInfo(): Promise<any> {
        return this.signedRequest('/account');
    }

    async getCurrentPrice(symbol: string): Promise<number> {
        const response = await fetch(`${this.baseUrl}/ticker/price?symbol=${symbol}`);
        const data = await response.json();
        return parseFloat(data.price);
    }

    async getOpenPositions(): Promise<any[]> {
        const account = await this.getAccountInfo();
        return account.balances?.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0) || [];
    }

    async getOpenOrders(symbol?: string): Promise<any[]> {
        const params: Record<string, string> = {};
        if (symbol) params.symbol = symbol;
        return this.signedRequest('/openOrders', 'GET', params);
    }

    async placeOrder(params: OrderParams): Promise<any> {
        const roundedQty = await this.roundQuantityToLotSize(params.symbol, params.quantity);
        const lot = await this.getLotSizeFilter(params.symbol);
        const qtyStr = lot ? this.formatQuantityForLotSize(roundedQty, lot.stepSize) : String(roundedQty);

        const orderParams: Record<string, any> = {
            symbol: params.symbol,
            side: params.side,
            type: params.type,
            quantity: qtyStr
        };

        if (params.type === 'LIMIT' && params.price) {
            orderParams.price = params.price.toFixed(2);
            orderParams.timeInForce = params.timeInForce || 'GTC';
        }

        console.log(`Placing ${params.type} ${params.side} order for ${params.symbol}: ${qtyStr} (requested: ${params.quantity})`);

        return this.signedRequest('/order', 'POST', orderParams);
    }

    async placeStopLoss(
        symbol: string,
        side: 'BUY' | 'SELL',
        quantity: number,
        stopPrice: number
    ): Promise<any> {
        const roundedQty = await this.roundQuantityToLotSize(symbol, quantity);
        const lot = await this.getLotSizeFilter(symbol);
        const qtyStr = lot ? this.formatQuantityForLotSize(roundedQty, lot.stepSize) : String(roundedQty);

        const params: Record<string, any> = {
            symbol,
            side,
            type: 'STOP_LOSS_LIMIT',
            quantity: qtyStr,
            stopPrice: stopPrice.toFixed(2),
            price: stopPrice.toFixed(2),
            timeInForce: 'GTC'
        };

        console.log(`Placing stop-loss for ${symbol} at ${stopPrice}`);
        return this.signedRequest('/order', 'POST', params);
    }

    async placeTakeProfit(
        symbol: string,
        side: 'BUY' | 'SELL',
        quantity: number,
        price: number
    ): Promise<any> {
        const roundedQty = await this.roundQuantityToLotSize(symbol, quantity);
        const lot = await this.getLotSizeFilter(symbol);
        const qtyStr = lot ? this.formatQuantityForLotSize(roundedQty, lot.stepSize) : String(roundedQty);

        const params: Record<string, any> = {
            symbol,
            side,
            type: 'TAKE_PROFIT_LIMIT',
            quantity: qtyStr,
            stopPrice: price.toFixed(2),
            price: price.toFixed(2),
            timeInForce: 'GTC'
        };

        console.log(`Placing take-profit for ${symbol} at ${price}`);
        return this.signedRequest('/order', 'POST', params);
    }

    async cancelOrder(symbol: string, orderId: number): Promise<any> {
        return this.signedRequest('/order', 'DELETE', { symbol, orderId: orderId.toString() });
    }

    async cancelAllOrders(symbol: string): Promise<any> {
        return this.signedRequest('/openOrders', 'DELETE', { symbol });
    }

    async emergencyCloseAll(): Promise<any[]> {
        const results: any[] = [];

        // Get all open orders
        const openOrders = await this.getOpenOrders();

        // Cancel all open orders
        const symbols = [...new Set(openOrders.map((o: any) => o.symbol))];
        for (const symbol of symbols) {
            try {
                const result = await this.cancelAllOrders(symbol);
                results.push({ symbol, action: 'cancelled', result });
            } catch (error: any) {
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
                } catch (error: any) {
                    results.push({ asset: position.asset, action: 'error', error: error.message });
                }
            }
        }

        return results;
    }
}
