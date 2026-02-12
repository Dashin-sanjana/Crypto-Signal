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
    botLog: BotLogEntry[];
    getEligibleSymbols: () => string[];
    sendSignalAlert: (symbol: string, action: string, confidence: number, price?: number, reason?: string, tpSlData?: { entry?: number; tp1?: number; tp2?: number; sl?: number; rr?: number; direction?: string }) => Promise<void>;
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

export interface BotLogEntry {
    timestamp: number;
    symbol?: string;
    type: 'INFO' | 'WARN' | 'ERROR';
    message: string;
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
    const [botLog, setBotLog] = useState<BotLogEntry[]>([]);
    const lastLogRef = React.useRef<{ symbol?: string; type: BotLogEntry['type']; message: string } | null>(null);

    const { prices, selectedSymbol, tpslData, recommendation, tradeDirection, watchlist, multiSymbolSignals, priceHistory, useTvGuardrail, tradingViewConsensus, getTradingViewConsensus } = usePriceContext();

    const logEvent = useCallback((entry: Omit<BotLogEntry, 'timestamp'>) => {
        const last = lastLogRef.current;
        if (last && last.symbol === entry.symbol && last.type === entry.type && last.message === entry.message) {
            return;
        }
        lastLogRef.current = { symbol: entry.symbol, type: entry.type, message: entry.message };
        setBotLog((prev) => [
            ...prev,
            {
                timestamp: Date.now(),
                ...entry
            }
        ]);
    }, []);

    const isStrongEnough = useCallback(
        (action: string, confidence: number): { ok: boolean; threshold: number } => {
            // STRONG BUY/SELL: threshold = minSignalStrength * 10
            // BUY/SELL: slightly higher bar = (minSignalStrength + 1) * 10
            if (action === 'STRONG BUY' || action === 'STRONG SELL') {
                const threshold = minSignalStrength * 10;
                return { ok: confidence >= threshold, threshold };
            }
            if (action === 'BUY' || action === 'SELL') {
                const threshold = (minSignalStrength + 1) * 10;
                return { ok: confidence >= threshold, threshold };
            }
            // NEUTRAL never considered strong
            return { ok: false, threshold: minSignalStrength * 10 };
        },
        [minSignalStrength]
    );

    const getEligibleSymbols = useCallback(() => {
        return watchlist.filter(w => w.autoTradeEnabled).map(w => w.symbol);
    }, [watchlist]);

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


    // Send signal alert to Telegram with full trade setup
    const sendSignalAlert = useCallback(async (
        symbol: string, 
        action: string, 
        confidence: number, 
        price?: number, 
        reason?: string,
        tpSlData?: { entry?: number; tp1?: number; tp2?: number; sl?: number; rr?: number; direction?: string }
    ) => {
        try {
            await fetch(`${TRADING_API_URL}/api/telegram/signal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, action, confidence, price, reason, tpSlData })
            });
        } catch (error) {
            console.error('Failed to send signal alert:', error);
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
                logEvent({
                    type: 'WARN',
                    symbol: undefined,
                    message: '[SINGLE] Kill switch activated – all trading disabled and positions attempted to close'
                });
            }
        } catch (error) {
            console.error('Kill switch failed:', error);
            logEvent({
                type: 'ERROR',
                symbol: undefined,
                message: '[SINGLE] Kill switch failed: ' + (error instanceof Error ? error.message : String(error))
            });
        }
    }, [refreshStatus, logEvent]);

    // Single-symbol auto-trade: run on interval with per-symbol cooldown (avoid flooding Binance)
    const SINGLE_SYMBOL_INTERVAL_MS = 30000;
    const SINGLE_SYMBOL_COOLDOWN_MS = 60000;
    const singleSymbolDataRef = React.useRef({
        recommendation: null as typeof recommendation,
        prices: {} as typeof prices,
        openTrades: [] as TradeRecord[],
        tpslData: null as typeof tpslData,
        riskStatus: null as RiskStatus | null,
        selectedSymbol: '',
        tradeDirection: 'BUY' as 'BUY' | 'SELL',
        useTvGuardrail: false,
        tradingViewConsensus: null as typeof tradingViewConsensus
    });
    const lastOrderAttemptRef = React.useRef<Record<string, number>>({});

    React.useEffect(() => {
        singleSymbolDataRef.current = {
            recommendation,
            prices,
            openTrades,
            tpslData,
            riskStatus,
            selectedSymbol,
            tradeDirection,
            useTvGuardrail,
            tradingViewConsensus
        };
    }, [recommendation, prices, openTrades, tpslData, riskStatus, selectedSymbol, tradeDirection, useTvGuardrail, tradingViewConsensus]);

    useEffect(() => {
        if (!autoTradingEnabled || !isConnected) return;

        const run = () => {
            const d = singleSymbolDataRef.current;
            if (!d.tpslData || !d.riskStatus?.tradingAllowed) {
                if (autoTradingEnabled) {
                    logEvent({ type: 'INFO', symbol: d.selectedSymbol, message: '[SINGLE] Auto-trade skipped: prerequisites not met (connection, TP/SL, or risk)' });
                }
                return;
            }

            let effectiveAction: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
            let effectiveConfidence: number;

            if (d.useTvGuardrail) {
                if (!d.tradingViewConsensus || (d.tradingViewConsensus !== 'STRONG BUY' && d.tradingViewConsensus !== 'STRONG SELL')) {
                    logEvent({
                        type: 'INFO',
                        symbol: d.selectedSymbol,
                        message: d.tradingViewConsensus
                            ? `[SINGLE] Auto-trade skipped: TradingView guardrail on but signal is not Strong Buy/Strong Sell (got ${d.tradingViewConsensus})`
                            : '[SINGLE] Auto-trade skipped: TradingView guardrail on but TradingView signal not set'
                    });
                    return;
                }
                effectiveAction = d.tradingViewConsensus;
                effectiveConfidence = 100;
            } else {
                if (!d.recommendation) return;
                const strength = isStrongEnough(d.recommendation.action, d.recommendation.confidence);
                if (!strength.ok) {
                    logEvent({
                        type: 'INFO',
                        symbol: d.selectedSymbol,
                        message: `[SINGLE] Auto-trade skipped: signal not strong enough (${d.recommendation.action}, ${d.recommendation.confidence}% < ${strength.threshold}%)`
                    });
                    return;
                }
                effectiveAction = d.recommendation.action;
                effectiveConfidence = d.recommendation.confidence;
            }

            if (d.openTrades.some(t => t.symbol === d.selectedSymbol)) {
                logEvent({ type: 'INFO', symbol: d.selectedSymbol, message: '[SINGLE] Auto-trade skipped: already have open position in symbol' });
                return;
            }

            const now = Date.now();
            const lastAttempt = lastOrderAttemptRef.current[d.selectedSymbol] ?? 0;
            if (now - lastAttempt < SINGLE_SYMBOL_COOLDOWN_MS) {
                logEvent({ type: 'INFO', symbol: d.selectedSymbol, message: `[SINGLE] Auto-trade skipped: cooldown (${Math.ceil((SINGLE_SYMBOL_COOLDOWN_MS - (now - lastAttempt)) / 1000)}s remaining)` });
                return;
            }

            const signalSide = effectiveAction.includes('BUY') ? 'BUY' : 'SELL';
            if ((signalSide === 'BUY' && d.tradeDirection !== 'BUY') || (signalSide === 'SELL' && d.tradeDirection !== 'SELL')) {
                logEvent({
                    type: 'INFO',
                    symbol: d.selectedSymbol,
                    message: `[SINGLE] Auto-trade skipped: signal side ${signalSide} does not match selected direction ${d.tradeDirection}`
                });
                return;
            }

            const currentPrice = d.prices[d.selectedSymbol]?.price;
            if (!currentPrice) return;

            const quantity = d.riskStatus!.maxPositionSize / currentPrice;
            lastOrderAttemptRef.current[d.selectedSymbol] = now;

            console.log(`Auto-executing ${signalSide} trade for ${d.selectedSymbol}`);
            logEvent({
                type: 'INFO',
                symbol: d.selectedSymbol,
                message: `[SINGLE] Placing ${signalSide} order, qty ≈ ${quantity.toFixed(6)} based on max position size ${d.riskStatus!.maxPositionSize}`
            });

            sendSignalAlert(
                d.selectedSymbol,
                effectiveAction,
                effectiveConfidence,
                currentPrice,
                `Auto-trade triggered: ${effectiveAction} signal with ${effectiveConfidence}% confidence`,
                d.tpslData ? {
                    entry: currentPrice,
                    tp1: d.tpslData.tp1,
                    tp2: d.tpslData.tp2,
                    sl: d.tpslData.sl,
                    rr: d.tpslData.rr,
                    direction: d.tpslData.direction
                } : undefined
            );

            placeOrder({
                symbol: d.selectedSymbol,
                side: signalSide,
                quantity,
                stopLoss: d.tpslData?.sl,
                takeProfit: d.tpslData?.tp2
            }).catch(error => {
                console.error('Auto-trade failed:', error);
                logEvent({
                    type: 'ERROR',
                    symbol: d.selectedSymbol,
                    message: '[SINGLE] Auto-trade failed: ' + (error instanceof Error ? error.message : String(error))
                });
            });
        };

        run();
        const interval = setInterval(run, SINGLE_SYMBOL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [autoTradingEnabled, isConnected, placeOrder, logEvent, sendSignalAlert, isStrongEnough]);

    // Multi-symbol auto-trade loop using per-symbol signals
    useEffect(() => {
        if (!autoTradingEnabled || !isConnected || !riskStatus?.tradingAllowed) {
            return;
        }

        const eligibleSymbols = getEligibleSymbols();
        if (eligibleSymbols.length === 0) return;

        const run = async () => {
            for (const symbol of eligibleSymbols) {
                if (riskStatus.openTradesCount >= riskStatus.maxOpenTrades) {
                    logEvent({
                        type: 'INFO',
                        symbol,
                        message: '[MULTI] auto-trade skipped: max open trades reached'
                    });
                    break;
                }

                if (openTrades.some(t => t.symbol === symbol)) {
                    logEvent({
                        type: 'INFO',
                        symbol,
                        message: '[MULTI] auto-trade skipped: already have open position in symbol'
                    });
                    continue;
                }

                const price = prices[symbol]?.price;
                const signal = multiSymbolSignals[symbol];
                if (!price) {
                    logEvent({
                        type: 'INFO',
                        symbol,
                        message: '[MULTI] auto-trade skipped: no price yet for symbol'
                    });
                    continue;
                }

                let effectiveAction: string;
                let effectiveConfidence: number;

                if (useTvGuardrail) {
                    const symbolTvConsensus = getTradingViewConsensus(symbol);
                    if (!symbolTvConsensus || (symbolTvConsensus !== 'STRONG BUY' && symbolTvConsensus !== 'STRONG SELL')) {
                        if (symbolTvConsensus) {
                            logEvent({
                                type: 'INFO',
                                symbol,
                                message: `[MULTI] auto-trade skipped: TradingView signal not Strong Buy/Strong Sell (got ${symbolTvConsensus})`
                            });
                        } else {
                            logEvent({
                                type: 'INFO',
                                symbol,
                                message: '[MULTI] auto-trade skipped: TradingView signal not set for symbol'
                            });
                        }
                        continue;
                    }
                    effectiveAction = symbolTvConsensus;
                    effectiveConfidence = 100;
                } else {
                    if (!signal) {
                        logEvent({
                            type: 'INFO',
                            symbol,
                            message: '[MULTI] auto-trade skipped: no signal yet for symbol'
                        });
                        continue;
                    }
                    const strength = isStrongEnough(signal.action, signal.confidence);
                    if (!strength.ok) {
                        logEvent({
                            type: 'INFO',
                            symbol,
                            message: `[MULTI] auto-trade skipped: signal not strong enough (${signal.action}, ${signal.confidence}% < ${strength.threshold}%)`
                        });
                        continue;
                    }
                    effectiveAction = signal.action;
                    effectiveConfidence = signal.confidence;
                }

                const signalSide = effectiveAction.includes('BUY') ? 'BUY' : 'SELL';
                const quantity = (riskStatus.maxPositionSize / (signal?.currentPrice ?? price));

                logEvent({
                    type: 'INFO',
                    symbol,
                    message: `[MULTI] placing ${signalSide} order, qty ≈ ${quantity.toFixed(6)}`
                });

                // Calculate TP/SL for multi-symbol auto-trade
                const isBuy = signalSide === 'BUY';
                const tp1 = isBuy ? price * 1.02 : price * 0.98;
                const tp2 = isBuy ? price * 1.05 : price * 0.95;
                const sl = isBuy ? price * 0.98 : price * 1.02;
                const rr = ((tp2 - price) / Math.abs(price - sl));

                // Send signal alert before placing order
                sendSignalAlert(
                    symbol,
                    effectiveAction,
                    effectiveConfidence,
                    price,
                    `Auto-trade triggered: ${effectiveAction} signal with ${effectiveConfidence}% confidence`,
                    {
                        entry: price,
                        tp1,
                        tp2,
                        sl,
                        rr,
                        direction: isBuy ? 'BUY' : 'SELL'
                    }
                );

                placeOrder({
                    symbol,
                    side: signalSide,
                    quantity,
                    stopLoss: sl,
                    takeProfit: tp2
                }).catch(error => {
                    logEvent({
                        type: 'ERROR',
                        symbol,
                        message: '[MULTI] auto-trade failed: ' + (error instanceof Error ? error.message : String(error))
                    });
                });
            }
        };

        const interval = setInterval(run, 30000);
        return () => clearInterval(interval);
    }, [
        autoTradingEnabled,
        isConnected,
        prices,
        riskStatus,
        openTrades,
        getEligibleSymbols,
        multiSymbolSignals,
        minSignalStrength,
        placeOrder,
        logEvent,
        sendSignalAlert,
        isStrongEnough,
        useTvGuardrail,
        getTradingViewConsensus
    ]);

    // Monitor and send signal alerts for strong signals on a fixed interval (avoid spam on every price/signal update)
    const lastSignalAlertRef = React.useRef<Record<string, { action: string; confidence: number; timestamp: number }>>({});
    const alertDataRef = React.useRef({
        multiSymbolSignals: {} as Record<string, { action: string; confidence: number; currentPrice: number; updatedAt: number }>,
        prices: {} as Record<string, { price: number }>,
        recommendation: null as { action: string; confidence: number } | null,
        selectedSymbol: '',
        tpslData: null as { entry: number; tp1: number; tp2: number; sl: number; rr: number; direction: string } | null,
        getEligibleSymbols: (): string[] => []
    });

    React.useEffect(() => {
        alertDataRef.current = {
            multiSymbolSignals,
            prices,
            recommendation,
            selectedSymbol,
            tpslData,
            getEligibleSymbols
        };
    }, [multiSymbolSignals, prices, recommendation, selectedSymbol, tpslData, getEligibleSymbols]);

    useEffect(() => {
        if (!isConnected) return;

        const MIN_CONFIDENCE_FOR_ALERT = 60;
        const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 min per symbol
        const CHECK_INTERVAL_MS = 5 * 60 * 1000;  // Evaluate at most every 5 min

        const runAlertCheck = () => {
            const { multiSymbolSignals: signals, prices: pricesMap, recommendation: rec, selectedSymbol: selSym, tpslData: tpsl, getEligibleSymbols: getEligible } = alertDataRef.current;
            const eligibleSymbols = getEligible();

            eligibleSymbols.forEach((symbol: string) => {
                const signal = signals[symbol];
                if (!signal || !pricesMap[symbol]?.price) return;

                const { action, confidence } = signal;
                const isStrong = (action === 'STRONG BUY' || action === 'STRONG SELL') || ((action === 'BUY' || action === 'SELL') && confidence >= MIN_CONFIDENCE_FOR_ALERT);
                if (!isStrong) return;

                const last = lastSignalAlertRef.current[symbol];
                const now = Date.now();
                if (last && last.action === action && (now - last.timestamp) < ALERT_COOLDOWN_MS) return;

                const currentPrice = pricesMap[symbol].price;
                const isBuy = action.includes('BUY');
                const tp1 = isBuy ? currentPrice * 1.02 : currentPrice * 0.98;
                const tp2 = isBuy ? currentPrice * 1.05 : currentPrice * 0.95;
                const sl = isBuy ? currentPrice * 0.98 : currentPrice * 1.02;
                const rr = (tp2 - currentPrice) / Math.abs(currentPrice - sl);

                sendSignalAlert(symbol, action, confidence, currentPrice, `Strong signal: ${action} (${confidence}%)`, {
                    entry: currentPrice, tp1, tp2, sl, rr, direction: isBuy ? 'BUY' : 'SELL'
                });
                lastSignalAlertRef.current[symbol] = { action, confidence, timestamp: now };
            });

            if (rec && selSym && pricesMap[selSym]?.price && !eligibleSymbols.includes(selSym)) {
                const { action, confidence } = rec;
                const isStrong = (action === 'STRONG BUY' || action === 'STRONG SELL') || ((action === 'BUY' || action === 'SELL') && confidence >= MIN_CONFIDENCE_FOR_ALERT);
                if (!isStrong) return;

                const last = lastSignalAlertRef.current[selSym];
                const now = Date.now();
                if (last && last.action === action && (now - last.timestamp) < ALERT_COOLDOWN_MS) return;

                sendSignalAlert(selSym, action, confidence, pricesMap[selSym].price, `Strong signal: ${action} (${confidence}%)`, tpsl ? {
                    entry: tpsl.entry, tp1: tpsl.tp1, tp2: tpsl.tp2, sl: tpsl.sl, rr: tpsl.rr, direction: tpsl.direction
                } : undefined);
                lastSignalAlertRef.current[selSym] = { action, confidence, timestamp: now };
            }
        };

        const interval = setInterval(runAlertCheck, CHECK_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [isConnected, sendSignalAlert]);

    // Initial connection check and periodic refresh
    useEffect(() => {
        const runCheck = async () => {
            const connected = await checkConnection();
            if (connected) {
                await refreshStatus(); // Fetch open positions immediately when connected
            }
        };
        runCheck();
        const interval = setInterval(() => {
            runCheck();
        }, 30000);

        return () => clearInterval(interval);
    }, [checkConnection, refreshStatus]);

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
        setMinSignalStrength,
        botLog,
        getEligibleSymbols,
        sendSignalAlert
    };

    return (
        <TradingContext.Provider value={value}>
            {children}
        </TradingContext.Provider>
    );
};
