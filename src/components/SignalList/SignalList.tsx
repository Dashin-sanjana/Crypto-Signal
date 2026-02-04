import { useState } from 'react';
import { useSignalContext } from '../../contexts/SignalContext';
import SignalCard from '../SignalCard/SignalCard';
import styles from './SignalList.module.css';

const SignalList = () => {
  const { activeSignals, clearAllSignals, scanMarkets } = useSignalContext();
  const [scanning, setScanning] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    await scanMarkets();
    setTimeout(() => setScanning(false), 500);
  };

  return (
    <div className={`${styles.signalList} glass-panel`}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          Active Signals ({activeSignals.length})
        </h3>
        
        <div className={styles.headerActions}>
          <button 
            className={`${styles.scanBtn} ${scanning ? styles.scanning : ''}`}
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? 'Scanning...' : '⚡ Scan Now'}
          </button>
          
          {activeSignals.length > 0 && (
            <button className={styles.clearBtn} onClick={clearAllSignals}>
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className={styles.list}>
        {activeSignals.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📊</div>
            <p>No active signals</p>
            <span className={styles.emptyHint}>
              Signals will appear when all 5 methods align
            </span>
          </div>
        ) : (
          activeSignals.map(signal => (
            <SignalCard key={signal.id} signal={signal} />
          ))
        )}
      </div>
    </div>
  );
};

export default SignalList;
