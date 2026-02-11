import { Card } from '../components/ui/card';
import { usePriceContext } from '../contexts/PriceContext';
import TradingChart from '../components/TradingChart/TradingChart';
import NewsPanel from '../components/NewsPanel/NewsPanel';
import Watchlist from '../components/Watchlist/Watchlist';
import styles from './DashboardPage.module.css';

const DashboardPage = () => {
  const { selectedSymbol, prices } = usePriceContext();
  const price = selectedSymbol ? prices[selectedSymbol]?.price : undefined;

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        <div className={styles.leftColumn}>
          <TradingChart />

          <div className={styles.summaryRow}>
            <Card>
              <div className={styles.summaryCardTitle}>Current Symbol</div>
              <div className={styles.summaryValue}>{selectedSymbol || 'No symbol selected'}</div>
              <div className={styles.summaryMeta}>
                Spot the best opportunities while your bot handles execution.
              </div>
            </Card>

            <Card>
              <div className={styles.summaryCardTitle}>Last Price</div>
              <div className={styles.summaryValue}>
                {price ? price.toFixed(6) : '—'}
              </div>
              <div className={styles.summaryMeta}>
                Live price feed from your watchlist markets.
              </div>
            </Card>
          </div>
        </div>

        <div className={styles.rightColumn}>
          <Watchlist />
          <NewsPanel />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

