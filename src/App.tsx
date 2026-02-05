import { useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import { PriceProvider } from './contexts/PriceContext';
import { SignalProvider } from './contexts/SignalContext';
import { TradingProvider } from './contexts/TradingContext';
import { NewsProvider } from './contexts/NewsContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Sidebar from './components/Sidebar/Sidebar';
import Watchlist from './components/Watchlist/Watchlist';
import TradingChart from './components/TradingChart/TradingChart';
import NewsPanel from './components/NewsPanel/NewsPanel';
import SignalBot from './components/SignalBot';
import PredictionWidget from './components/PredictionWidget/PredictionWidget';
import TechnicalAnalysis from './components/TechnicalAnalysis/TechnicalAnalysis';
import SignalDisplay from './components/TechnicalAnalysis/SignalDisplay';
import BotControl from './components/BotControl/BotControl';
import Positions from './components/Positions/Positions';
import { useAutoExecution } from './hooks/useAutoExecution';
import { useTechnicalAnalysisSignals } from './hooks/useTechnicalAnalysisSignals';
import { useSignalContext } from './contexts/SignalContext';
import { useTradingContext } from './contexts/TradingContext';
import { supportsNotifications } from './utils/helpers';
import { Toaster } from './components/ui/toaster';
import { ScrollArea } from './components/ui/scroll-area';

// Component to handle auto-execution (must be inside TradingProvider)
const AutoExecutionHandler = () => {
  useAutoExecution();
  return null;
};

// Component to generate signals from Technical Analysis
const TechnicalAnalysisSignalGenerator = () => {
  useTechnicalAnalysisSignals();
  return null;
};

// Component to get signal count and connection status
const AppContent = () => {
  const { activeSignals } = useSignalContext();
  const { isConnected } = useTradingContext();

  useEffect(() => {
    // Request notification permission on mount
    if (supportsNotifications() && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <>
      <AutoExecutionHandler />
      <TechnicalAnalysisSignalGenerator />
      <SignalBot />

      <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
        {/* Sidebar */}
        <Sidebar isConnected={isConnected} activeSignals={activeSignals.length} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Background Glow Effects */}
          <div className="pointer-events-none absolute -left-[20vw] -top-[20vw] z-0 h-[60vw] w-[60vw] rounded-full bg-primary/5 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-[20vw] -right-[20vw] z-0 h-[60vw] w-[60vw] rounded-full bg-secondary/5 blur-[100px]" />

          {/* Header Bar */}
          <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm z-20 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold">Dashboard</h1>
            </div>
            <Watchlist />
          </header>

          {/* Main Grid */}
          <ScrollArea className="flex-1 z-10">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-6 p-6">
              {/* Left Column - Charts & Signals */}
              <div className="flex flex-col gap-6 min-w-0">
                <TradingChart />
                <SignalDisplay />
                <PredictionWidget />
              </div>

              {/* Right Column - Analysis, Positions, Controls */}
              <div className="flex flex-col gap-6">
                <BotControl />
                <TechnicalAnalysis />
                <Positions />
                <NewsPanel />
              </div>
            </div>
          </ScrollArea>
        </div>
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
        toastClassName="bg-card text-card-foreground border border-border"
      />
      <Toaster />
    </>
  );
};

function App() {
  return (
    <NotificationProvider>
      <TradingProvider>
        <PriceProvider>
          <SignalProvider>
            <NewsProvider>
              <AppContent />
            </NewsProvider>
          </SignalProvider>
        </PriceProvider>
      </TradingProvider>
    </NotificationProvider>
  );
}

export default App;
