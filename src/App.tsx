import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { PriceProvider } from './contexts/PriceContext';
import { SignalProvider } from './contexts/SignalContext';
import { NewsProvider } from './contexts/NewsContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { TradingProvider } from './contexts/TradingContext';
import SignalBot from './components/SignalBot';
import AppShell from './layouts/AppShell';
import DashboardPage from './pages/DashboardPage';
import BotControlPage from './pages/BotControlPage';
import SettingsPage from './pages/SettingsPage';
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
        <TradingProvider>
          <SignalProvider>
            <NewsProvider>
              <SignalBot />
              <AppShell>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/bot" element={<BotControlPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>

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
              </AppShell>
            </NewsProvider>
          </SignalProvider>
        </TradingProvider>
      </PriceProvider>
    </NotificationProvider>
  );
}

export default App;
