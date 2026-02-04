import { useEffect, useRef } from 'react';
import { usePriceContext } from '../../contexts/PriceContext';
import { TIMEFRAMES } from '../../utils/constants';
import styles from './TradingChart.module.css';

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
    <div className={`${styles.chartContainer} glass-panel`}>
      <div className={styles.header}>
        <h3 className={styles.title}>{selectedSymbol}</h3>
        
        <div className={styles.timeframes}>
          {TIMEFRAMES.map(({ label, value }) => (
            <button
              key={value}
              className={`${styles.timeframeBtn} ${timeframe === value ? styles.active : ''}`}
              onClick={() => setTimeframe(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      
      <div id="tradingview_advanced_chart" ref={containerRef} className={styles.chart} />
    </div>
  );
};

export default TradingChart;
