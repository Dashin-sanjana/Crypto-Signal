import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import { toast, TypeOptions } from 'react-toastify';
import { NOTIFICATION_SOUNDS } from '../utils/constants';
import { supportsNotifications, playSound } from '../utils/helpers';

interface NotificationContextType {
  sendNotification: (title: string, body?: string, icon?: string) => void;
  sendToast: (message: string, type?: TypeOptions) => void;
  notifySignal: (signal: any) => void;
  notifyNews: (newsItem: any) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  // Send browser notification
  const sendNotification = useCallback((title: string, body?: string, icon?: string) => {
    if (supportsNotifications() && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: icon || '/vite.svg',
        badge: '/vite.svg'
      });
    }
  }, []);

  // Send toast notification
  const sendToast = useCallback((message: string, type: TypeOptions = 'info') => {
    toast(message, {
      type,
      position: 'bottom-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true
    });
  }, []);

  // Notify signal
  const notifySignal = useCallback((signal: any) => {
    const { type, symbol, entry, strength } = signal;
    const title = `${type} Signal - ${symbol}`;
    const body = `Entry: $${entry.toFixed(2)} | Strength: ${strength}/10`;
    
    // Browser notification
    sendNotification(title, body);
    
    // Toast notification
    const toastType: TypeOptions = type === 'LONG' ? 'success' : 'error';
    sendToast(`${title}\n${body}`, toastType);
    
    // Sound alert
    const soundPath = type === 'LONG' 
      ? NOTIFICATION_SOUNDS.bullish 
      : NOTIFICATION_SOUNDS.bearish;
    playSound(soundPath);
  }, [sendNotification, sendToast]);

  // Notify news
  const notifyNews = useCallback((newsItem: any) => {
    const { title, source, sentiment } = newsItem;
    
    sendNotification(`${source} - ${sentiment.toUpperCase()}`, title);
    
    const toastType: TypeOptions = sentiment === 'bullish' ? 'success' : 
                      sentiment === 'bearish' ? 'warning' : 'info';
    sendToast(`${source}: ${title}`, toastType);
    
    playSound(NOTIFICATION_SOUNDS.news);
  }, [sendNotification, sendToast]);

  const value = {
    sendNotification,
    sendToast,
    notifySignal,
    notifyNews
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

