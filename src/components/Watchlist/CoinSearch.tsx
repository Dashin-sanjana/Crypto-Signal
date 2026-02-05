import React, { useState, useRef, useEffect } from 'react';
import { usePriceContext } from '../../contexts/PriceContext';
import { formatPrice } from '../../utils/helpers';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";

const CoinSearch: React.FC = () => {
  const { allSymbols, addToWatchlist, prices } = usePriceContext();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredSymbols = query.length > 1
    ? allSymbols.filter(s =>
      s.symbol.toLowerCase().includes(query.toLowerCase()) ||
      s.baseAsset.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10)
    : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (symbolInfo: any) => {
    addToWatchlist(symbolInfo);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative z-50 p-4" ref={containerRef}>
      <div className="relative flex items-center transition-transform focus-within:scale-[1.02]">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground opacity-50" />
        <Input
          type="text"
          className="pl-9 bg-muted/20 border-border/50 focus:bg-background/80"
          placeholder="Search all CMC coins..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
      </div>

      {isOpen && filteredSymbols.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 mx-4 z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2">
          <ScrollArea className="h-[300px]">
            <div className="p-1">
              {filteredSymbols.map((item) => {
                const price = prices[item.symbol]?.price;
                return (
                  <button
                    key={item.symbol}
                    className="relative flex w-full cursor-default select-none items-center justify-between rounded-sm px-2 py-2 outline-none hover:bg-accent hover:text-accent-foreground"
                    onClick={() => handleSelect(item)}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-bold text-sm">{item.baseAsset}</span>
                      <span className="text-xs text-muted-foreground font-medium">{item.symbol}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-sm font-bold ${price ? 'text-green-500' : ''}`}>
                        {price ? `$${formatPrice(price)}` : '---'}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-500 bg-green-500/5">
                        USDT
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default CoinSearch;
