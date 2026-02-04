
import { useNewsContext } from '../../contexts/NewsContext';
import { NEWS_SOURCES } from '../../utils/constants';
import { getTimeAgo } from '../../utils/helpers';
import styles from './NewsPanel.module.css';

const NewsPanel = () => {
  const { news, filter, setFilter, loading, refreshNews } = useNewsContext();

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'var(--green-primary)';
      case 'bearish': return 'var(--red-primary)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className={`${styles.newsPanel} glass-panel`}>
      <div className={styles.header}>
        <h3 className={styles.title}>News Feed</h3>
        <button className={styles.refreshBtn} onClick={refreshNews} disabled={loading}>
          🔄
        </button>
      </div>

      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${filter === 'All' ? styles.active : ''}`}
          onClick={() => setFilter('All')}
        >
          All
        </button>
        {NEWS_SOURCES.map(({ name }) => (
          <button
            key={name}
            className={`${styles.filterBtn} ${filter === name ? styles.active : ''}`}
            onClick={() => setFilter(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className={styles.newsList}>
        {loading ? (
          <div className={styles.loading}>
            <div className="spinner"></div>
          </div>
        ) : news.length === 0 ? (
          <div className={styles.empty}>No news available</div>
        ) : (
          news.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.newsItem}
            >
              <div className={styles.newsHeader}>
                <span className={styles.source}>{item.source}</span>
                <span
                  className={styles.sentiment}
                  style={{ color: getSentimentColor(item.sentiment) }}
                >
                  {item.sentiment}
                </span>
              </div>
              
              <h4 className={styles.newsTitle}>{item.title}</h4>
              
              <p className={styles.newsDescription}>{item.description}</p>
              
              <span className={styles.newsTime}>{getTimeAgo(item.timestamp)}</span>
            </a>
          ))
        )}
      </div>
    </div>
  );
};

export default NewsPanel;
