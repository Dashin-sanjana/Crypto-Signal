import { usePriceContext } from '../../contexts/PriceContext';
import { formatPrice, formatPercentage } from '../../utils/helpers';
import CoinSearch from './CoinSearch';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const Watchlist = () => {
  const { prices, selectedSymbol, setSelectedSymbol, watchlist } = usePriceContext();

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border bg-card">
      <CardHeader className="border-b px-4 py-3">
        <CardTitle className="text-base font-bold">Watchlist</CardTitle>
      </CardHeader>

      <div className="border-b bg-muted/20">
        <CoinSearch />
      </div>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex flex-col p-2 gap-1">
            {watchlist.map(({ symbol, name, ticker }) => {
              const priceData = prices[symbol];
              const isSelected = symbol === selectedSymbol;
              const change = priceData?.change24h || 0;
              const isPositive = change >= 0;

              return (
                <button
                  key={symbol}
                  className={cn(
                    "flex flex-col gap-1 rounded-md border border-transparent px-3 py-2 text-left transition-all hover:bg-muted/50 focus:outline-none",
                    isSelected && "bg-muted/50 border-border shadow-sm ring-1 ring-ring/20"
                  )}
                  onClick={() => setSelectedSymbol(symbol)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm tracking-wide">{ticker}</span>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        isPositive ? "text-green-500" : "text-red-500"
                      )}
                    >
                      {formatPercentage(change)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span className="truncate max-w-[100px]">{name}</span>
                    <span className="font-mono font-medium text-foreground">
                      ${priceData ? formatPrice(priceData.price) : '---'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default Watchlist;
