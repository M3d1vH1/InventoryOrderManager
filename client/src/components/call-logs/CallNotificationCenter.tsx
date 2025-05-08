import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isToday, isPast, isThisWeek, addDays, addMinutes } from 'date-fns';
import { el } from 'date-fns/locale';
import { 
  Bell, 
  Calendar, 
  Check, 
  Clock, 
  Mail, 
  Phone, 
  Send, 
  X, 
  AlertCircle, 
  BellOff,
  User,
  CalendarClock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface CallNotificationCenterProps {
  maxItems?: number;
  hideIfEmpty?: boolean;
}

const CallNotificationCenter: React.FC<CallNotificationCenterProps> = ({ 
  maxItems = 5,
  hideIfEmpty = false,
}) => {
  const { t, i18n } = useTranslation();
  const isGreek = i18n.language === 'el';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [selectedReminderId, setSelectedReminderId] = useState<number | null>(null);
  const [reminderNote, setReminderNote] = useState('');
  const [sendEmailChecked, setSendEmailChecked] = useState(false);

  // Fetch upcoming follow-ups
  const { 
    data: upcomingFollowups = [], 
    isLoading: isLoadingUpcoming,
    isError: isUpcomingError
  } = useQuery({
    queryKey: ['/api/notifications/call-followups/upcoming'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/notifications/call-followups/upcoming', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch upcoming follow-ups');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching upcoming follow-ups:', error);
        return [];
      }
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Fetch missed calls
  const { 
    data: missedCalls = [], 
    isLoading: isLoadingMissed,
    isError: isMissedError
  } = useQuery({
    queryKey: ['/api/notifications/missed-calls'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/notifications/missed-calls', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch missed calls');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching missed calls:', error);
        return [];
      }
    },
  });

  // Fetch overdue follow-ups
  const { 
    data: overdueFollowups = [], 
    isLoading: isLoadingOverdue,
    isError: isOverdueError
  } = useQuery({
    queryKey: ['/api/notifications/call-followups/overdue'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/notifications/call-followups/overdue', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch overdue follow-ups');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching overdue follow-ups:', error);
        return [];
      }
    },
  });

  // Mark follow-up as completed
  const completeFollowupMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/call-logs/${id}/complete-followup`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'Marked as completed from notifications' }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to complete follow-up');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/call-followups/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/call-followups/overdue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] });
      
      toast({
        title: t('callLogs.notifications.followupCompleted'),
        description: t('callLogs.notifications.followupCompletedDescription'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('callLogs.notifications.followupError'),
        variant: 'destructive',
      });
    },
  });

  // Send reminder for follow-up
  const sendReminderMutation = useMutation({
    mutationFn: async ({ id, note, sendEmail }: { id: number, note: string, sendEmail: boolean }) => {
      const response = await fetch(`/api/call-logs/${id}/send-reminder`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note, sendEmail }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send reminder');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/call-followups/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/call-followups/overdue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] });
      
      toast({
        title: t('callLogs.notifications.reminderSent'),
        description: t('callLogs.notifications.reminderSentDescription'),
      });
      
      // Reset form state
      setReminderNote('');
      setSendEmailChecked(false);
      setReminderDialogOpen(false);
      setSelectedReminderId(null);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('callLogs.notifications.reminderError'),
        variant: 'destructive',
      });
    },
  });

  // Dismiss missed call notification
  const dismissMissedCallMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/call-logs/${id}/dismiss-notification`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to dismiss notification');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/missed-calls'] });
      queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] });
      
      toast({
        title: t('callLogs.notifications.dismissed'),
        description: t('callLogs.notifications.dismissedDescription'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('callLogs.notifications.dismissError'),
        variant: 'destructive',
      });
    },
  });

  // Handle checkbox selection
  const handleSelectNotification = (id: number) => {
    setSelectedNotifications(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Handle bulk action - complete selected
  const completeSelected = () => {
    // Execute mutations in sequence to avoid race conditions
    const completeSequentially = async () => {
      for (const id of selectedNotifications) {
        await completeFollowupMutation.mutateAsync(id);
      }
      setSelectedNotifications([]);
    };
    
    completeSequentially().catch(error => {
      console.error('Error completing selected followups:', error);
    });
  };

  // Handle opening reminder dialog
  const openReminderDialog = (id: number) => {
    setSelectedReminderId(id);
    setReminderDialogOpen(true);
  };

  // Handle sending reminder
  const sendReminder = () => {
    if (selectedReminderId === null) return;
    
    sendReminderMutation.mutate({
      id: selectedReminderId,
      note: reminderNote,
      sendEmail: sendEmailChecked,
    });
  };

  // Format date taking into account i18n
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'PPp', {
        locale: isGreek ? el : undefined
      });
    } catch (e) {
      console.error('Date formatting error:', e);
      return dateString;
    }
  };

  // Get a friendly date string
  const getFriendlyDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      
      if (isToday(date)) {
        return t('callLogs.notifications.today');
      } else if (isThisWeek(date)) {
        return format(date, 'EEEE', { locale: isGreek ? el : undefined });
      } else {
        return format(date, 'PPP', { locale: isGreek ? el : undefined });
      }
    } catch (e) {
      console.error('Date formatting error:', e);
      return dateString;
    }
  };

  // Get time from date
  const getTimeFromDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'p', { locale: isGreek ? el : undefined });
    } catch (e) {
      console.error('Date formatting error:', e);
      return '';
    }
  };

  // Get a relative time description
  const getRelativeTimeDescription = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      
      if (isPast(date)) {
        // Calculate how many days/hours ago
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        
        if (diffDays > 0) {
          return t('callLogs.notifications.daysAgo', { count: diffDays });
        } else if (diffHours > 0) {
          return t('callLogs.notifications.hoursAgo', { count: diffHours });
        } else {
          return t('callLogs.notifications.justNow');
        }
      } else {
        // Calculate how many days/hours from now
        const diffMs = date.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        
        if (diffDays > 0) {
          return t('callLogs.notifications.inDays', { count: diffDays });
        } else if (diffHours > 0) {
          return t('callLogs.notifications.inHours', { count: diffHours });
        } else {
          return t('callLogs.notifications.soon');
        }
      }
    } catch (e) {
      console.error('Date formatting error:', e);
      return '';
    }
  };

  // Get notification count
  const getNotificationCount = (tabName: string) => {
    switch (tabName) {
      case 'upcoming':
        return upcomingFollowups.length;
      case 'missed':
        return missedCalls.length;
      case 'overdue':
        return overdueFollowups.length;
      default:
        return 0;
    }
  };

  // Total notification count
  const totalNotifications = upcomingFollowups.length + missedCalls.length + overdueFollowups.length;

  // If there are no notifications and hideIfEmpty is true, don't show the component
  if (hideIfEmpty && totalNotifications === 0 && !isLoadingUpcoming && !isLoadingMissed && !isLoadingOverdue) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium flex items-center">
          <Bell className="h-5 w-5 mr-2" />
          {t('callLogs.notifications.title')}
          {totalNotifications > 0 && (
            <Badge className="ml-2" variant="default">
              {totalNotifications}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {t('callLogs.notifications.description')}
        </CardDescription>
      </CardHeader>
      
      <Tabs defaultValue="upcoming" onValueChange={setActiveTab} className="w-full">
        <div className="px-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming" className="relative">
              {t('callLogs.notifications.upcoming')}
              {upcomingFollowups.length > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
                  {upcomingFollowups.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="missed" className="relative">
              {t('callLogs.notifications.missed')}
              {missedCalls.length > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
                  {missedCalls.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="overdue" className="relative">
              {t('callLogs.notifications.overdue')}
              {overdueFollowups.length > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {overdueFollowups.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>
        
        {/* Upcoming Follow-ups Tab */}
        <TabsContent value="upcoming" className="space-y-4">
          <ScrollArea className="h-[300px] px-6">
            {isLoadingUpcoming ? (
              <div className="py-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('common.loading')}
                </p>
              </div>
            ) : isUpcomingError ? (
              <div className="py-4 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">
                  {t('common.errorLoadingData')}
                </p>
              </div>
            ) : upcomingFollowups.length === 0 ? (
              <div className="py-4 text-center">
                <CalendarClock className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t('callLogs.notifications.noUpcomingFollowups')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Multi-select controls */}
                {selectedNotifications.length > 0 && (
                  <div className="bg-muted p-2 rounded-md mb-2 flex items-center justify-between">
                    <span className="text-sm">
                      {t('callLogs.notifications.selected', { count: selectedNotifications.length })}
                    </span>
                    <Button 
                      size="sm" 
                      onClick={completeSelected} 
                      className="h-7"
                      disabled={completeFollowupMutation.isPending}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      {t('callLogs.notifications.markComplete')}
                    </Button>
                  </div>
                )}
                
                {upcomingFollowups.slice(0, maxItems).map((followup: any) => (
                  <div key={followup.id} className="flex gap-2 p-2 rounded-md hover:bg-muted">
                    <div className="flex-shrink-0 pt-1">
                      <Checkbox 
                        checked={selectedNotifications.includes(followup.id)}
                        onCheckedChange={() => handleSelectNotification(followup.id)}
                      />
                    </div>
                    
                    <div className="flex-grow">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-medium">
                            {followup.customerName || t('common.unknown')}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {followup.subject}
                          </p>
                        </div>
                        <Badge 
                          variant={
                            isToday(new Date(followup.followupDate)) 
                              ? "default" 
                              : "outline"
                          }
                          className="text-xs ml-2"
                        >
                          {getFriendlyDate(followup.followupDate)}
                        </Badge>
                      </div>
                      
                      <div className="mt-1 flex items-center justify-between">
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {getTimeFromDate(followup.followupDate)}
                          </span>
                          
                          {followup.assignedToName && (
                            <>
                              <User className="h-3 w-3 ml-2 mr-1 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {followup.assignedToName}
                              </span>
                            </>
                          )}
                        </div>
                        
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2"
                            onClick={() => openReminderDialog(followup.id)}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                          <Link to={`/call-logs/${followup.id}`}>
                            <Button variant="ghost" size="sm" className="h-6 px-2">
                              <Phone className="h-3 w-3" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2"
                            onClick={() => completeFollowupMutation.mutate(followup.id)}
                            disabled={completeFollowupMutation.isPending}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {upcomingFollowups.length > maxItems && (
                  <div className="text-center pt-2">
                    <Link to="/call-logs?filter=followups">
                      <Button variant="link" size="sm">
                        {t('callLogs.notifications.viewMore', { count: upcomingFollowups.length - maxItems })}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
        
        {/* Missed Calls Tab */}
        <TabsContent value="missed" className="space-y-4">
          <ScrollArea className="h-[300px] px-6">
            {isLoadingMissed ? (
              <div className="py-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('common.loading')}
                </p>
              </div>
            ) : isMissedError ? (
              <div className="py-4 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">
                  {t('common.errorLoadingData')}
                </p>
              </div>
            ) : missedCalls.length === 0 ? (
              <div className="py-4 text-center">
                <BellOff className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t('callLogs.notifications.noMissedCalls')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {missedCalls.slice(0, maxItems).map((call: any) => (
                  <div key={call.id} className="flex gap-2 p-2 rounded-md hover:bg-muted">
                    <div className="flex-grow">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-medium">
                            {call.customerName || t('common.unknown')}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {call.subject || t('callLogs.noSubject')}
                          </p>
                        </div>
                        <Badge 
                          variant="destructive"
                          className="text-xs ml-2"
                        >
                          {t('callLogs.form.callTypes.missed')}
                        </Badge>
                      </div>
                      
                      <div className="mt-1 flex items-center justify-between">
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {getRelativeTimeDescription(call.callDate)}
                          </span>
                        </div>
                        
                        <div className="flex gap-1">
                          <Link to={`/call-logs/${call.id}`}>
                            <Button variant="ghost" size="sm" className="h-6 px-2">
                              <Phone className="h-3 w-3" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2"
                            onClick={() => dismissMissedCallMutation.mutate(call.id)}
                            disabled={dismissMissedCallMutation.isPending}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {missedCalls.length > maxItems && (
                  <div className="text-center pt-2">
                    <Link to="/call-logs?filter=missed">
                      <Button variant="link" size="sm">
                        {t('callLogs.notifications.viewMore', { count: missedCalls.length - maxItems })}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
        
        {/* Overdue Follow-ups Tab */}
        <TabsContent value="overdue" className="space-y-4">
          <ScrollArea className="h-[300px] px-6">
            {isLoadingOverdue ? (
              <div className="py-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('common.loading')}
                </p>
              </div>
            ) : isOverdueError ? (
              <div className="py-4 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">
                  {t('common.errorLoadingData')}
                </p>
              </div>
            ) : overdueFollowups.length === 0 ? (
              <div className="py-4 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t('callLogs.notifications.noOverdueFollowups')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Multi-select controls */}
                {selectedNotifications.length > 0 && (
                  <div className="bg-muted p-2 rounded-md mb-2 flex items-center justify-between">
                    <span className="text-sm">
                      {t('callLogs.notifications.selected', { count: selectedNotifications.length })}
                    </span>
                    <Button 
                      size="sm" 
                      onClick={completeSelected} 
                      className="h-7"
                      disabled={completeFollowupMutation.isPending}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      {t('callLogs.notifications.markComplete')}
                    </Button>
                  </div>
                )}
                
                {overdueFollowups.slice(0, maxItems).map((followup: any) => (
                  <div key={followup.id} className="flex gap-2 p-2 rounded-md hover:bg-muted">
                    <div className="flex-shrink-0 pt-1">
                      <Checkbox 
                        checked={selectedNotifications.includes(followup.id)}
                        onCheckedChange={() => handleSelectNotification(followup.id)}
                      />
                    </div>
                    
                    <div className="flex-grow">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-medium">
                            {followup.customerName || t('common.unknown')}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {followup.subject}
                          </p>
                        </div>
                        <Badge 
                          variant="destructive"
                          className="text-xs ml-2"
                        >
                          {getRelativeTimeDescription(followup.followupDate)}
                        </Badge>
                      </div>
                      
                      <div className="mt-1 flex items-center justify-between">
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatDate(followup.followupDate)}
                          </span>
                          
                          {followup.assignedToName && (
                            <>
                              <User className="h-3 w-3 ml-2 mr-1 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {followup.assignedToName}
                              </span>
                            </>
                          )}
                        </div>
                        
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2"
                            onClick={() => openReminderDialog(followup.id)}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                          <Link to={`/call-logs/${followup.id}`}>
                            <Button variant="ghost" size="sm" className="h-6 px-2">
                              <Phone className="h-3 w-3" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2"
                            onClick={() => completeFollowupMutation.mutate(followup.id)}
                            disabled={completeFollowupMutation.isPending}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {overdueFollowups.length > maxItems && (
                  <div className="text-center pt-2">
                    <Link to="/call-logs?filter=overdue">
                      <Button variant="link" size="sm">
                        {t('callLogs.notifications.viewMore', { count: overdueFollowups.length - maxItems })}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
      
      <CardFooter className="flex justify-between">
        <p className="text-xs text-muted-foreground">
          {t('callLogs.notifications.refreshNote')}
        </p>
        <Link to="/call-logs">
          <Button variant="outline" size="sm">
            <Phone className="h-4 w-4 mr-2" />
            {t('callLogs.notifications.viewAllCalls')}
          </Button>
        </Link>
      </CardFooter>
      
      {/* Reminder Dialog */}
      <AlertDialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('callLogs.notifications.sendReminder')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('callLogs.notifications.sendReminderDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-2">
            <Textarea
              value={reminderNote}
              onChange={(e) => setReminderNote(e.target.value)}
              placeholder={t('callLogs.notifications.reminderNote')}
              className="min-h-[100px]"
            />
            
            <div className="flex items-center space-x-2">
              <Switch
                id="send-email"
                checked={sendEmailChecked}
                onCheckedChange={setSendEmailChecked}
              />
              <Label htmlFor="send-email">
                {t('callLogs.notifications.sendEmail')}
              </Label>
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={sendReminder}
              disabled={sendReminderMutation.isPending}
            >
              {sendReminderMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background mr-2"></div>
                  {t('common.sending')}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {t('callLogs.notifications.send')}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default CallNotificationCenter;