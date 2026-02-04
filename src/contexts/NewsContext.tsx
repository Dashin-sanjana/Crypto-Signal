import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UPDATE_INTERVALS } from '../utils/constants';

interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  timestamp: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

interface NewsContextType {
  news: NewsItem[];
  allNews: NewsItem[];
  loading: boolean;
  filter: string;
  setFilter: (filter: string) => void;
  refreshNews: () => Promise<void>;
}

const NewsContext = createContext<NewsContextType | undefined>(undefined);

export const useNewsContext = () => {
  const context = useContext(NewsContext);
  if (!context) {
    throw new Error('useNewsContext must be used within NewsProvider');
  }
  return context;
};

interface NewsProviderProps {
  children: ReactNode;
}

export const NewsProvider: React.FC<NewsProviderProps> = ({ children }) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<string>('All');

  // Analyze sentiment based on keywords (unused for now)
  /* const analyzeSentiment = useCallback((title: string, description: string): 'bullish' | 'bearish' | 'neutral' => {
    const text = `${title} ${description}`.toLowerCase();
    
    const bullishCount = BULLISH_KEYWORDS.filter(keyword => 
      text.includes(keyword)
    ).length;
    
    const bearishCount = BEARISH_KEYWORDS.filter(keyword => 
      text.includes(keyword)
    ).length;
    
    if (bullishCount > bearishCount) return 'bullish';
    if (bearishCount > bullishCount) return 'bearish';
    return 'neutral';
  }, []); */

  // Fetch news from multiple sources
  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      
      // For demo purposes, we'll create mock news data
      // In production, you'd fetch from actual RSS feeds or APIs
      const mockNews: NewsItem[] = [
        {
          id: '1',
          title: 'Bitcoin Surges Past $50,000 as Institutional Adoption Grows',
          description: 'Major financial institutions continue to embrace cryptocurrency...',
          source: 'CoinDesk',
          url: 'https://coindesk.com',
          timestamp: Date.now() - 300000,
          sentiment: 'bullish'
        },
        {
          id: '2',
          title: 'Ethereum Network Upgrade Shows Promising Results',
          description: 'The latest Ethereum upgrade has reduced gas fees significantly...',
          source: 'Cointelegraph',
          url: 'https://cointelegraph.com',
          timestamp: Date.now() - 600000,
          sentiment: 'bullish'
        },
        {
          id: '3',
          title: 'Regulatory Concerns Impact Crypto Market Sentiment',
          description: 'New regulations proposed by financial authorities...',
          source: 'Decrypt',
          url: 'https://decrypt.co',
          timestamp: Date.now() - 900000,
          sentiment: 'bearish'
        },
        {
          id: '4',
          title: 'Solana DeFi Ecosystem Reaches New All-Time High',
          description: 'Total value locked in Solana DeFi protocols exceeds expectations...',
          source: 'CryptoSlate',
          url: 'https://cryptoslate.com',
          timestamp: Date.now() - 1200000,
          sentiment: 'bullish'
        },
        {
          id: '5',
          title: 'Major Exchange Reports Record Trading Volumes',
          description: 'Binance and Coinbase see unprecedented user activity...',
          source: 'The Block',
          url: 'https://theblock.co',
          timestamp: Date.now() - 1500000,
          sentiment: 'neutral'
        }
      ];

      setNews(mockNews);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching news:', error);
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // Auto-refresh news
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNews();
    }, UPDATE_INTERVALS.news);

    return () => clearInterval(interval);
  }, [fetchNews]);

  // Filter news
  const filteredNews = filter === 'All' 
    ? news 
    : news.filter(item => item.source === filter);

  const value = {
    news: filteredNews,
    allNews: news,
    loading,
    filter,
    setFilter,
    refreshNews: fetchNews
  };

  return (
    <NewsContext.Provider value={value}>
      {children}
    </NewsContext.Provider>
  );
};

