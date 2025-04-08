import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  Clock,
  Phone,
  User,
  FileText,
  Tag,
  AlertTriangle,
  CheckCircle,
  Bell,
  Edit,
  ChevronLeft,
  MessageCircle,
  X
} from 'lucide-react';

import CallOutcomeList from './CallOutcomeList';
import CallLogForm from './CallLogForm';

interface CallLogDetailProps {
  callId: number;
  onBack: () => void;
}

const CallLogDetail: React.FC<CallLogDetailProps> = ({ callId, onBack }) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editFormOpen, setEditFormOpen] = useState(false);

  // Fetch call log details
  const { data: callLog, isLoading, isError, refetch } = useQuery({
    queryKey: [`/api/call-logs/${callId}`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/call-logs/${callId}`, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch call log details');
        }
        
        return response.json();
      } catch (error) {
        console.error('Error fetching call log details:', error);
        throw error;
      }
    },
    enabled: !!callId,
  });

  // Format date taking into account i18n
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'PPP', {
        locale: i18n.language === 'el' ? el : undefined
      });
    } catch (e) {
      console.error('Date formatting error:', e);
      return dateString;
    }
  };

  // Get appropriate color for call type badge
  const getCallTypeColor = (type: string) => {
    switch (type) {
      case 'inbound':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'outbound':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'missed':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'scheduled':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return '';
    }
  };

  // Get appropriate color for priority badge
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-slate-50 text-slate-700 border-slate-200';
      case 'normal':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'high':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'urgent':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return '';
    }
  };

  // Handle setting a reminder for follow-up
  const handleSetReminder = async () => {
    try {
      const response = await fetch(`/api/call-logs/${callId}/reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to set reminder');
      }

      toast({
        title: t('callLogs.reminders.successTitle'),
        description: t('callLogs.reminders.successDescription'),
        variant: 'default',
      });

      // Refresh call log data
      queryClient.invalidateQueries({ queryKey: [`/api/call-logs/${callId}`] });
    } catch (error) {
      console.error('Error setting reminder:', error);
      toast({
        title: t('common.error'),
        description: t('callLogs.reminders.errorDescription'),
        variant: 'destructive',
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="mb-4">
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('common.back')}
          </Button>
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  // Error state
  if (isError || !callLog) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t('common.back')}
        </Button>
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">{t('common.error')}</CardTitle>
            <CardDescription>{t('callLogs.detailsLoadError')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="p-2">
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('common.back')}
          </Button>
          <Button onClick={() => setEditFormOpen(true)}>
            <Edit className="mr-1 h-4 w-4" />
            {t('callLogs.editCall')}
          </Button>
        </div>

        {/* Call Summary Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl">{callLog.subject}</CardTitle>
                <CardDescription className="mt-1">
                  <div className="flex flex-wrap gap-2 mt-1">
                    <Badge variant="outline" className={getCallTypeColor(callLog.callType)}>
                      <Phone className="mr-1 h-3 w-3" />
                      {t(`callLogs.form.callTypes.${callLog.callType}`)}
                    </Badge>
                    <Badge variant="outline" className={getPriorityColor(callLog.priority)}>
                      {
                        callLog.priority === 'urgent' 
                          ? <AlertTriangle className="mr-1 h-3 w-3" />
                          : callLog.priority === 'high'
                            ? <AlertTriangle className="mr-1 h-3 w-3" />
                            : <Tag className="mr-1 h-3 w-3" />
                      }
                      {t(`callLogs.form.priorities.${callLog.priority}`)}
                    </Badge>
                    {callLog.isFollowup && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        <MessageCircle className="mr-1 h-3 w-3" />
                        {t('callLogs.followupCall')}
                      </Badge>
                    )}
                  </div>
                </CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">
                {t('callLogs.callId')}: {callLog.id}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <User className="mr-2 h-4 w-4 text-slate-400" />
                  <span className="text-muted-foreground mr-2">{t('callLogs.customer')}:</span>
                  <span className="font-medium">{callLog.customerName}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Calendar className="mr-2 h-4 w-4 text-slate-400" />
                  <span className="text-muted-foreground mr-2">{t('callLogs.callDate')}:</span>
                  <span className="font-medium">
                    {formatDate(callLog.callDate)}
                    {callLog.callTime && ` ${callLog.callTime}`}
                  </span>
                </div>
                {callLog.duration && (
                  <div className="flex items-center text-sm">
                    <Clock className="mr-2 h-4 w-4 text-slate-400" />
                    <span className="text-muted-foreground mr-2">{t('callLogs.duration')}:</span>
                    <span className="font-medium">
                      {callLog.duration} {t('callLogs.minutes')}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                {callLog.followupDate && (
                  <div className="p-3 rounded-md bg-amber-50 border border-amber-100 flex items-start">
                    <div className="text-amber-600 mr-3 mt-0.5">
                      <Bell className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-amber-800">
                        {t('callLogs.followupScheduled')}
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        {formatDate(callLog.followupDate)}
                        {callLog.followupTime && ` ${callLog.followupTime}`}
                      </p>
                      {!callLog.reminderSent && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2 h-8 bg-white hover:bg-white" 
                          onClick={handleSetReminder}
                        >
                          <Bell className="mr-1 h-3 w-3" />
                          {t('callLogs.setReminder')}
                        </Button>
                      )}
                      {callLog.reminderSent && (
                        <div className="flex items-center mt-2 text-green-600 text-xs">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          {t('callLogs.reminderSet')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {!callLog.followupDate && !callLog.isFollowup && (
                  <div className="p-3 rounded-md bg-slate-50 border border-slate-100 flex items-start">
                    <div className="text-slate-400 mr-3 mt-0.5">
                      <X className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-600">
                        {t('callLogs.noFollowupScheduled')}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        {t('callLogs.editToSchedule')}
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2 h-8" 
                        onClick={() => setEditFormOpen(true)}
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        {t('callLogs.scheduleFollowup')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Call Notes */}
            {callLog.notes && (
              <>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <div className="flex items-center text-sm font-medium">
                    <FileText className="mr-2 h-4 w-4 text-slate-400" />
                    {t('callLogs.notes')}:
                  </div>
                  <div className="p-3 rounded-md bg-slate-50 text-sm whitespace-pre-line">
                    {callLog.notes}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Call Outcomes */}
        <Tabs defaultValue="outcomes" className="w-full">
          <TabsList className="grid w-full md:w-auto grid-cols-2 mb-4">
            <TabsTrigger value="outcomes">{t('callLogs.outcomes.title')}</TabsTrigger>
            <TabsTrigger value="history">{t('callLogs.history')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="outcomes" className="space-y-4">
            <CallOutcomeList callId={callId} />
          </TabsContent>
          
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('callLogs.history')}</CardTitle>
                <CardDescription>
                  {t('callLogs.historyDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Display call history/audit log here */}
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('callLogs.historyEmpty')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Call Edit Form Dialog */}
      <CallLogForm
        open={editFormOpen}
        onOpenChange={setEditFormOpen}
        initialData={callLog}
        mode="edit"
      />
    </>
  );
};

export default CallLogDetail;