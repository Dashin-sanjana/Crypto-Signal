/**
 * WebSocket hook for real-time trading updates
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import TRADING_CONFIG from '../config/trading';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface UseTradingWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export const useTradingWebSocket = (options: UseTradingWebSocketOptions = {}) => {
  const {
    onMessage,
    onError,
    onConnect,
    onDisconnect,
    autoReconnect = true,
    reconnectInterval = 5000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      const ws = new WebSocket(TRADING_CONFIG.WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        shouldReconnectRef.current = true;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessage?.(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        // WebSocket errors are often not very descriptive
        // Log connection state for debugging
        console.warn(`[WebSocket] Connection error for ${TRADING_CONFIG.WS_URL}. State: ${ws.readyState}`);
        // Don't spam console with generic errors
        // onError?.(error);
      };

      ws.onclose = () => {
        setIsConnected(false);
        onDisconnect?.();

        // Auto-reconnect if enabled
        if (autoReconnect && shouldReconnectRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      if (autoReconnect && shouldReconnectRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      }
    }
  }, [onMessage, onError, onConnect, onDisconnect, autoReconnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket is not connected');
    return false;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, []); // Only connect once on mount

  return {
    isConnected,
    lastMessage,
    connect,
    disconnect,
    sendMessage,
  };
};
