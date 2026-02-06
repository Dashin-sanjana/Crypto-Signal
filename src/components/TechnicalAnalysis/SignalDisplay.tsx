import React from 'react';
import { usePriceContext } from '../../contexts/PriceContext';
import { formatPrice } from '../../utils/helpers';
import styles from './SignalDisplay.module.css';

const SignalDisplay: React.FC = () => {
  const { 
    tpslData,
    selectedSymbol, 
    tradeDirection,
    setTradeDirection,
    recommendation,
    indicatorStatus
  } = usePriceContext();

  if (!tpslData || tpslData.symbol !== selectedSymbol) {
    return (
      <div className={styles.signalDisplay}>
        <div className={styles.loading}>Analyzing Market Volatility...</div>
      </div>
    );
  }

  const { entry, tp1, tp2, sl, rr } = tpslData;
  const isBuy = tradeDirection === 'BUY';
  const tp1Percent = entry > 0 ? Math.abs((tp1 - entry) / entry) * 100 : 0;
  const tp2Percent = entry > 0 ? Math.abs((tp2 - entry) / entry) * 100 : 0;
  const slPercent = entry > 0 ? Math.abs((entry - sl) / entry) * 100 : 0;

  return (
    <div className={styles.signalDisplay}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span>🎯</span> {selectedSymbol} Setup
        </div>
        <div className={styles.statusWrapper}>
          <div className={`${styles.liveIndicator} ${isBuy ? styles.indicatorLong : styles.indicatorShort}`}></div>
          <div className={styles.badge} style={{ 
            background: isBuy ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 68, 68, 0.1)',
            color: isBuy ? 'var(--green-primary)' : 'var(--red-primary)',
            borderColor: isBuy ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 68, 68, 0.2)'
          }}>
            {tradeDirection} SIGNAL
          </div>
          <div className={styles.fibBadge}>EW VALIDATION: {recommendation.ewScore}/5</div>
        </div>
      </div>

      <div className={styles.aiRecommendation}>
        <div className={styles.recHeader}>
          <span className={styles.aiLabel}>AI PREDICTION</span>
          <span className={`${styles.recAction} ${styles[recommendation.action.replace(' ', '')]}`}>
            {recommendation.action}
          </span>
          <div className={styles.confidenceBar}>
            <div className={styles.confidenceFill} style={{ width: `${recommendation.confidence}%` }}></div>
            <span className={styles.confidenceValue}>{recommendation.confidence}% CONFIRMATION</span>
          </div>
        </div>
        <div className={styles.indicatorGrid}>
          {Object.entries(indicatorStatus).map(([name, status]) => (
            <div key={name} className={`${styles.indicatorTag} ${styles[status]}`}>
              {name}: {status.toUpperCase()}
            </div>
          ))}
        </div>
        <div className={styles.disclaimer}>
          *Custom AI Logic (EW + Indicators). May differ from external TradingView signals.
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.predictionBadge}>
          <span>⏱️</span> 5M PREDICTION
        </div>

        <div className={styles.directionToggle}>
          <button 
            className={`${styles.dirBtn} ${isBuy ? styles.buyActive : ''}`}
            onClick={() => setTradeDirection('BUY')}
          >
            BUY
          </button>
          <button 
            className={`${styles.dirBtn} ${!isBuy ? styles.sellActive : ''}`}
            onClick={() => setTradeDirection('SELL')}
          >
            SELL
          </button>
        </div>
      </div>

      <div className={styles.levels}>
        <div className={`${styles.levelRow} ${styles.entry}`}>
          <span className={styles.label}>Entry</span>
          <span className={styles.value}>${formatPrice(entry || 0)}</span>
          <span className={styles.markerBadge}>MARKET</span>
        </div>
        
        <div className={`${styles.levelRow} ${styles.tp1}`}>
          <span className={styles.label}>Fib 1.618 Target</span>
          <span className={styles.value} style={{ color: isBuy ? '#10b981' : '#ff4444' }}>
            ${formatPrice(tp1 || 0)}
          </span>
          <span className={styles.percentage} style={{ color: isBuy ? '#10b981' : '#ff4444' }}>
            {isBuy ? '+' : '-'}{tp1Percent.toFixed(2)}%
          </span>
        </div>

        <div className={`${styles.levelRow} ${styles.tp2}`}>
          <span className={styles.label}>Fib 2.618 Target</span>
          <span className={styles.value} style={{ color: isBuy ? '#00ff88' : '#ff6b6b' }}>
            ${formatPrice(tp2 || 0)}
          </span>
          <span className={styles.percentage} style={{ color: isBuy ? '#00ff88' : '#ff6b6b' }}>
            {isBuy ? '+' : '-'}{tp2Percent.toFixed(2)}%
          </span>
        </div>

        <div className={`${styles.levelRow} ${styles.sl}`}>
          <span className={styles.label}>Fib 0.786 Target</span>
          <span className={styles.value} style={{ color: isBuy ? '#10b981' : '#00ff88' }}>
            ${formatPrice(sl || 0)}
          </span>
          <span className={styles.percentage} style={{ color: isBuy ? '#10b981' : '#00ff88' }}>
            {isBuy ? '+' : '-'}{slPercent.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.rrCard}>
          <span className={styles.rrLabel}>R/R Ratio</span>
          <span className={styles.rrValue}>
            1:{typeof rr === 'number' ? rr.toFixed(2) : '0.00'}
          </span>
        </div>
        
        <button 
          className={`${styles.actionBtn} ${isBuy ? styles.btnBuy : styles.btnSell}`}
          onClick={() => {
            // Visual feedback for live entry
            const btn = document.activeElement as HTMLElement;
            if (btn) {
              const originalText = btn.innerHTML;
              btn.innerHTML = '✅ ENTRY SENT';
              btn.style.filter = 'brightness(1.5)';
              setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.filter = '';
              }, 1500);
            }
          }}
        >
          {isBuy ? (
            <div className={styles.btnContent}>
              <span>🚀 BUY NOW</span>
              <span className={styles.btnSubtext}>TP: ${formatPrice(sl)} | TP: ${formatPrice(tp2)}</span>
            </div>
          ) : (
            <div className={styles.btnContent}>
              <span>📉 SELL NOW</span>
              <span className={styles.btnSubtext}>TP: ${formatPrice(sl)} | TP: ${formatPrice(tp2)}</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};

export default SignalDisplay;
