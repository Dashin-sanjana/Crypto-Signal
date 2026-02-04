import React, { useState, useRef, useEffect } from 'react';
import { usePriceContext } from '../../contexts/PriceContext';
import { formatPrice } from '../../utils/helpers';
import styles from './CoinSearch.module.css';

const CoinSearch: React.FC = () => {
  const { allSymbols, addToWatchlist, prices } = usePriceContext();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredSymbols = query.length > 1
    ? allSymbols.filter(s => 
        s.symbol.toLowerCase().includes(query.toLowerCase()) ||
        s.baseAsset.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10)
    : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (symbolInfo: any) => {
    addToWatchlist(symbolInfo);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className={styles.searchContainer} ref={containerRef}>
      <div className={styles.searchWrapper}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search all CMC coins..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
      </div>

      {isOpen && filteredSymbols.length > 0 && (
        <div className={styles.resultsList}>
          {filteredSymbols.map((item) => {
            const price = prices[item.symbol]?.price;
            return (
              <button
                key={item.symbol}
                className={styles.resultItem}
                onClick={() => handleSelect(item)}
              >
                <div className={styles.coinInfo}>
                  <span className={styles.ticker}>{item.baseAsset}</span>
                  <span className={styles.name}>{item.symbol}</span>
                </div>
                <div className={styles.priceInfo}>
                  <span className={styles.price}>{price ? `$${formatPrice(price)}` : '---'}</span>
                  <span className={styles.badge}>USDT</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CoinSearch;
