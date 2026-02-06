import React, { useEffect, useRef, memo } from 'react';
import { usePriceContext } from '../../contexts/PriceContext';
import styles from './TechnicalAnalysis.module.css';

const TechnicalAnalysis: React.FC = () => {
  const { selectedSymbol, timeframe } = usePriceContext();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Standard TV widget loading pattern
    const container = containerRef.current;
    container.innerHTML = '';
    
    const widgetContainer = document.createElement('div');
    widgetContainer.className = "tradingview-widget-container__widget";
    container.appendChild(widgetContainer);

    const script = document.createElement('script');
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js";
    script.async = true;
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
  }, [selectedSymbol, timeframe]);

  return (
    <div className={`${styles.widget} glass-panel`}>
      <div className={styles.header}>
        <span className={styles.title}>External Consensus (TradingView)</span>
      </div>
      <div className={styles.container} ref={containerRef}></div>
    </div>
  );
};

export default memo(TechnicalAnalysis);
