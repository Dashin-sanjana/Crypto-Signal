import { useEffect, useRef } from 'react';
import { usePriceContext } from '../../contexts/PriceContext';
import { TIMEFRAMES } from '../../utils/constants';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    TradingView: any;
  }
}

const TradingChart = () => {
  const { selectedSymbol, timeframe, setTimeframe } = usePriceContext();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (typeof window.TradingView !== 'undefined' && containerRef.current) {
        new window.TradingView.widget({
          "autosize": true,
          "symbol": `BINANCE:${selectedSymbol}`,
          "interval": timeframe === '1h' ? '60' : timeframe === '15m' ? '15' : '1',
          "timezone": "Etc/UTC",
          "theme": "dark",
          "style": "2", // STYLE_HEIKIN_ASHI
          "locale": "en",
          "toolbar_bg": "#f1f3f6",
          "enable_publishing": false,
          "allow_symbol_change": false,
          "container_id": "tradingview_advanced_chart",
          "hide_side_toolbar": false, // Allow drawing
          "save_image": false,
          "studies": [
            "MASimple@tv-basicstudies"
          ],
          "show_popup_button": true,
          "popup_width": "1000",
          "popup_height": "650"
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [selectedSymbol, timeframe]);

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3 space-y-0">
        <CardTitle className="text-lg font-bold">{selectedSymbol}</CardTitle>

        <div className="flex bg-muted rounded-md p-0.5">
          {TIMEFRAMES.map(({ label, value }) => (
            <button
              key={value}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-sm transition-all",
                timeframe === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTimeframe(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 relative min-h-[400px]">
        <div id="tradingview_advanced_chart" ref={containerRef} className="h-full w-full absolute inset-0" />
      </CardContent>
    </Card>
  );
};

export default TradingChart;
