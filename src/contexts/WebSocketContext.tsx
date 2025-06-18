import React, { createContext, useContext, useEffect, useState } from 'react';

interface WebSocketContextType {
  socket: WebSocket | null;
  isConnected: boolean;
  notifications: any[];
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  notifications: []
});

export function useWebSocket() {
  return useContext(WebSocketContext);
}

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          setNotifications(prev => [data.data, ...prev.slice(0, 99)]); // Keep last 100
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      setSocket(null);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, notifications }}>
      {children}
    </WebSocketContext.Provider>
  );
}