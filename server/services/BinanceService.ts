/**
 * Binance API service for trade execution
 */
import crypto from 'crypto';
import axios from 'axios';

interface BinanceConfig {
  apiKey: string;
  apiSecret: string;
  testnet?: boolean;
  dryRun?: boolean;
}

export class BinanceService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private dryRun: boolean;
  private balance: number = 1000; // Default balance for dry run

  constructor(config: BinanceConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = config.testnet
      ? 'https://testnet.binance.vision/api/v3'
      : 'https://api.binance.com/api/v3';
    this.dryRun = config.dryRun ?? true;
  }

  /**
   * Generate signature for authenticated requests
   */
  private generateSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Make authenticated request to Binance API
   */
  private async authenticatedRequest(
    method: 'GET' | 'POST',
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<any> {
    if (this.dryRun) {
      // Simulate API response in dry run mode
      return this.simulateResponse(method, endpoint, params);
    }

    const timestamp = Date.now();
    const queryString = new URLSearchParams({
      ...params,
      timestamp: timestamp.toString(),
    }).toString();

    const signature = this.generateSignature(queryString);
    const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    try {
      const response = await axios({
        method,
        url,
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.msg || error.message || 'Binance API error'
      );
    }
  }

  /**
   * Simulate API response for dry run mode
   */
  private simulateResponse(
    method: string,
    endpoint: string,
    params: any
  ): any {
    if (endpoint === '/order' && method === 'POST') {
      return {
        orderId: `dry_run_${Date.now()}`,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity,
        price: params.price || 0,
        status: 'FILLED',
        executedQty: params.quantity,
        fills: params.price
          ? [{ price: params.price, qty: params.quantity }]
          : [],
      };
    }
    if (endpoint === '/account') {
      return {
        balances: [
          {
            asset: 'USDT',
            free: this.balance.toString(),
            locked: '0',
          },
        ],
      };
    }
    return {};
  }

  /**
   * Place market order
   */
  async placeMarketOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number
  ): Promise<any> {
    if (this.dryRun) {
      // Get current price for dry run fill price
      let fillPrice = 0;
      try {
        fillPrice = await this.getCurrentPrice(symbol);
      } catch (error) {
        console.warn(`Could not get current price for dry run, using 0`);
      }

      console.log(`[DRY RUN] Market ${side} order: ${symbol} ${quantity} @ ${fillPrice}`);
      return {
        orderId: `dry_run_${Date.now()}`,
        symbol,
        side,
        quantity,
        status: 'FILLED',
        dryRun: true,
        fills: [{
          price: fillPrice.toString(),
          qty: quantity.toString(),
        }],
      };
    }

    const result = await this.authenticatedRequest('POST', '/order', {
      symbol,
      side,
      type: 'MARKET',
      quantity,
    });

    // Ensure result has fills array for consistency
    if (!result.fills && result.executedQty) {
      result.fills = [{
        price: result.price || result.fills?.[0]?.price || '0',
        qty: result.executedQty.toString(),
      }];
    }

    return result;
  }

  /**
   * Place limit order
   */
  async placeLimitOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number
  ): Promise<any> {
    if (this.dryRun) {
      console.log(`[DRY RUN] Limit ${side} order: ${symbol} ${quantity} @ ${price}`);
      return {
        orderId: `dry_run_${Date.now()}`,
        symbol,
        side,
        quantity,
        price,
        status: 'FILLED',
        dryRun: true,
      };
    }

    return this.authenticatedRequest('POST', '/order', {
      symbol,
      side,
      type: 'LIMIT',
      quantity,
      price,
      timeInForce: 'GTC',
    });
  }

  /**
   * Get current price
   */
  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/ticker/price?symbol=${symbol}`
      );
      return parseFloat(response.data.price);
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(): Promise<number> {
    if (this.dryRun) {
      return this.balance;
    }

    try {
      const account = await this.authenticatedRequest('GET', '/account');
      const usdtBalance = account.balances.find(
        (b: any) => b.asset === 'USDT'
      );
      return parseFloat(usdtBalance?.free || '0');
    } catch (error) {
      console.error('Error fetching balance:', error);
      return this.balance; // Fallback to cached balance
    }
  }

  /**
   * Update balance (for dry run)
   */
  setBalance(balance: number): void {
    this.balance = balance;
  }

  /**
   * Get balance (cached)
   */
  getBalance(): number {
    return this.balance;
  }
}
