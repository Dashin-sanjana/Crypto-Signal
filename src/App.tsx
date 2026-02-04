import { useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import { PriceProvider } from './contexts/PriceContext';
import { SignalProvider } from './contexts/SignalContext';
import { NewsProvider } from './contexts/NewsContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Header from './components/Header/Header';
import Watchlist from './components/Watchlist/Watchlist';
import TradingChart from './components/TradingChart/TradingChart';
import SignalList from './components/SignalList/SignalList';
import NewsPanel from './components/NewsPanel/NewsPanel';
import SignalBot from './components/SignalBot';
import PredictionWidget from './components/PredictionWidget/PredictionWidget';
import TechnicalAnalysis from './components/TechnicalAnalysis/TechnicalAnalysis';
import SignalDisplay from './components/TechnicalAnalysis/SignalDisplay';
import styles from './App.module.css';
import { supportsNotifications } from './utils/helpers';

function App() {
  useEffect(() => {
    // Request notification permission on mount
    if (supportsNotifications() && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <NotificationProvider>
      <PriceProvider>
        <SignalProvider>
          <NewsProvider>
            <SignalBot />
            <div className={styles.app}>
              <Header />
              
              <div className={styles.mainContainer}>
                <aside className={styles.leftSidebar}>
                  <Watchlist />
                  <div className={styles.scannerWrapper}>
                    <PredictionWidget />
                  </div>
                </aside>
                
                <main className={styles.chartContainer}>
                  <TradingChart />
                  <div className={styles.signalsListWrapper}>
                    <SignalList />
                  </div>
                </main>
                
                <aside className={styles.rightSidebar}>
                  <SignalDisplay />
                  <TechnicalAnalysis />
                  <NewsPanel />
                </aside>
              </div>
              
              <ToastContainer
                position="bottom-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
              />
            </div>
          </NewsProvider>
        </SignalProvider>
      </PriceProvider>
    </NotificationProvider>
  );
}

export default App;
