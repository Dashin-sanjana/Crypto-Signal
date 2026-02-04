
import { useSignalContext } from '../../contexts/SignalContext';
import { usePriceContext } from '../../contexts/PriceContext';
import styles from './Header.module.css';

const Header = () => {
  const { activeSignals } = useSignalContext();
  const { isConnected } = usePriceContext();

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>₿</div>
        <h1 className={styles.logoText}>
          Crypto <span className="gradient-text-green">Trader</span>
        </h1>
      </div>

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Active Signals</span>
          <span className={styles.statValue}>{activeSignals.length}</span>
        </div>
        
        <div className={styles.statusIndicator}>
          <div className={`${styles.statusDot} ${styles.connected}`}></div>
          <span>Live</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.connectBtn}>
          {isConnected ? 'Connected' : 'Connecting...'}
        </button>
        <button className={styles.iconButton} title="Notifications">
          🔔
          {activeSignals.length > 0 && (
            <span className={styles.badge}>{activeSignals.length}</span>
          )}
        </button>
        
        <button className={styles.iconButton} title="Settings">
          ⚙️
        </button>
      </div>
    </header>
  );
};

export default Header;
