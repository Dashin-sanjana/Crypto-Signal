import React from 'react';
import { useSignalContext, Signal } from '../../contexts/SignalContext';
import { formatPrice, calculateRiskReward, getTimeAgo, copyToClipboard } from '../../utils/helpers';
import ConfluenceBreakdown from '../ConfluenceBreakdown/ConfluenceBreakdown';
import styles from './SignalCard.module.css';

interface SignalCardProps {
  signal: Signal;
}

const SignalCard: React.FC<SignalCardProps> = ({ signal }) => {
  const { removeSignal } = useSignalContext();
  const {
    id,
    type,
    symbol,
    entry,
    stopLoss,
    takeProfit,
    strength,
    timestamp,
    expiresAt,
    confluence
  } = signal;

  const riskReward = calculateRiskReward(entry, stopLoss, takeProfit);
  const timeRemaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000 / 60));

  const handleCopy = () => {
    const text = `${type} ${symbol}\nEntry: $${formatPrice(entry)}\nSL: $${formatPrice(stopLoss)}\nTP: $${formatPrice(takeProfit)}\nR:R ${riskReward.toFixed(2)}`;
    copyToClipboard(text);
  };

  return (
    <div className={`${styles.card} ${type === 'LONG' ? styles.long : styles.short}`}>
      <div className={styles.header}>
        <div className={styles.type}>{type}</div>
        <div className={styles.symbol}>{symbol}</div>
        <button className={styles.closeBtn} onClick={() => removeSignal(id)}>
          ✕
        </button>
      </div>

      <div className={styles.prices}>
        <div className={styles.priceItem}>
          <span className={styles.label}>Entry</span>
          <span className={styles.value}>${formatPrice(entry)}</span>
        </div>
        <div className={styles.priceItem}>
          <span className={styles.label}>Stop Loss</span>
          <span className={styles.value}>${formatPrice(stopLoss)}</span>
        </div>
        <div className={styles.priceItem}>
          <span className={styles.label}>Take Profit</span>
          <span className={styles.value}>${formatPrice(takeProfit)}</span>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>R:R</span>
          <span className={styles.statValue}>1:{riskReward.toFixed(2)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Strength</span>
          <span className={styles.statValue}>{strength}/10</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Expires</span>
          <span className={styles.statValue}>{timeRemaining}m</span>
        </div>
      </div>

      {confluence && <ConfluenceBreakdown confluence={confluence} />}

      <div className={styles.footer}>
        <span className={styles.time}>{getTimeAgo(timestamp)}</span>
        <div className={styles.footerActions}>
          <button className={styles.copyBtn} onClick={handleCopy} title="Copy Signal">
            📋
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignalCard;
