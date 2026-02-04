import React from 'react';
import { usePriceContext } from '../../contexts/PriceContext';
import { formatPrice } from '../../utils/helpers';
import styles from './SignalDisplay.module.css';

const SignalDisplay: React.FC = () => {
  const { 
    tpslData, 
    selectedSymbol, 
    setupTimeframe, 
    setSetupTimeframe
  } = usePriceContext();

  if (!tpslData || tpslData.symbol !== selectedSymbol) {
    return (
      <div className={styles.signalDisplay}>
        <div className={styles.loading}>Analyzing Market Volatility...</div>
      </div>
    );
  }

  const { entry, tp1, tp2, sl, rr } = tpslData;
  const tp1Percent = Math.abs((tp1 - entry) / entry) * 100;
  const tp2Percent = Math.abs((tp2 - entry) / entry) * 100;
  const slPercent = Math.abs((entry - sl) / entry) * 100;

  return (
    <div className={styles.signalDisplay}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span>🎯</span> Live Setup
        </div>
        <div className={styles.statusWrapper}>
          <div className={styles.liveIndicator}></div>
          <div className={styles.badge}>Live Entry</div>
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.timeframeToggle}>
          {['1m', '5m'].map((tf) => (
            <button
              key={tf}
              className={`${styles.toggleBtn} ${setupTimeframe === tf ? styles.active : ''}`}
              onClick={() => setSetupTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.levels}>
        {/* ... Entry remains same ... */}
        <div className={`${styles.levelRow} ${styles.entry}`}>
          <div className={styles.levelInfo}>
            <span className={styles.label}>Market Entry</span>
            <span className={styles.value}>${formatPrice(entry)}</span>
          </div>
          <span className={styles.badge}>Current</span>
        </div>
        
        <div className={`${styles.levelRow} ${styles.tp1}`}>
          <div className={styles.levelInfo}>
            <span className={styles.label}>Take Profit 1 (Safe)</span>
            <span className={styles.value}>${formatPrice(tp1)}</span>
          </div>
          <span className={styles.percentage}>+{tp1Percent.toFixed(2)}%</span>
        </div>

        <div className={`${styles.levelRow} ${styles.tp2}`}>
          <div className={styles.levelInfo}>
            <span className={styles.label}>Take Profit 2 (Target)</span>
            <span className={styles.value}>${formatPrice(tp2)}</span>
          </div>
          <span className={styles.percentage}>+{tp2Percent.toFixed(2)}%</span>
        </div>

        <div className={`${styles.levelRow} ${styles.sl}`}>
          <div className={styles.levelInfo}>
            <span className={styles.label}>Stop Loss Protection</span>
            <span className={styles.value}>${sl ? formatPrice(sl) : '0.00'}</span>
          </div>
          <span className={styles.percentage}>-{slPercent.toFixed(2)}%</span>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.rrCard}>
          <span className={styles.rrLabel}>Risk : Reward Ratio</span>
          <span className={styles.rrValue}>1:{rr.toFixed(2)}</span>
        </div>
        
        <button className={styles.actionBtn}>
          🚀 Execute Trade
        </button>
      </div>
    </div>
  );
};

export default SignalDisplay;
