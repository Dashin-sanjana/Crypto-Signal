import { usePriceContext } from '../../contexts/PriceContext';
import { formatPrice, formatPercentage, getColorByValue } from '../../utils/helpers';
import CoinSearch from './CoinSearch';
import styles from './Watchlist.module.css';

const Watchlist = () => {
  const { prices, selectedSymbol, setSelectedSymbol, watchlist, setWatchlist } = usePriceContext();

  const toggleAutoTrade = (symbol: string) => {
    setWatchlist(prev =>
      prev.map(item =>
        item.symbol === symbol
          ? { ...item, autoTradeEnabled: !item.autoTradeEnabled }
          : item
      )
    );
  };

  return (
    <div className={`${styles.watchlist} glass-panel`}>
      <h3 className={styles.title}>Watchlist</h3>
      
      <CoinSearch />
      
      <div className={styles.list}>
        {watchlist.map(({ symbol, name, ticker, autoTradeEnabled }) => {
          const priceData = prices[symbol];
          const isSelected = symbol === selectedSymbol;
          const change = priceData?.change24h || 0;
          
          return (
            <div
              key={symbol}
              className={`${styles.item} ${isSelected ? styles.selected : ''}`}
            >
              <button
                className={styles.itemMain}
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
              <button
                className={`${styles.autoToggle} ${autoTradeEnabled ? styles.autoOn : ''}`}
                type="button"
                onClick={() => toggleAutoTrade(symbol)}
                title="Allow bot to auto-trade this symbol when strong signals appear"
              >
                {autoTradeEnabled ? 'BOT' : 'OFF'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Watchlist;
