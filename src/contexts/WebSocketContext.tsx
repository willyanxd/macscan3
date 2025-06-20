import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface WebSocketContextType {
  socket: WebSocket | null;
  isConnected: boolean;
  notifications: any[];
  jobStatuses: Map<string, any>;
  addNotification: (notification: any) => void;
  updateJobStatus: (jobId: string, status: any) => void;
  clearNotifications: () => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  notifications: [],
  jobStatuses: new Map(),
  addNotification: () => {},
  updateJobStatus: () => {},
  clearNotifications: () => {}
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
  const [jobStatuses, setJobStatuses] = useState<Map<string, any>>(new Map());

  const addNotification = useCallback((notification: any) => {
    setNotifications(prev => [notification, ...prev.slice(0, 99)]);
  }, []);

  const updateJobStatus = useCallback((jobId: string, status: any) => {
    setJobStatuses(prev => new Map(prev.set(jobId, status)));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setSocket(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'notification':
              addNotification(data.data);
              break;
              
            case 'job_status':
              updateJobStatus(data.data.jobId, data.data);
              break;
              
            case 'notifications_updated':
              // Refresh notifications when bulk operations occur
              if (data.data.action === 'mark_all_read' || data.data.action === 'delete_all') {
                // Trigger a refresh in components that need it
                window.dispatchEvent(new CustomEvent('notifications_updated', { detail: data.data }));
              }
              break;
              
            case 'connection':
              console.log('WebSocket connection confirmed:', data.data);
              break;
              
            default:
              console.log('Unknown WebSocket message type:', data.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('❌ WebSocket disconnected');
        setIsConnected(false);
        setSocket(null);
        
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connectWebSocket();

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ 
      socket, 
      isConnected, 
      notifications, 
      jobStatuses,
      addNotification,
      updateJobStatus,
      clearNotifications
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}