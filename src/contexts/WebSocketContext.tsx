import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface JobStatus {
  status: 'running' | 'completed' | 'failed';
  message: string;
  progress: number;
  currentSwitch?: string;
  devicesFound?: number;
  newDevices?: number;
  unauthorizedDevices?: number;
  error?: string;
}

interface WebSocketContextType {
  socket: WebSocket | null;
  isConnected: boolean;
  notifications: any[];
  jobStatuses: Map<string, JobStatus>;
  deviceUpdates: any[];
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  notifications: [],
  jobStatuses: new Map(),
  deviceUpdates: [],
  reconnect: () => {}
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
  const [jobStatuses, setJobStatuses] = useState<Map<string, JobStatus>>(new Map());
  const [deviceUpdates, setDeviceUpdates] = useState<any[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    try {
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
      console.log('Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setSocket(ws);
        setReconnectAttempts(0);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          switch (data.type) {
            case 'notification':
              setNotifications(prev => [data.data, ...prev.slice(0, 99)]); // Keep last 100
              break;
              
            case 'job_status':
              setJobStatuses(prev => {
                const newMap = new Map(prev);
                newMap.set(data.jobId, data.data);
                return newMap;
              });
              break;
              
            case 'device_update':
              setDeviceUpdates(prev => [data.data, ...prev.slice(0, 49)]); // Keep last 50
              break;
              
            case 'connection':
              console.log('WebSocket connection confirmed:', data.message);
              break;
              
            default:
              console.log('Unknown WebSocket message type:', data.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setSocket(null);
        
        // Attempt to reconnect if not a manual close
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
          console.log(`Attempting to reconnect in ${timeout}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, timeout);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      // Setup ping/pong for connection health
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping?.();
        }
      }, 30000);

      // Cleanup interval when connection closes
      ws.onclose = (event) => {
        clearInterval(pingInterval);
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setSocket(null);
        
        // Attempt to reconnect if not a manual close
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`Attempting to reconnect in ${timeout}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, timeout);
        }
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [reconnectAttempts]);

  const reconnect = useCallback(() => {
    if (socket) {
      socket.close();
    }
    setReconnectAttempts(0);
    connect();
  }, [socket, connect]);

  useEffect(() => {
    connect();

    return () => {
      if (socket) {
        socket.close(1000); // Normal closure
      }
    };
  }, []);

  // Clear job status when job completes
  useEffect(() => {
    jobStatuses.forEach((status, jobId) => {
      if (status.status === 'completed' || status.status === 'failed') {
        setTimeout(() => {
          setJobStatuses(prev => {
            const newMap = new Map(prev);
            newMap.delete(jobId);
            return newMap;
          });
        }, 10000); // Clear after 10 seconds
      }
    });
  }, [jobStatuses]);

  return (
    <WebSocketContext.Provider value={{ 
      socket, 
      isConnected, 
      notifications, 
      jobStatuses,
      deviceUpdates,
      reconnect 
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}