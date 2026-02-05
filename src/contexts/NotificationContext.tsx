import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import { TypeOptions } from 'react-toastify';
import { NOTIFICATION_SOUNDS } from '../utils/constants';
import { supportsNotifications, playSound } from '../utils/helpers';
import { notificationManager } from '../utils/notificationManager';
import { showToast } from '../utils/toastHelper';

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

  // Send toast notification (with notification manager check)
  const sendToast = useCallback((message: string, type: TypeOptions = 'info', key?: string, notificationType?: 'signal' | 'trade' | 'position' | 'news', data?: any) => {
    showToast(message, type, {}, key, notificationType, data);
  }, []);

  // Notify signal (with throttling)
  const notifySignal = useCallback((signal: any) => {
    const { type, symbol, entry, strength } = signal;
    const key = `signal_${symbol}_${type}`;
    
    // Check if should notify
    if (!notificationManager.shouldNotify('signal', key, signal)) {
      return; // Throttled or filtered
    }
    
    const title = `${type} Signal - ${symbol}`;
    const body = `Entry: $${entry.toFixed(2)} | Strength: ${strength}/10`;
    
    // Browser notification (only for important signals)
    if (notificationManager.isImportant('signal', signal)) {
      sendNotification(title, body);
    }
    
    // Toast notification (only if enabled and important)
    const toastType: TypeOptions = type === 'LONG' ? 'success' : 'error';
    sendToast(`${title} - ${body}`, toastType, key, 'signal', signal);
    
    // Sound alert (only for important signals)
    if (notificationManager.isImportant('signal', signal)) {
      const soundPath = type === 'LONG' 
        ? NOTIFICATION_SOUNDS.bullish 
        : NOTIFICATION_SOUNDS.bearish;
      playSound(soundPath);
    }
  }, [sendNotification, sendToast]);

  // Notify news (with throttling)
  const notifyNews = useCallback((newsItem: any) => {
    const { title, source, sentiment } = newsItem;
    const key = `news_${source}_${Date.now()}`;
    
    // Check if should notify
    if (!notificationManager.shouldNotify('news', key, newsItem)) {
      return; // Throttled or filtered
    }
    
    // Browser notification (only for important news)
    if (notificationManager.isImportant('news', newsItem)) {
      sendNotification(`${source} - ${sentiment.toUpperCase()}`, title);
    }
    
    const toastType: TypeOptions = sentiment === 'bullish' ? 'success' : 
                      sentiment === 'bearish' ? 'warning' : 'info';
    sendToast(`${source}: ${title}`, toastType);
    
    // Sound (only for important news)
    if (notificationManager.isImportant('news', newsItem)) {
      playSound(NOTIFICATION_SOUNDS.news);
    }
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

