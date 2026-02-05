import React, { useEffect, useRef, memo } from 'react';
import { usePriceContext } from '../../contexts/PriceContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TechnicalAnalysis: React.FC = () => {
  const { selectedSymbol, timeframe } = usePriceContext();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Standard TV widget loading pattern
    const container = containerRef.current;
    
    // Clear previous content
    container.innerHTML = '';

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      if (!containerRef.current) return;

      const widgetContainer = document.createElement('div');
      widgetContainer.className = "tradingview-widget-container__widget h-full w-full";
      container.appendChild(widgetContainer);

      const script = document.createElement('script');
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js";
      script.async = true;
      script.onerror = () => {
        console.warn('[Technical Analysis] Failed to load TradingView widget');
      };
      script.innerHTML = JSON.stringify({
        "interval": timeframe,
        "width": "100%",
        "isTransparent": true,
        "height": "100%",
        "symbol": `BINANCE:${selectedSymbol}`,
        "showIntervalTabs": true,
        "displayMode": "single",
        "locale": "en",
        "colorTheme": "dark"
      });

      container.appendChild(script);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [selectedSymbol, timeframe]);

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border bg-card min-h-[400px]">
      <CardHeader className="border-b px-4 py-3">
        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Professional Analysis</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 relative">
        <div className="tradingview-widget-container h-full w-full absolute inset-0" ref={containerRef}></div>
      </CardContent>
    </Card>
  );
};

export default memo(TechnicalAnalysis);
