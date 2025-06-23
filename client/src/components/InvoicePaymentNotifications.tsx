import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Receipt, CreditCard, AlertTriangle, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Notification {
  id: string;
  type: 'invoice_created' | 'payment_created' | 'invoice_overdue';
  title: string;
  message: string;
  timestamp: Date;
  data: any;
  read: boolean;
}

const InvoicePaymentNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Mock notifications for demo - in production, these would come from API
  useEffect(() => {
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'invoice_created',
        title: 'New Invoice Created',
        message: 'Invoice #INV-2025-001 created for ABC Supplier - €1,250.00',
        timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
        data: { invoiceId: 1, amount: 1250 },
        read: false
      },
      {
        id: '2',
        type: 'payment_created',
        title: 'Payment Recorded',
        message: 'Payment of €750.00 recorded for invoice #INV-2025-002',
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        data: { paymentId: 1, invoiceId: 2, amount: 750 },
        read: false
      },
      {
        id: '3',
        type: 'invoice_overdue',
        title: 'Invoice Overdue',
        message: 'Invoice #INV-2024-150 from XYZ Corp is 5 days overdue',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        data: { invoiceId: 150, daysOverdue: 5 },
        read: true
      }
    ];
    
    setNotifications(mockNotifications);
    setUnreadCount(mockNotifications.filter(n => !n.read).length);
  }, []);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'invoice_created':
        return <Receipt className="h-4 w-4 text-blue-500" />;
      case 'payment_created':
        return <CreditCard className="h-4 w-4 text-green-500" />;
      case 'invoice_overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationVariant = (type: string) => {
    switch (type) {
      case 'invoice_created':
        return 'default';
      case 'payment_created':
        return 'default';
      case 'invoice_overdue':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    const notification = notifications.find(n => n.id === id);
    if (notification && !notification.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Invoice & Payment Notifications
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Recent invoice and payment activity alerts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <Alert>
              <Bell className="h-4 w-4" />
              <AlertTitle>No notifications</AlertTitle>
              <AlertDescription>
                You'll see invoice and payment alerts here when they occur.
              </AlertDescription>
            </Alert>
          ) : (
            notifications.map((notification) => (
              <Alert
                key={notification.id}
                variant={getNotificationVariant(notification.type)}
                className={`relative ${!notification.read ? 'border-l-4 border-l-blue-500' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1">
                      <AlertTitle className="text-sm font-medium">
                        {notification.title}
                      </AlertTitle>
                      <AlertDescription className="text-sm">
                        {notification.message}
                      </AlertDescription>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(notification.timestamp)}
                        </span>
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => markAsRead(notification.id)}
                          >
                            Mark read
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => dismissNotification(notification.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </Alert>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoicePaymentNotifications;