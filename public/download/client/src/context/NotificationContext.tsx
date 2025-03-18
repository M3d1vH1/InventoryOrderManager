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
  
  // Function to play notification sound - create a new audio element each time
  const playNotificationSound = (type: 'success' | 'warning' | 'error' = 'success') => {
    try {
      let soundUrl = '';
      
      // Determine which sound file to play
      switch (type) {
        case 'success':
          soundUrl = '/sounds/notification-success.mp3';
          break;
        case 'warning':
          soundUrl = '/sounds/notification-warning.mp3';
          break;
        case 'error':
          soundUrl = '/sounds/notification-error.mp3';
          break;
        default:
          soundUrl = '/sounds/notification-success.mp3';
      }
      
      // Create a new audio element each time
      const audio = new Audio(soundUrl);
      
      // Add event listeners for debugging
      audio.addEventListener('canplaythrough', () => {
        // Play when audio is loaded and can play through
        audio.play().catch(error => {
          console.error('Error playing notification sound:', error);
        });
      });
      
      audio.addEventListener('error', (e) => {
        console.error('Audio loading error:', e);
      });
      
      // This triggers the loading of the audio file
      audio.load();
      
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
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
        if (data.type === 'notification' && data.notification) {
          // Handle direct notification messages (typically from test notifications)
          const notification = data.notification;
          
          // Ensure timestamp is a Date object
          if (typeof notification.timestamp === 'string') {
            notification.timestamp = new Date(notification.timestamp);
          }
          
          // Add notification
          setNotifications(prev => [notification, ...prev]);
          
          // Show toast
          toast({
            title: notification.title,
            description: notification.message,
            variant: notification.type === 'error' ? 'destructive' : 'default',
          });
          
          // Play notification sound if type is specified
          if (notification.type === 'success' || notification.type === 'warning' || notification.type === 'error') {
            playNotificationSound(notification.type);
          }
        } else if (data.type === 'orderStatusChange') {
          // Generate unique ID
          const id = `order-${data.orderId}-${Date.now()}`;
          
          // Determine notification type based on status change
          let notificationType: 'info' | 'success' | 'warning' | 'error' = 'info';
          let soundType: 'success' | 'warning' | 'error' = 'success';
          
          if (data.newStatus === 'shipped') {
            notificationType = 'success';
            soundType = 'success';
          } else if (data.newStatus === 'cancelled') {
            notificationType = 'error';
            soundType = 'error';
          } else if (data.newStatus === 'picked') {
            notificationType = 'info';
            soundType = 'success';
          } else if (data.newStatus === 'pending' && data.previousStatus === 'picked') {
            notificationType = 'warning';
            soundType = 'warning';
          }
          
          // Create notification
          const newNotification: Notification = {
            id,
            title: 'Order Status Updated',
            message: `Order ${data.orderNumber} changed to ${data.newStatus}`,
            type: notificationType,
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
            variant: notificationType === 'error' ? 'destructive' : 'default',
          });
          
          // Play notification sound
          playNotificationSound(soundType);
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