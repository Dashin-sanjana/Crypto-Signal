import React, { useState, useEffect } from 'react';
import { usePriceContext } from '../../contexts/PriceContext';
import { predictShortTerm } from '../../utils/analysis';
import { WATCHLIST } from '../../utils/constants';
import styles from './PredictionWidget.module.css';

const PredictionWidget: React.FC = () => {
  const { fetchKlineData, prices } = usePriceContext();
  const [predictions, setPredictions] = useState<Record<string, any>>({});
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [activeTimeframe, setActiveTimeframe] = useState<'1m' | '5m'>('5m');

  useEffect(() => {
    let mounted = true;

    const runPredictions = async () => {
      const results: Record<string, any> = {};
      
      // Parallel fetch for speed
      await Promise.all(WATCHLIST.map(async (coin) => {
        try {
          const candles = await fetchKlineData(coin.symbol, activeTimeframe, 50);
          if (candles.length >= 20) {
            const currentPrice = prices[coin.symbol]?.price;
            results[coin.symbol] = predictShortTerm(candles, currentPrice);
            if (coin.symbol === 'BTCUSDT' || coin.symbol === 'ETHUSDT') {
              console.log(`[Scanner] ${coin.symbol} Prediction:`, results[coin.symbol].direction, 'at', currentPrice);
            }
          }
        } catch (e) {
          console.error(`Failed to predict for ${coin.symbol}`, e);
        }
      }));

      if (mounted) {
        setPredictions(results);
        setLastUpdated(Date.now());
      }
    };

    runPredictions();
    const interval = setInterval(runPredictions, activeTimeframe === '1m' ? 30000 : 60000); // Faster update for 1m

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchKlineData, activeTimeframe]);

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>Market Scanner</span>
          <div className={styles.metaRow}>
            <div className={styles.pills}>
              {(['1m', '5m'] as const).map(tf => (
                <button 
                  key={tf} 
                  className={`${styles.pill} ${activeTimeframe === tf ? styles.active : ''}`}
                  onClick={() => setActiveTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
            </div>
            <span className={styles.timestamp}>
              Updated: {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
        <span className={styles.liveBadge} title="Real-time analysis active">LIVE</span>
      </div>
      
      <div className={styles.list}>
        <div className={styles.listHeader}>
          <span>Asset</span>
          <span style={{textAlign: 'center'}}>Signal</span>
          <span style={{textAlign: 'right'}}>Prob</span>
        </div>
        
        {WATCHLIST.map((coin) => {
          const pred = predictions[coin.symbol];
          if (!pred) return (
            <div key={coin.symbol} className={styles.row}>
              <span className={styles.ticker}>{coin.ticker}</span>
              <span className={styles.loading}>Loading...</span>
            </div>
          );

          return (
            <div key={coin.symbol} className={styles.row}>
              <span className={styles.ticker}>{coin.ticker}</span>
              <span className={`${styles.signal} ${styles[pred.direction]}`}>
                {pred.direction === 'UP' ? '✅ BUY' : pred.direction === 'DOWN' ? '🚨 SELL' : '⏸ WAIT'}
              </span>
              <span className={`${styles.prob} ${styles[pred.probability]}`}>
                {pred.probability}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PredictionWidget;
