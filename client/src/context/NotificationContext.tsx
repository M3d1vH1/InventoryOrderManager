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
  
  // Audio elements for each sound type - created once and reused
  const [audioElements] = useState<Record<string, HTMLAudioElement>>(() => {
    // Create and configure audio elements for each notification type
    const createAudioElement = (src: string): HTMLAudioElement => {
      const audio = new Audio(src);
      // Set default volume (0.0 to 1.0)
      audio.volume = 0.5;
      // Preload audio files to reduce playback delay
      audio.preload = 'auto';
      // Add event listener for errors during loading 
      audio.addEventListener('error', (e) => {
        console.error(`Error loading audio from ${src}:`, e);
      });
      return audio;
    };
    
    return {
      'success': createAudioElement('/sounds/notification-success.mp3'),
      'warning': createAudioElement('/sounds/notification-warning.mp3'),
      'error': createAudioElement('/sounds/notification-error.mp3')
    };
  });
  
  // Track whether the user has interacted with the page
  // This helps us know if autoplay might be allowed
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  
  // Update user interaction status when they click anywhere
  useEffect(() => {
    const handleUserInteraction = () => {
      if (!userHasInteracted) {
        setUserHasInteracted(true);
        // Try to "unlock" audio on first interaction
        Object.values(audioElements).forEach(audio => {
          const quietPlayAttempt = () => {
            // Store original volume
            const originalVolume = audio.volume;
            
            // Set volume to 0 to make it silent
            audio.volume = 0;
            
            // Try to play and immediately pause to "unlock" the audio
            audio.play()
              .then(() => {
                // Immediately pause and restore volume
                audio.pause();
                audio.currentTime = 0;
                audio.volume = originalVolume;
              })
              .catch(err => {
                // Even with user interaction, some browsers still block
                console.log('Could not unlock audio:', err.message);
                // Restore volume even if it failed
                audio.volume = originalVolume;
              });
          };
          
          quietPlayAttempt();
        });
      }
    };
    
    // Add event listeners for common user interactions
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);
    
    return () => {
      // Clean up event listeners
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [userHasInteracted, audioElements]);
  
  // Function to play notification sound using the pre-created audio elements
  const playNotificationSound = (type: 'success' | 'warning' | 'error' = 'success') => {
    try {
      // Only attempt to play sound if user has interacted with the page
      if (!userHasInteracted) {
        console.log('Audio playback skipped: waiting for user interaction first');
        return;
      }
      
      // Use the pre-created audio elements instead of creating new ones
      const audio = audioElements[type];
      
      // Check if the audio element exists and is loaded properly
      if (!audio) {
        console.error(`Audio element for type "${type}" not found`);
        return;
      }
      
      // Reset the audio to the start if it's already played
      audio.currentTime = 0;
      
      // Try to play the sound - may be blocked without user interaction
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // This is usually because the browser requires user interaction first
          console.log(`Browser blocked audio playback (${type}):`, error.message);
          
          // If this is the first time we're encountering this,
          // we'll show a toast to let the user know they need to interact
          if (!userHasInteracted) {
            toast({
              title: "Notifications",
              description: "Interact with the page (click/tap) to enable audio notifications",
              duration: 5000,
            });
          }
        });
      }
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
    let socket: WebSocket | null = null;
    let reconnectTimeout: number | null = null;
    let pingInterval: number | null = null;
    let healthCheckTimeout: number | null = null;
    let reconnectAttempts = 0;
    let lastMessageTime = Date.now();
    
    // Configuration constants
    const maxReconnectAttempts = 30; // Increased to allow more reconnection attempts
    const initialReconnectDelay = 2000; // Base delay of 2 seconds
    const maxReconnectDelay = 30000; // Maximum delay of 30 seconds
    const pingFrequency = 30000; // Check connection health every 30 seconds
    const healthCheckTimeout_ms = 5000; // Wait 5s for pong response before considering connection unhealthy
    
    const jitter = () => (0.8 + 0.4 * Math.random()); // Add 20% jitter to avoid thundering herd
    
    // Calculate backoff with jitter
    const getBackoffDelay = (attempt: number) => {
      // Exponential backoff with jitter and cap
      const calculatedDelay = initialReconnectDelay * Math.pow(1.5, attempt) * jitter();
      return Math.min(calculatedDelay, maxReconnectDelay);
    };
    
    // Check if WebSocket is in an open state
    const isSocketOpen = () => {
      return socket && socket.readyState === WebSocket.OPEN;
    };
    
    // Check if WebSocket is in closed or closing state
    const isSocketClosed = () => {
      return !socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING;
    };
    
    // A health check check mechanism that uses ping/pong to verify connection
    const checkConnectionHealth = () => {
      if (!isSocketOpen()) return;
      
      // Calculate time since last message
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      
      // If we haven't received any message for a while, check health with ping
      if (timeSinceLastMessage > pingFrequency) {
        try {
          // Set a health check timeout - if we don't receive a pong in time,
          // we'll force a reconnection
          if (healthCheckTimeout) window.clearTimeout(healthCheckTimeout);
          
          healthCheckTimeout = window.setTimeout(() => {
            console.log('WebSocket health check failed, forcing reconnection');
            if (socket) {
              // Force close the socket and reconnect
              try {
                socket.close();
              } catch (e) {
                console.error('Error while force closing socket:', e);
              }
              socket = null;
              // Reconnect immediately with clean state
              reconnectAttempts = 0;
              setupWebSocket();
            }
          }, healthCheckTimeout_ms);
          
          // Send a ping message
          if (isSocketOpen()) {
            socket!.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        } catch (error) {
          console.error('Error during health check:', error);
          restartConnection();
        }
      }
    };
    
    // Clean up any existing timers
    const clearTimers = () => {
      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      if (pingInterval) {
        window.clearInterval(pingInterval);
        pingInterval = null;
      }
      
      if (healthCheckTimeout) {
        window.clearTimeout(healthCheckTimeout);
        healthCheckTimeout = null;
      }
    };
    
    // Handle active reconnection
    const restartConnection = () => {
      // Clean up existing connection
      if (socket) {
        try {
          socket.close();
        } catch (e) {
          console.error('Error closing socket during restart:', e);
        }
        socket = null;
      }
      
      // Calculate backoff delay based on attempt count
      const delay = getBackoffDelay(reconnectAttempts);
      
      console.log(`Attempting to reconnect in ${Math.round(delay)}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
      
      // Schedule reconnection
      reconnectTimeout = window.setTimeout(() => {
        reconnectAttempts++;
        setupWebSocket();
      }, delay);
    };
    
    // Function to create and set up a WebSocket connection
    const setupWebSocket = () => {
      // Clear any existing timers
      clearTimers();
      
      // If we've been trying to reconnect for a while, gradually reduce the frequency
      // but never stop completely
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.log('Many reconnect attempts made, continuing with maximum delay');
        // Just ensure we use the maximum delay, but don't increment further
        reconnectAttempts = maxReconnectAttempts;
      }
      
      try {
        // Create WebSocket connection
        const socketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${socketProtocol}//${window.location.host}/ws`);
        
        // Update last message time whenever we receive any message
        const updateLastMessageTime = () => {
          lastMessageTime = Date.now();
          
          // Clear health check timeout if it exists
          if (healthCheckTimeout) {
            window.clearTimeout(healthCheckTimeout);
            healthCheckTimeout = null;
          }
        };
        
        // Connection opened
        socket.addEventListener('open', (event) => {
          console.log('WebSocket connected');
          updateLastMessageTime();
          
          // Reset reconnect attempts on successful connection
          reconnectAttempts = 0;
          
          // Start periodic health checks
          pingInterval = window.setInterval(checkConnectionHealth, pingFrequency);
        });
        
        // Listen for messages
        socket.addEventListener('message', (event) => {
          // Update timestamp whenever we receive any message
          updateLastMessageTime();
          
          try {
            const data = JSON.parse(event.data);
            
            // Handle ping/pong for connection health checks
            if (data.type === 'pong') {
              // Received pong response, connection is healthy
              return;
            }
            
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
            } else if (data.type === 'documentUploaded') {
              // Handle document upload notifications
              const id = `document-${data.orderId}-${Date.now()}`;
              
              // Create notification for document upload
              const newNotification: Notification = {
                id,
                title: 'Document Uploaded',
                message: `A ${data.documentType} has been uploaded for order ${data.orderNumber}`,
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
        
        // Connection closed - attempt to reconnect
        socket.addEventListener('close', (event) => {
          console.log('WebSocket disconnected');
          
          // Clean up ping interval if it exists
          if (pingInterval) {
            window.clearInterval(pingInterval);
            pingInterval = null;
          }
          
          // Always attempt to reconnect with exponential backoff
          // But reset the counter if we've been trying for too long
          if (reconnectAttempts >= maxReconnectAttempts) {
            console.log('Maximum reconnect attempts reached, resetting counter but continuing with maximum delay');
            reconnectAttempts = Math.floor(maxReconnectAttempts / 2); // Reset to half to continue but with longer delays
          }
          
          // Don't attempt to reconnect if we're offline
          if (navigator.onLine) {
            restartConnection();
          } else {
            console.log('Device offline, pausing reconnection attempts until back online');
            // We'll try again when online status changes
          }
        });
        
        // Connection error
        socket.addEventListener('error', (event) => {
          console.error('WebSocket error:', event);
          // No need to call restartConnection here as the close event will be triggered after an error
        });
      } catch (error) {
        console.error('Error setting up WebSocket:', error);
        // Try to reconnect with backoff
        restartConnection();
      }
    };
    
    // Create the initial WebSocket connection
    setupWebSocket();
    
    // Listen for online/offline events
    const handleNetworkStatus = () => {
      if (navigator.onLine) {
        // Network is back online, try to reconnect
        if (isSocketClosed()) {
          console.log('Network reconnected, reestablishing WebSocket connection');
          reconnectAttempts = 0; // Reset reconnect attempts on network change
          setupWebSocket();
        }
      } else {
        console.log('Network offline, WebSocket reconnection will be paused');
        // We'll allow the existing socket to run its course and handle reconnect when back online
      }
    };
    
    // Check if the document is visible to handle page tab visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // If the page becomes visible and the socket is closed, reconnect
        if (isSocketClosed()) {
          console.log('Page visible, reconnecting WebSocket');
          reconnectAttempts = 0; // Reset reconnect attempts on visibility change
          setupWebSocket();
        } else if (isSocketOpen()) {
          // If the socket is open but we haven't checked health in a while, do a health check
          checkConnectionHealth();
        }
      }
    };
    
    // Listen for network status changes
    window.addEventListener('online', handleNetworkStatus);
    window.addEventListener('offline', handleNetworkStatus);
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup on unmount
    return () => {
      // Remove event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleNetworkStatus);
      window.removeEventListener('offline', handleNetworkStatus);
      
      // Clear all timers
      clearTimers();
      
      // Close socket if it exists
      if (socket) {
        try {
          socket.close();
        } catch (e) {
          console.error('Error closing WebSocket during cleanup:', e);
        }
        socket = null;
      }
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