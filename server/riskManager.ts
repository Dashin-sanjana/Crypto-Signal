interface TradeRecord {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    orderId: string;
    timestamp: number;
    pnl?: number;
}

interface RiskCheckParams {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    currentPrice: number;
}

interface RiskCheckResult {
    allowed: boolean;
    reason?: string;
    adjustedQuantity?: number;
}

export class RiskManager {
    private maxPositionSize: number; // in USDT
    private dailyLossLimit: number; // in USDT
    private maxOpenTrades: number;
    private dailyPnL: number;
    private openTrades: Map<string, TradeRecord>;
    private tradeHistory: TradeRecord[];
    private killSwitchActive: boolean;
    private lastResetDate: string;

    constructor() {
        this.maxPositionSize = parseFloat(process.env.VITE_MAX_POSITION_SIZE || '50');
        this.dailyLossLimit = parseFloat(process.env.VITE_DAILY_LOSS_LIMIT || '100');
        this.maxOpenTrades = 5;
        this.dailyPnL = 0;
        this.openTrades = new Map();
        this.tradeHistory = [];
        this.killSwitchActive = false;
        this.lastResetDate = new Date().toDateString();

        // Auto-reset daily limits at midnight
        this.checkDailyReset();
    }

    private checkDailyReset(): void {
        const today = new Date().toDateString();
        if (today !== this.lastResetDate) {
            this.dailyPnL = 0;
            this.lastResetDate = today;
            console.log('Daily risk limits reset');
        }
    }

    checkOrderAllowed(params: RiskCheckParams): RiskCheckResult {
        this.checkDailyReset();

        // Check kill switch
        if (this.killSwitchActive) {
            return { allowed: false, reason: 'Kill switch is active. Trading disabled.' };
        }

        // Check daily loss limit
        if (this.dailyPnL <= -this.dailyLossLimit) {
            return { allowed: false, reason: `Daily loss limit reached: $${this.dailyLossLimit}` };
        }

        // Check max open trades
        if (this.openTrades.size >= this.maxOpenTrades) {
            return { allowed: false, reason: `Max open trades reached: ${this.maxOpenTrades}` };
        }

        // Check if already have position in this symbol
        if (this.openTrades.has(params.symbol)) {
            return { allowed: false, reason: `Already have open position in ${params.symbol}` };
        }

        // Calculate position value
        const positionValue = params.quantity * params.currentPrice;

        // Adjust quantity if exceeds max position size
        if (positionValue > this.maxPositionSize) {
            const adjustedQuantity = this.maxPositionSize / params.currentPrice;
            return {
                allowed: true,
                adjustedQuantity,
                reason: `Position size adjusted from ${params.quantity} to ${adjustedQuantity.toFixed(6)}`
            };
        }

        return { allowed: true };
    }

    recordTrade(trade: Omit<TradeRecord, 'timestamp'>): void {
        const record: TradeRecord = {
            ...trade,
            timestamp: Date.now()
        };

        this.openTrades.set(trade.symbol, record);
        this.tradeHistory.push(record);

        // Keep only last 100 trades in history
        if (this.tradeHistory.length > 100) {
            this.tradeHistory = this.tradeHistory.slice(-100);
        }

        console.log(`Trade recorded: ${trade.side} ${trade.quantity} ${trade.symbol} @ ${trade.price}`);
    }

    closeTrade(symbol: string, exitPrice: number): number {
        const trade = this.openTrades.get(symbol);
        if (!trade) return 0;

        // Calculate PnL
        const pnl = trade.side === 'BUY'
            ? (exitPrice - trade.price) * trade.quantity
            : (trade.price - exitPrice) * trade.quantity;

        // Update daily PnL
        this.dailyPnL += pnl;

        // Update trade record
        trade.pnl = pnl;

        // Remove from open trades
        this.openTrades.delete(symbol);

        console.log(`Trade closed: ${symbol} PnL: $${pnl.toFixed(2)}`);

        // Check if daily loss limit hit
        if (this.dailyPnL <= -this.dailyLossLimit) {
            console.warn('Daily loss limit reached! Trading disabled.');
        }

        return pnl;
    }

    activateKillSwitch(): void {
        this.killSwitchActive = true;
        this.openTrades.clear();
        console.warn('KILL SWITCH ACTIVATED - All trading disabled');
    }

    deactivateKillSwitch(): void {
        this.killSwitchActive = false;
        console.log('Kill switch deactivated');
    }

    resetDaily(): void {
        this.dailyPnL = 0;
        this.killSwitchActive = false;
        this.lastResetDate = new Date().toDateString();
        console.log('Daily limits and kill switch reset');
    }

    getStatus(): {
        dailyPnL: number;
        dailyLossLimit: number;
        maxPositionSize: number;
        openTradesCount: number;
        maxOpenTrades: number;
        killSwitchActive: boolean;
        tradingAllowed: boolean;
    } {
        this.checkDailyReset();

        return {
            dailyPnL: this.dailyPnL,
            dailyLossLimit: this.dailyLossLimit,
            maxPositionSize: this.maxPositionSize,
            openTradesCount: this.openTrades.size,
            maxOpenTrades: this.maxOpenTrades,
            killSwitchActive: this.killSwitchActive,
            tradingAllowed: !this.killSwitchActive && this.dailyPnL > -this.dailyLossLimit
        };
    }

    getOpenTrades(): TradeRecord[] {
        return Array.from(this.openTrades.values());
    }

    getTradeHistory(): TradeRecord[] {
        return this.tradeHistory;
    }
}
