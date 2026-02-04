import { usePriceContext } from '../../contexts/PriceContext';
import { formatPrice, formatPercentage, getColorByValue } from '../../utils/helpers';
import CoinSearch from './CoinSearch';
import styles from './Watchlist.module.css';

const Watchlist = () => {
  const { prices, selectedSymbol, setSelectedSymbol, watchlist } = usePriceContext();

  return (
    <div className={`${styles.watchlist} glass-panel`}>
      <h3 className={styles.title}>Watchlist</h3>
      
      <CoinSearch />
      
      <div className={styles.list}>
        {watchlist.map(({ symbol, name, ticker }) => {
          const priceData = prices[symbol];
          const isSelected = symbol === selectedSymbol;
          const change = priceData?.change24h || 0;
          
          return (
            <button
              key={symbol}
              className={`${styles.item} ${isSelected ? styles.selected : ''}`}
              onClick={() => setSelectedSymbol(symbol)}
            >
              <div className={styles.itemHeader}>
                <span className={styles.ticker}>{ticker}</span>
                <span 
                  className={styles.change}
                  style={{ color: getColorByValue(change) }}
                >
                  {formatPercentage(change)}
                </span>
              </div>
              
              <div className={styles.itemBody}>
                <span className={styles.name}>{name}</span>
                <span className={styles.price}>
                  ${priceData ? formatPrice(priceData.price) : '---'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Watchlist;
