import React from 'react';
import { useTradingContext } from '../../contexts/TradingContext';
import { formatPrice, formatPercentage } from '../../utils/helpers';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Positions: React.FC = () => {
  const {
    positions,
    positionsCount,
    balance,
    totalProfit,
    realizedProfit,
    unrealizedProfit,
    dailyPnl,
    closePosition,
    isLoading,
  } = useTradingContext();

  const handleClosePosition = async (symbol: string) => {
    await closePosition(symbol);
  };

  if (positionsCount === 0) {
    return (
      <Card className="flex h-full flex-col border-border bg-card overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3 space-y-0">
          <CardTitle className="text-base font-bold">Open Positions</CardTitle>
          <Badge variant="secondary" className="font-mono">0</Badge>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-8 text-muted-foreground text-sm font-medium">
          No open positions
        </CardContent>
      </Card>
    );
  }

  const totalExposure = positions.reduce((sum, pos) => {
    return sum + (pos.entry_price * pos.quantity);
  }, 0);

  return (
    <Card className="flex h-full flex-col border-border bg-card overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3 space-y-0">
        <CardTitle className="text-base font-bold">Open Positions</CardTitle>
        <Badge variant="secondary" className="font-mono">{positionsCount}</Badge>
      </CardHeader>

      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/20 border-b">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Exposure</span>
          <span className="text-lg font-bold tracking-tight">${formatPrice(totalExposure)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Balance</span>
          <span className="text-lg font-bold tracking-tight">${formatPrice(balance)}</span>
        </div>
      </div>

      {/* Profit Summary */}
      <div className="grid grid-cols-2 gap-3 p-4 bg-gradient-to-br from-muted/30 to-muted/10 border-b">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Profit</span>
          <span className={cn("text-xl font-bold tracking-tight", totalProfit >= 0 ? "text-green-500" : "text-red-500")}>
            {totalProfit >= 0 ? '+' : ''}${formatPrice(totalProfit)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Daily P&L</span>
          <span className={cn("text-xl font-bold tracking-tight", dailyPnl >= 0 ? "text-green-500" : "text-red-500")}>
            {dailyPnl >= 0 ? '+' : ''}${formatPrice(dailyPnl)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Realized</span>
          <span className={cn("text-lg font-bold tracking-tight", realizedProfit >= 0 ? "text-green-500" : "text-red-500")}>
            {realizedProfit >= 0 ? '+' : ''}${formatPrice(realizedProfit)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Unrealized</span>
          <span className={cn("text-lg font-bold tracking-tight", unrealizedProfit >= 0 ? "text-green-500" : "text-red-500")}>
            {unrealizedProfit >= 0 ? '+' : ''}${formatPrice(unrealizedProfit)}
          </span>
        </div>
      </div>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-[400px]">
          <div className="flex flex-col p-4 gap-3">
            {positions.map((position) => {
              const isLong = position.side === 'LONG';
              const pnlColor = position.pnl >= 0 ? "text-green-500" : "text-red-500";

              return (
                <div key={position.symbol} className="rounded-lg border bg-card hover:bg-muted/50 transition-colors overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Badge variant={isLong ? "default" : "destructive"} className={cn("text-[10px] px-1.5 py-0", isLong ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600")}>
                        {position.side}
                      </Badge>
                      <span className="font-bold text-sm tracking-wide">{position.symbol}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive transition-colors rounded-full"
                      onClick={() => handleClosePosition(position.symbol)}
                      disabled={isLoading}
                      title="Close Position"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="p-3 grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">Entry</span>
                      <span className="font-mono font-medium">${formatPrice(position.entry_price)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">Current</span>
                      <span className="font-mono font-medium">${formatPrice(position.current_price)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">Size</span>
                      <span className="font-mono font-medium">{position.quantity.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">SL</span>
                      <span className="font-mono font-medium text-red-500/80">${formatPrice(position.stop_loss)}</span>
                    </div>
                  </div>

                  <div className="px-3 py-2 bg-muted/30 border-t flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Unrealized P&L</span>
                    <span className={cn("font-bold font-mono tracking-tight", pnlColor)}>
                      ${formatPrice(position.pnl)} ({formatPercentage(position.pnl_percent)})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default Positions;
