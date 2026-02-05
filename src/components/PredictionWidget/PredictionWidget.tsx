import React, { useState, useEffect } from 'react';
import { usePriceContext } from '../../contexts/PriceContext';
import { predictShortTerm } from '../../utils/analysis';
import { WATCHLIST } from '../../utils/constants';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const PredictionWidget: React.FC = () => {
  const { fetchKlineData } = usePriceContext();
  const [predictions, setPredictions] = useState<Record<string, any>>({});
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [activeTimeframe, setActiveTimeframe] = useState<'1m' | '5m'>('5m');

  useEffect(() => {
    let mounted = true;

    const runPredictions = async () => {
      const results: Record<string, any> = {};

      // Parallel fetch for speed
      await Promise.all(WATCHLIST.map(async (coin) => {
        try {
          const candles = await fetchKlineData(coin.symbol, activeTimeframe, 50);
          if (candles.length >= 20) {
            results[coin.symbol] = predictShortTerm(candles);
          }
        } catch (e) {
          console.error(`Failed to predict for ${coin.symbol}`, e);
        }
      }));

      if (mounted) {
        setPredictions(results);
        setLastUpdated(Date.now());
      }
    };

    runPredictions();
    const interval = setInterval(runPredictions, activeTimeframe === '1m' ? 30000 : 60000); // Faster update for 1m

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchKlineData, activeTimeframe]);

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3 space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base font-bold">Market Scanner</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-md p-0.5">
              {(['1m', '5m'] as const).map(tf => (
                <button
                  key={tf}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-bold rounded-sm transition-all",
                    activeTimeframe === tf
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">
              Updated: {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
        <Badge variant="destructive" className="animate-pulse text-[10px] px-1.5 py-0">LIVE</Badge>
      </CardHeader>

      <div className="grid grid-cols-[1fr_1.5fr_1fr] px-4 py-2 border-b bg-muted/20 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
        <span>Asset</span>
        <span className="text-center">Signal</span>
        <span className="text-right">Prob</span>
      </div>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex flex-col p-2 space-y-1">
            {WATCHLIST.map((coin) => {
              const pred = predictions[coin.symbol];
              if (!pred) return (
                <div key={coin.symbol} className="grid grid-cols-[1fr_1.5fr_1fr] items-center px-3 py-2 rounded-md hover:bg-muted/50 transition-colors">
                  <span className="font-bold text-sm">{coin.ticker}</span>
                  <span className="text-xs text-muted-foreground text-right col-span-2">Loading...</span>
                </div>
              );

              return (
                <div key={coin.symbol} className="grid grid-cols-[1fr_1.5fr_1fr] items-center px-3 py-2 rounded-md bg-muted/20 hover:bg-muted/50 transition-colors">
                  <span className="font-bold text-sm tracking-wide">{coin.ticker}</span>
                  <span className={cn(
                    "text-xs font-extrabold text-center",
                    pred.direction === 'UP' ? "text-green-500" : pred.direction === 'DOWN' ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {pred.direction === 'UP' ? '✅ BUY' : pred.direction === 'DOWN' ? '🚨 SELL' : '⏸ WAIT'}
                  </span>
                  <span className={cn(
                    "text-xs font-semibold text-right",
                    pred.probability === 'HIGH' ? "text-green-500" : pred.probability === 'MEDIUM' ? "text-yellow-500" : "text-muted-foreground"
                  )}>
                    {pred.probability}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default PredictionWidget;
