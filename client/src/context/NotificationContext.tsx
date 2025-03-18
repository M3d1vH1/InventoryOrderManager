import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  orderId?: number;
  orderNumber?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  playNotificationSound: (type?: 'success' | 'warning' | 'error') => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotifications: () => {},
  playNotificationSound: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { toast } = useToast();
  
  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;
  
  // Function to play notification sound
  const playNotificationSound = (type: 'success' | 'warning' | 'error' = 'success') => {
    const audio = new Audio();
    
    switch (type) {
      case 'success':
        audio.src = '/sounds/notification-success.mp3';
        break;
      case 'warning':
        audio.src = '/sounds/notification-warning.mp3';
        break;
      case 'error':
        audio.src = '/sounds/notification-error.mp3';
        break;
      default:
        audio.src = '/sounds/notification-success.mp3';
    }
    
    // Play the sound
    audio.play().catch(error => {
      console.error('Error playing notification sound:', error);
    });
  };
  
  // Mark notification as read
  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };
  
  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  };
  
  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
  };
  
  // Setup WebSocket connection for real-time notifications
  useEffect(() => {
    // Create WebSocket connection
    const socketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${socketProtocol}//${window.location.host}/ws`);
    
    // Connection opened
    socket.addEventListener('open', (event) => {
      console.log('WebSocket connected');
    });
    
    // Listen for messages
    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle different types of notifications
        if (data.type === 'orderStatusChange') {
          // Generate unique ID
          const id = `order-${data.orderId}-${Date.now()}`;
          
          // Create notification
          const newNotification: Notification = {
            id,
            title: 'Order Status Updated',
            message: `Order ${data.orderNumber} changed to ${data.newStatus}`,
            type: 'info',
            timestamp: new Date(),
            read: false,
            orderId: data.orderId,
            orderNumber: data.orderNumber
          };
          
          // Add notification
          setNotifications(prev => [newNotification, ...prev]);
          
          // Show toast
          toast({
            title: newNotification.title,
            description: newNotification.message,
          });
          
          // Play notification sound
          playNotificationSound('success');
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    // Connection closed
    socket.addEventListener('close', (event) => {
      console.log('WebSocket disconnected');
    });
    
    // Connection error
    socket.addEventListener('error', (event) => {
      console.error('WebSocket error:', event);
    });
    
    // Cleanup on unmount
    return () => {
      socket.close();
    };
  }, [toast]);
  
  // Provide notification context
  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      playNotificationSound
    }}>
      {children}
    </NotificationContext.Provider>
  );
};