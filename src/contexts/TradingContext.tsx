import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { usePriceContext } from './PriceContext';
import { hasTradingViewConflict } from '../utils/analysis';

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

    const { prices, selectedSymbol, tpslData, recommendation, tradeDirection, watchlist, multiSymbolSignals, priceHistory, useTvGuardrail, tradingViewConsensus } = usePriceContext();

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

    // Auto-execute trades based on signals
    useEffect(() => {
        if (!autoTradingEnabled || !isConnected || !tpslData || !riskStatus?.tradingAllowed) {
            if (autoTradingEnabled) {
                logEvent({
                    type: 'INFO',
                    symbol: selectedSymbol,
                    message: '[SINGLE] Auto-trade skipped: prerequisites not met (connection, TP/SL, or risk)'
                });
            }
            return;
        }

        // Check if signal is strong enough (with permissive rule)
        const strength = isStrongEnough(recommendation.action, recommendation.confidence);
        if (!strength.ok) {
            logEvent({
                type: 'INFO',
                symbol: selectedSymbol,
                message: `[SINGLE] Auto-trade skipped: signal not strong enough (${recommendation.action}, ${recommendation.confidence}% < ${strength.threshold}%)`
            });
            return;
        }

        // Check if we already have a position in this symbol
        if (openTrades.some(t => t.symbol === selectedSymbol)) {
            logEvent({
                type: 'INFO',
                symbol: selectedSymbol,
                message: '[SINGLE] Auto-trade skipped: already have open position in symbol'
            });
            return;
        }

        // Determine trade direction from signal
        const signalSide = recommendation.action.includes('BUY') ? 'BUY' : 'SELL';

        // Only trade if signal matches our selected direction
        if ((signalSide === 'BUY' && tradeDirection !== 'BUY') ||
            (signalSide === 'SELL' && tradeDirection !== 'SELL')) {
            logEvent({
                type: 'INFO',
                symbol: selectedSymbol,
                message: `[SINGLE] Auto-trade skipped: signal side ${signalSide} does not match selected direction ${tradeDirection}`
            });
            return;
        }

        // TradingView guardrail: block if AI and TV are strongly opposite
        if (useTvGuardrail && tradingViewConsensus && hasTradingViewConflict(recommendation.action, tradingViewConsensus)) {
            logEvent({
                type: 'INFO',
                symbol: selectedSymbol,
                message: `[SINGLE] Auto-trade skipped: TradingView guardrail (AI ${recommendation.action} vs TV ${tradingViewConsensus})`
            });
            return;
        }

        // Calculate quantity based on max position size
        const currentPrice = prices[selectedSymbol]?.price;
        if (!currentPrice) return;

        const quantity = (riskStatus.maxPositionSize / currentPrice);

        console.log(`Auto-executing ${signalSide} trade for ${selectedSymbol}`);
        logEvent({
            type: 'INFO',
            symbol: selectedSymbol,
            message: `[SINGLE] Placing ${signalSide} order, qty ≈ ${quantity.toFixed(6)} based on max position size ${riskStatus.maxPositionSize}`
        });

        // Send signal alert before placing order (with TP/SL data)
        sendSignalAlert(
            selectedSymbol,
            recommendation.action,
            recommendation.confidence,
            currentPrice,
            `Auto-trade triggered: ${recommendation.action} signal with ${recommendation.confidence}% confidence`,
            tpslData ? {
                entry: currentPrice,
                tp1: tpslData.tp1,
                tp2: tpslData.tp2,
                sl: tpslData.sl,
                rr: tpslData.rr,
                direction: tpslData.direction
            } : undefined
        );

        placeOrder({
            symbol: selectedSymbol,
            side: signalSide,
            quantity,
            stopLoss: tpslData.sl,
            takeProfit: tpslData.tp2
        }).catch(error => {
            console.error('Auto-trade failed:', error);
            logEvent({
                type: 'ERROR',
                symbol: selectedSymbol,
                message: '[SINGLE] Auto-trade failed: ' + (error instanceof Error ? error.message : String(error))
            });
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
        placeOrder,
        logEvent,
        sendSignalAlert,
        isStrongEnough,
        useTvGuardrail,
        tradingViewConsensus
    ]);

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

                // TradingView guardrail: only when this symbol is selected and we have TV consensus
                if (symbol === selectedSymbol && useTvGuardrail && tradingViewConsensus && hasTradingViewConflict(signal.action, tradingViewConsensus)) {
                    logEvent({
                        type: 'INFO',
                        symbol,
                        message: `[MULTI] auto-trade skipped: TradingView guardrail (AI ${signal.action} vs TV ${tradingViewConsensus})`
                    });
                    continue;
                }

                const signalSide = signal.action.includes('BUY') ? 'BUY' : 'SELL';
                const quantity = (riskStatus.maxPositionSize / signal.currentPrice);

                logEvent({
                    type: 'INFO',
                    symbol,
                    message: `[MULTI] placing ${signalSide} order, qty ≈ ${quantity.toFixed(6)}`
                });

                // Calculate TP/SL for multi-symbol auto-trade
                const isBuy = signal.action.includes('BUY');
                const tp1 = isBuy ? price * 1.02 : price * 0.98;
                const tp2 = isBuy ? price * 1.05 : price * 0.95;
                const sl = isBuy ? price * 0.98 : price * 1.02;
                const rr = ((tp2 - price) / Math.abs(price - sl));

                // Send signal alert before placing order
                sendSignalAlert(
                    symbol,
                    signal.action,
                    signal.confidence,
                    price,
                    `Auto-trade triggered: ${signal.action} signal with ${signal.confidence}% confidence`,
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
                    quantity
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
        selectedSymbol,
        useTvGuardrail,
        tradingViewConsensus
    ]);

    // Monitor and send signal alerts for strong signals (even when auto-trade is disabled)
    // Prioritizes multiSymbolSignals over recommendation (selected symbol)
    const lastSignalAlertRef = React.useRef<Record<string, { action: string; confidence: number; timestamp: number }>>({});
    
    useEffect(() => {
        if (!isConnected) return;

        const MIN_CONFIDENCE_FOR_ALERT = 60; // Only alert on signals with 60%+ confidence
        const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown per symbol

        // PRIMARY: Check multi-symbol signals for ALL BOT-enabled coins
        const eligibleSymbols = getEligibleSymbols();
        console.log(`[TradingContext] Monitoring signals for ${eligibleSymbols.length} BOT-enabled symbols:`, eligibleSymbols);
        
        eligibleSymbols.forEach(symbol => {
            const signal = multiSymbolSignals[symbol];
            if (!signal) {
                console.log(`[TradingContext] No signal data for ${symbol} yet`);
                return;
            }
            
            if (!prices[symbol]?.price) {
                console.log(`[TradingContext] No price data for ${symbol}`);
                return;
            }
            
            const { action, confidence } = signal;
            const isStrongSignal = (action === 'STRONG BUY' || action === 'STRONG SELL' || 
                                   (action === 'BUY' || action === 'SELL') && confidence >= MIN_CONFIDENCE_FOR_ALERT);
            
            if (isStrongSignal) {
                const lastAlert = lastSignalAlertRef.current[symbol];
                const now = Date.now();
                
                if (!lastAlert || 
                    lastAlert.action !== action || 
                    (now - lastAlert.timestamp) > ALERT_COOLDOWN) {
                    
                    // Calculate TP/SL for signal alert
                    const currentPrice = prices[symbol].price;
                    const isBuy = action.includes('BUY');
                    const tp1 = isBuy ? currentPrice * 1.02 : currentPrice * 0.98;
                    const tp2 = isBuy ? currentPrice * 1.05 : currentPrice * 0.95;
                    const sl = isBuy ? currentPrice * 0.98 : currentPrice * 1.02;
                    const rr = ((tp2 - currentPrice) / Math.abs(currentPrice - sl));

                    console.log(`[TradingContext] 📤 Sending Telegram alert for ${symbol}: ${action} (${confidence}%)`);

                    sendSignalAlert(
                        symbol,
                        action,
                        confidence,
                        currentPrice,
                        `Strong signal detected: ${action} with ${confidence}% confidence`,
                        {
                            entry: currentPrice,
                            tp1,
                            tp2,
                            sl,
                            rr,
                            direction: isBuy ? 'BUY' : 'SELL'
                        }
                    );
                    
                    lastSignalAlertRef.current[symbol] = { action, confidence, timestamp: now };
                } else {
                    console.log(`[TradingContext] Alert cooldown active for ${symbol}, skipping`);
                }
            } else {
                console.log(`[TradingContext] Signal for ${symbol} not strong enough: ${action} (${confidence}% < ${MIN_CONFIDENCE_FOR_ALERT}%)`);
            }
        });

        // FALLBACK: Also check selected symbol if it's not in the eligible list
        // (This handles the case where selected symbol might not be BOT-enabled)
        if (recommendation && selectedSymbol && prices[selectedSymbol]?.price) {
            // Only send if not already handled by multi-symbol signals above
            if (!eligibleSymbols.includes(selectedSymbol)) {
                const { action, confidence } = recommendation;
                const isStrongSignal = (action === 'STRONG BUY' || action === 'STRONG SELL' || 
                                       (action === 'BUY' || action === 'SELL') && confidence >= MIN_CONFIDENCE_FOR_ALERT);
                
                if (isStrongSignal) {
                    const lastAlert = lastSignalAlertRef.current[selectedSymbol];
                    const now = Date.now();
                    
                    if (!lastAlert || 
                        lastAlert.action !== action || 
                        (now - lastAlert.timestamp) > ALERT_COOLDOWN) {
                        
                        console.log(`[TradingContext] 📤 Sending Telegram alert for selected symbol ${selectedSymbol}: ${action} (${confidence}%)`);
                        
                        sendSignalAlert(
                            selectedSymbol,
                            action,
                            confidence,
                            prices[selectedSymbol].price,
                            `Strong signal detected: ${action} with ${confidence}% confidence`,
                            tpslData ? {
                                entry: tpslData.entry,
                                tp1: tpslData.tp1,
                                tp2: tpslData.tp2,
                                sl: tpslData.sl,
                                rr: tpslData.rr,
                                direction: tpslData.direction
                            } : undefined
                        );
                        
                        lastSignalAlertRef.current[selectedSymbol] = { action, confidence, timestamp: now };
                    }
                }
            }
        }
    }, [isConnected, multiSymbolSignals, prices, getEligibleSymbols, sendSignalAlert, recommendation, selectedSymbol, tpslData]);

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
        }, 5000);

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
