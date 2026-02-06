import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { usePriceContext } from './PriceContext';

const TRADING_API_URL = import.meta.env.VITE_TRADING_API_URL || 'http://localhost:3001';

interface TradeRecord {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    orderId: string;
    timestamp: number;
    pnl?: number;
}

interface RiskStatus {
    dailyPnL: number;
    dailyLossLimit: number;
    maxPositionSize: number;
    openTradesCount: number;
    maxOpenTrades: number;
    killSwitchActive: boolean;
    tradingAllowed: boolean;
}

interface TradingContextType {
    autoTradingEnabled: boolean;
    setAutoTradingEnabled: (enabled: boolean) => void;
    isConnected: boolean;
    riskStatus: RiskStatus | null;
    openTrades: TradeRecord[];
    tradeHistory: TradeRecord[];
    placeOrder: (params: {
        symbol: string;
        side: 'BUY' | 'SELL';
        quantity: number;
        stopLoss?: number;
        takeProfit?: number;
    }) => Promise<any>;
    activateKillSwitch: () => Promise<void>;
    refreshStatus: () => Promise<void>;
    minSignalStrength: number;
    setMinSignalStrength: (strength: number) => void;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export const useTradingContext = () => {
    const context = useContext(TradingContext);
    if (!context) {
        throw new Error('useTradingContext must be used within TradingProvider');
    }
    return context;
};

interface TradingProviderProps {
    children: ReactNode;
}

export const TradingProvider: React.FC<TradingProviderProps> = ({ children }) => {
    const [autoTradingEnabled, setAutoTradingEnabled] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [riskStatus, setRiskStatus] = useState<RiskStatus | null>(null);
    const [openTrades, setOpenTrades] = useState<TradeRecord[]>([]);
    const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>([]);
    const [minSignalStrength, setMinSignalStrength] = useState(
        parseInt(import.meta.env.VITE_AUTO_TRADING_MIN_STRENGTH || '7')
    );

    const { prices, selectedSymbol, tpslData, recommendation, tradeDirection } = usePriceContext();

    // Check server connection
    const checkConnection = useCallback(async () => {
        try {
            const response = await fetch(`${TRADING_API_URL}/health`);
            if (response.ok) {
                setIsConnected(true);
                return true;
            }
        } catch {
            setIsConnected(false);
        }
        return false;
    }, []);

    // Fetch risk status and open trades
    const refreshStatus = useCallback(async () => {
        try {
            const [riskRes, tradesRes, openTradesRes] = await Promise.all([
                fetch(`${TRADING_API_URL}/api/risk-status`),
                fetch(`${TRADING_API_URL}/api/trades`),
                fetch(`${TRADING_API_URL}/api/open-trades`)
            ]);

            if (riskRes.ok) {
                const status = await riskRes.json();
                setRiskStatus(status);
            }

            if (tradesRes.ok) {
                const trades = await tradesRes.json();
                setTradeHistory(trades);
            }

            if (openTradesRes.ok) {
                const openPositions = await openTradesRes.json();
                setOpenTrades(openPositions);
            }
        } catch (error) {
            console.error('Failed to fetch trading status:', error);
        }
    }, []);


    // Place order
    const placeOrder = useCallback(async (params: {
        symbol: string;
        side: 'BUY' | 'SELL';
        quantity: number;
        stopLoss?: number;
        takeProfit?: number;
    }) => {
        const currentPrice = prices[params.symbol]?.price;

        const response = await fetch(`${TRADING_API_URL}/api/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...params,
                type: 'MARKET',
                price: currentPrice
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Order failed');
        }

        await refreshStatus();
        return result;
    }, [prices, refreshStatus]);

    // Kill switch
    const activateKillSwitch = useCallback(async () => {
        try {
            const response = await fetch(`${TRADING_API_URL}/api/kill-switch`, {
                method: 'POST'
            });

            if (response.ok) {
                setAutoTradingEnabled(false);
                await refreshStatus();
            }
        } catch (error) {
            console.error('Kill switch failed:', error);
        }
    }, [refreshStatus]);

    // Auto-execute trades based on signals
    useEffect(() => {
        if (!autoTradingEnabled || !isConnected || !tpslData || !riskStatus?.tradingAllowed) {
            return;
        }

        // Check if signal is strong enough
        const isStrongSignal =
            (recommendation.action === 'STRONG BUY' || recommendation.action === 'STRONG SELL') &&
            recommendation.confidence >= minSignalStrength * 10;

        if (!isStrongSignal) return;

        // Check if we already have a position in this symbol
        if (openTrades.some(t => t.symbol === selectedSymbol)) return;

        // Determine trade direction from signal
        const signalSide = recommendation.action.includes('BUY') ? 'BUY' : 'SELL';

        // Only trade if signal matches our selected direction
        if ((signalSide === 'BUY' && tradeDirection !== 'BUY') ||
            (signalSide === 'SELL' && tradeDirection !== 'SELL')) {
            return;
        }

        // Calculate quantity based on max position size
        const currentPrice = prices[selectedSymbol]?.price;
        if (!currentPrice) return;

        const quantity = (riskStatus.maxPositionSize / currentPrice);

        console.log(`Auto-executing ${signalSide} trade for ${selectedSymbol}`);

        placeOrder({
            symbol: selectedSymbol,
            side: signalSide,
            quantity,
            stopLoss: tpslData.sl,
            takeProfit: tpslData.tp2
        }).catch(error => {
            console.error('Auto-trade failed:', error);
        });

    }, [
        autoTradingEnabled,
        isConnected,
        recommendation,
        selectedSymbol,
        tpslData,
        riskStatus,
        openTrades,
        prices,
        tradeDirection,
        minSignalStrength,
        placeOrder
    ]);

    // Initial connection check and periodic refresh
    useEffect(() => {
        checkConnection();
        const interval = setInterval(() => {
            checkConnection();
            if (isConnected) refreshStatus();
        }, 5000);

        return () => clearInterval(interval);
    }, [checkConnection, refreshStatus, isConnected]);

    const value = {
        autoTradingEnabled,
        setAutoTradingEnabled,
        isConnected,
        riskStatus,
        openTrades,
        tradeHistory,
        placeOrder,
        activateKillSwitch,
        refreshStatus,
        minSignalStrength,
        setMinSignalStrength
    };

    return (
        <TradingContext.Provider value={value}>
            {children}
        </TradingContext.Provider>
    );
};
