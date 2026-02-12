import React, { useEffect, useRef, memo } from 'react';
import { usePriceContext } from '../../contexts/PriceContext';
import type { TradingViewConsensus } from '../../utils/analysis';
import styles from './TechnicalAnalysis.module.css';

const TV_OPTIONS: { value: '' | TradingViewConsensus; label: string }[] = [
  { value: '', label: 'Not set' },
  { value: 'STRONG BUY', label: 'Strong Buy' },
  { value: 'STRONG SELL', label: 'Strong Sell' }
];

const TechnicalAnalysis: React.FC = () => {
  const {
    selectedSymbol,
    timeframe,
    useTvGuardrail,
    setUseTvGuardrail,
    tradingViewConsensus,
    setTradingViewConsensus
  } = usePriceContext();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !selectedSymbol) return;

    const container = containerRef.current;
    container.innerHTML = '';

    // Replicate TradingView's expected DOM structure as closely as possible
    const tvOuter = document.createElement('div');
    tvOuter.className = 'tradingview-widget-container';

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    tvOuter.appendChild(widgetContainer);

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      interval: timeframe,
      width: '100%',
      isTransparent: true,
      height: 360,
      symbol: `BINANCE:${selectedSymbol}`,
      showIntervalTabs: true,
      displayMode: 'single',
      locale: 'en',
      colorTheme: 'dark',
    });

    tvOuter.appendChild(script);
    container.appendChild(tvOuter);

    return () => {
      container.innerHTML = '';
    };
  }, [selectedSymbol, timeframe]);

  return (
    <div className={`${styles.widget} glass-panel`}>
      <div className={styles.header}>
        <span className={styles.title}>External Consensus (TradingView)</span>
      </div>
      <div className={styles.guardrailRow}>
        <label className={styles.guardrailLabel}>
          <input
            type="checkbox"
            checked={useTvGuardrail}
            onChange={(e) => setUseTvGuardrail(e.target.checked)}
          />
          <span>Use TradingView as guardrail</span>
        </label>
        {useTvGuardrail && (
          <label className={styles.tvSaysLabel}>
            <span>TradingView signal:</span>
            <select
              className={styles.tvSelect}
              value={tradingViewConsensus ?? ''}
              onChange={(e) =>
                setTradingViewConsensus(
                  e.target.value ? (e.target.value as TradingViewConsensus) : null
                )
              }
              title="Set to match the widget (Strong Buy or Strong Sell only)"
            >
              {TV_OPTIONS.map((opt) => (
                <option key={opt.value || 'none'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className={styles.tvHint}>Set to match widget</span>
          </label>
        )}
      </div>
      <div className={styles.container} ref={containerRef}></div>
    </div>
  );
};

export default memo(TechnicalAnalysis);
