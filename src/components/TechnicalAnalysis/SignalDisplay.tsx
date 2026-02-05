import React, { useState } from 'react';
import { usePriceContext } from '../../contexts/PriceContext';
import { useTradingContext } from '../../contexts/TradingContext';
import { useSignalContext } from '../../contexts/SignalContext';
import { formatPrice } from '../../utils/helpers';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Clock, Target, TrendingUp, TrendingDown, Activity, PlayCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { verifySignal } from '../../services/signalVerification';
import { toastSuccess, toastError, toastWarning } from '../../utils/toastHelper';

const SignalDisplay: React.FC = () => {
  const {
    tpslData,
    selectedSymbol,
    tradeDirection,
    setTradeDirection
  } = usePriceContext();
  
  const { executeTrade, isConnected, autoTradingEnabled } = useTradingContext();
  const { addSignal, activeSignals } = useSignalContext();
  const [isExecuting, setIsExecuting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Calculate isBuy early (before using it)
  const isBuy = tradeDirection === 'BUY';

  // Show loading state if TP/SL data not ready
  if (!tpslData || tpslData.symbol !== selectedSymbol) {
    return (
      <Card className="flex flex-col justify-center items-center p-8 h-[750px] border-border bg-card">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Activity className="h-8 w-8 animate-pulse" />
          <div className="text-center space-y-1">
            <span className="text-sm font-medium block">Analyzing Market Volatility...</span>
            <span className="text-xs text-muted-foreground block">
              {selectedSymbol} • {tradeDirection} • Waiting for price data
            </span>
          </div>
        </div>
      </Card>
    );
  }

  const { entry, tp1, tp2, sl, rr } = tpslData;
  
  // Check if there's an active signal for this symbol/direction
  const activeSignal = activeSignals.find(
    s => s.symbol === selectedSymbol && 
    ((isBuy && s.type === 'LONG') || (!isBuy && s.type === 'SHORT'))
  );
  const tp1Percent = entry > 0 ? Math.abs((tp1 - entry) / entry) * 100 : 0;
  const tp2Percent = entry > 0 ? Math.abs((tp2 - entry) / entry) * 100 : 0;
  const slPercent = entry > 0 ? Math.abs((entry - sl) / entry) * 100 : 0;

  return (
    <Card className="flex flex-col border-border bg-card overflow-hidden h-[750px]">
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold">{selectedSymbol} Setup</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("h-2.5 w-2.5 rounded-full animate-pulse shadow-[0_0_10px_currentColor]", isBuy ? "bg-green-500 text-green-500" : "bg-red-500 text-red-500")} />
          <Badge variant="outline" className={cn("font-bold border", isBuy ? "text-green-500 border-green-500/30 bg-green-500/10" : "text-red-500 border-red-500/30 bg-red-500/10")}>
            {tradeDirection} SIGNAL
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-background/50">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 py-1 px-2.5 text-xs font-bold tracking-wider">
              <Clock className="h-3.5 w-3.5" /> 5M PREDICTION
            </Badge>
            {activeSignal && autoTradingEnabled && (
              <Badge variant="default" className="gap-1.5 py-1 px-2.5 text-xs font-bold bg-green-600">
                🤖 AUTO-TRADING ACTIVE (Strength: {activeSignal.strength}/10)
              </Badge>
            )}
          </div>

          <div className="flex bg-muted/50 p-1 rounded-md">
            <button
              onClick={() => setTradeDirection('BUY')}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-sm transition-all flex items-center gap-1.5",
                isBuy ? "bg-green-500 text-white shadow-md shadow-green-900/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <TrendingUp className="h-3 w-3" /> BUY
            </button>
            <button
              onClick={() => setTradeDirection('SELL')}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-sm transition-all flex items-center gap-1.5",
                !isBuy ? "bg-red-500 text-white shadow-md shadow-red-900/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <TrendingDown className="h-3 w-3" /> SELL
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {/* Entry */}
          <div className="flex flex-col gap-1 relative pl-3.5">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-foreground rounded-full" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Entry</span>
            <span className="text-lg font-bold tracking-tight">${formatPrice(entry || 0)}</span>
            <Badge variant="outline" className="w-fit text-[9px] h-4 px-1 py-0">MARKET</Badge>
          </div>

          {/* TP1 */}
          <div className="flex flex-col gap-1 relative pl-3.5">
            <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-full", isBuy ? "bg-green-500" : "bg-red-500")} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Target 1</span>
            <span className={cn("text-lg font-bold tracking-tight", isBuy ? "text-green-500" : "text-red-500")}>
              ${formatPrice(tp1 || 0)}
            </span>
            <span className={cn("text-[10px] font-bold", isBuy ? "text-green-500" : "text-red-500")}>
              {isBuy ? '+' : '-'}{tp1Percent.toFixed(2)}%
            </span>
          </div>

          {/* TP2 */}
          <div className="flex flex-col gap-1 relative pl-3.5">
            <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-full", isBuy ? "bg-[rgb(0,255,136)]" : "bg-red-400")} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Target 2</span>
            <span className={cn("text-lg font-bold tracking-tight", isBuy ? "text-[rgb(0,255,136)]" : "text-red-400")}>
              ${formatPrice(tp2 || 0)}
            </span>
            <span className={cn("text-[10px] font-bold", isBuy ? "text-[rgb(0,255,136)]" : "text-red-400")}>
              {isBuy ? '+' : '-'}{tp2Percent.toFixed(2)}%
            </span>
          </div>

          {/* SL */}
          <div className="flex flex-col gap-1 relative pl-3.5">
            <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-full", isBuy ? "bg-red-500" : "bg-green-500")} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Stop Loss</span>
            <span className={cn("text-lg font-bold tracking-tight", isBuy ? "text-red-500" : "text-green-500")}>
              ${formatPrice(sl || 0)}
            </span>
            <span className={cn("text-[10px] font-bold", isBuy ? "text-red-500" : "text-green-500")}>
              {isBuy ? '-' : '+'}{slPercent.toFixed(2)}%
            </span>
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-4 pl-4 border-l-2 border-muted">
          <div className="flex flex-col min-w-[80px]">
            <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">R/R Ratio</span>
            <span className="text-xl font-black text-yellow-500">1:{typeof rr === 'number' ? rr.toFixed(2) : '0.00'}</span>
          </div>

          <Button
            className={cn(
              "flex-1 font-bold text-base shadow-lg transition-all hover:-translate-y-0.5",
              isBuy ? "bg-green-600 hover:bg-green-500 shadow-green-900/20" : "bg-red-600 hover:bg-red-500 shadow-red-900/20",
              (isExecuting || isVerifying) && "opacity-50 cursor-not-allowed"
            )}
            disabled={isExecuting || isVerifying || !isConnected}
            onClick={async () => {
              if (!tpslData || !isConnected) {
                toastError('Backend not connected or no signal data available');
                return;
              }

              setIsVerifying(true);
              
              try {
                // 1. Verify signal
                const verification = await verifySignal(
                  selectedSymbol,
                  isBuy ? 'LONG' : 'SHORT',
                  entry
                );

                if (!verification.verified) {
                  toastWarning(`Signal verification failed: ${verification.reason}`);
                  setIsVerifying(false);
                  return;
                }

                setIsVerifying(false);
                setIsExecuting(true);

                // 2. Create signal object
                const signal = {
                  id: `technical_${selectedSymbol}_${Date.now()}`,
                  type: (isBuy ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
                  symbol: selectedSymbol,
                  entry: entry,
                  stopLoss: sl,
                  takeProfit: tp2, // Use TP2 as main target
                  strength: Math.round(verification.confidence * 10), // Convert to 0-10 scale
                  timestamp: Date.now(),
                  expiresAt: Date.now() + (15 * 60 * 1000),
                  status: 'active' as const,
                  confluence: {
                    technicalAnalysis: true,
                    verified: verification.verified
                  }
                };

                // 3. Add to signal context
                addSignal(signal);

                // 4. Execute trade
                const success = await executeTrade(signal);

                if (success) {
                  // Use notification manager to throttle
                  const tradeKey = `trade_${selectedSymbol}_manual`;
                  toastSuccess(
                    `✅ Trade executed: ${selectedSymbol} ${signal.type} @ $${entry.toFixed(2)}`,
                    tradeKey,
                    { isManual: true, isImportant: true }
                  );
                } else {
                  // Always show errors
                  toastError(`❌ Trade execution failed for ${selectedSymbol}`);
                }
              } catch (error: any) {
                console.error('Error executing trade:', error);
                toastError(`Failed to execute trade: ${error.message || 'Unknown error'}`);
              } finally {
                setIsExecuting(false);
                setIsVerifying(false);
              }
            }}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                VERIFYING...
              </>
            ) : isExecuting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                EXECUTING...
              </>
            ) : isBuy ? (
              <>
                <PlayCircle className="mr-2 h-5 w-5" /> BUY NOW
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-5 w-5" /> SELL NOW
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SignalDisplay;
