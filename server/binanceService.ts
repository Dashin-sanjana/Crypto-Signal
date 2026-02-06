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

export class BinanceService {
    private apiKey: string;
    private apiSecret: string;
    private baseUrl: string;
    private testnet: boolean;

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
        const orderParams: Record<string, any> = {
            symbol: params.symbol,
            side: params.side,
            type: params.type,
            quantity: params.quantity.toFixed(6)
        };

        if (params.type === 'LIMIT' && params.price) {
            orderParams.price = params.price.toFixed(2);
            orderParams.timeInForce = params.timeInForce || 'GTC';
        }

        console.log(`Placing ${params.type} ${params.side} order for ${params.symbol}: ${params.quantity}`);

        return this.signedRequest('/order', 'POST', orderParams);
    }

    async placeStopLoss(
        symbol: string,
        side: 'BUY' | 'SELL',
        quantity: number,
        stopPrice: number
    ): Promise<any> {
        const params: Record<string, any> = {
            symbol,
            side,
            type: 'STOP_LOSS_LIMIT',
            quantity: quantity.toFixed(6),
            stopPrice: stopPrice.toFixed(2),
            price: stopPrice.toFixed(2), // For STOP_LOSS_LIMIT, price is required
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
        const params: Record<string, any> = {
            symbol,
            side,
            type: 'TAKE_PROFIT_LIMIT',
            quantity: quantity.toFixed(6),
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
