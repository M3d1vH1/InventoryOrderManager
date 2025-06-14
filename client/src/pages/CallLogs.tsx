import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/context/SidebarContext';
import { PageHeader } from '@/components/common/PageHeader';
import { useParams, useLocation } from 'wouter';
import {
  Card,
  CardContent,
  CardDescription,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { 
  Phone, 
  PhoneOutgoing, 
  PhoneMissed, 
  CalendarClock, 
  Eye, 
  Edit, 
  Bell, 
  Plus,
  RefreshCw,
  Tag
} from 'lucide-react';
import CallLogForm from '@/components/call-logs/CallLogForm';
import CallLogDetail from '@/components/call-logs/CallLogDetail';

type CallLog = {
  id: number;
  callType: string;
  customerId: number;
  customerName: string;
  callDate: string;
  duration: number;
  subject: string;
  notes: string | null;
  outcome: string | null;
  assignedToId: number | null;
  assignedToName: string | null;
  priority: string;
  needsFollowup: boolean;
  followupDate: string | null;
  createdAt: string;
  updatedAt: string;
};

const CallLogs: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { setCurrentPage } = useSidebar();
  const params = useParams();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [detailView, setDetailView] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null);
  
  // Check for call ID in the URL params and set detail view
  useEffect(() => {
    if (params && params.id) {
      const callId = parseInt(params.id, 10);
      if (!isNaN(callId)) {
        setDetailView(true);
        setSelectedCallId(callId);
      }
    }
  }, [params]);
  
  React.useEffect(() => {
    setCurrentPage(t('callLogs.title'));
  }, [setCurrentPage, t]);

  const { data: callLogs, isLoading, isError } = useQuery<CallLog[]>({
    queryKey: ['/api/call-logs'],
    // Use onError inside options
    queryFn: async ({ signal }) => {
      try {
        const response = await fetch('/api/call-logs', { 
          signal,
          credentials: 'include' // Ensure cookies are sent
        });
        if (!response.ok) {
          if (response.status === 401) {
            toast({
              title: t('common.unauthorizedError'),
              description: t('common.pleaseLogin'),
              variant: 'destructive',
            });
            // Give time for toast to show before redirect
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
            return [];
          }
          throw new Error('Failed to fetch call logs');
        }
        return response.json();
      } catch (error) {
        console.error("Call logs error:", error);
        toast({
          title: t('common.error'),
          description: t('common.errorLoadingData'),
          variant: 'destructive',
        });
        return []; // Return empty array instead of throwing to prevent unhandled rejection
      }
    },
    retry: false // Don't retry on error
  });

  const filteredCallLogs = React.useMemo(() => {
    if (!callLogs) return [];
    
    if (activeTab === 'scheduled') {
      // Filter all scheduled calls that are in the future
      return callLogs.filter(call => {
        try {
          const callDate = new Date(call.callDate);
          const now = new Date();
          return call.callType === 'scheduled' && callDate > now;
        } catch(e) {
          console.error('Error parsing date:', e);
          return false;
        }
      });
    }
    
    if (activeTab === 'followup') {
      // Filter all calls that need followup or have pending action items
      return callLogs.filter(call => {
        if (call.needsFollowup) return true;
        
        // Also include calls that have a future followup date
        if (call.followupDate) {
          try {
            const followupDate = new Date(call.followupDate);
            const now = new Date();
            return followupDate > now;
          } catch(e) {
            console.error('Error parsing followup date:', e);
          }
        }
        
        return false;
      });
    }
    
    return callLogs;
  }, [callLogs, activeTab]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'PPp', { locale: i18n.language === 'el' ? el : undefined });
    } catch (e) {
      return dateStr;
    }
  };

  const getCallTypeColor = (type: string) => {
    switch (type) {
      case 'inbound': return 'bg-green-100 text-green-800';
      case 'outbound': return 'bg-blue-100 text-blue-800';
      case 'missed': return 'bg-red-100 text-red-800';
      case 'scheduled': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'urgent': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleNewCallClick = () => {
    setSelectedCallLog(null);
    setFormMode('create');
    setFormOpen(true);
  };

  const handleEditCallClick = (call: CallLog) => {
    setSelectedCallLog(call);
    setFormMode('edit');
    setFormOpen(true);
  };

  const handleViewCallClick = (call: CallLog) => {
    setDetailView(true);
    setSelectedCallId(call.id);
    // Update URL to include the call ID
    setLocation(`/call-logs/${call.id}`);
  };
  
  const handleBackFromDetail = () => {
    setDetailView(false);
    setSelectedCallId(null);
    // Update URL to remove the ID parameter
    setLocation('/call-logs');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader 
          title={t('callLogs.pageTitle')}
          description={t('callLogs.pageDescription')}
        />
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="py-3 px-4 font-medium">{t('callLogs.columns.date')}</th>
                <th className="py-3 px-4 font-medium">{t('callLogs.columns.customer')}</th>
                <th className="py-3 px-4 font-medium">{t('callLogs.columns.subject')}</th>
                <th className="py-3 px-4 font-medium">{t('callLogs.columns.type')}</th>
                <th className="py-3 px-4 font-medium">{t('callLogs.columns.priority')}</th>
                <th className="py-3 px-4 font-medium">{t('callLogs.columns.followup')}</th>
                <th className="py-3 px-4 font-medium text-right">{t('callLogs.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(6)].map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                  <td className="py-3 px-4"><Skeleton className="h-4 w-28" /></td>
                  <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                  <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                  <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                  <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <PageHeader 
          title={t('callLogs.pageTitle')}
          description={t('callLogs.pageDescription')}
        />
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">{t('common.error')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{t('common.errorLoadingData')}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('common.refresh')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If we're in detail view mode, show the call log detail component
  if (detailView && selectedCallId) {
    return <CallLogDetail callId={selectedCallId} onBack={handleBackFromDetail} />;
  }
  
  return (
    <>
      <div className="space-y-4">
        <PageHeader 
          title={t('callLogs.pageTitle')}
          description={t('callLogs.pageDescription')}
          actions={
            <Button onClick={handleNewCallClick}>
              <Plus className="mr-2 h-4 w-4" />
              {t('callLogs.addNewCall')}
            </Button>
          }
        />

        <Tabs 
          defaultValue="all" 
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full md:w-auto grid-cols-3 mb-4">
            <TabsTrigger value="all">{t('callLogs.allCalls')}</TabsTrigger>
            <TabsTrigger value="scheduled">{t('callLogs.scheduledCalls')}</TabsTrigger>
            <TabsTrigger value="followup">{t('callLogs.needsFollowup')}</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {filteredCallLogs.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('callLogs.noCallsFound')}</CardTitle>
                  <CardDescription>
                    {activeTab === 'all' 
                      ? t('callLogs.noCallsFound')
                      : activeTab === 'scheduled'
                        ? t('callLogs.noCallsFound')
                        : t('callLogs.noCallsFound')
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleNewCallClick}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('callLogs.addNewCall')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="py-3 px-4 font-medium">{t('callLogs.columns.date')}</th>
                      <th className="py-3 px-4 font-medium">{t('callLogs.columns.customer')}</th>
                      <th className="py-3 px-4 font-medium">{t('callLogs.columns.subject')}</th>
                      <th className="py-3 px-4 font-medium">{t('callLogs.columns.type')}</th>
                      <th className="py-3 px-4 font-medium">{t('callLogs.columns.priority')}</th>
                      <th className="py-3 px-4 font-medium">{t('callLogs.columns.followup')}</th>
                      <th className="py-3 px-4 font-medium text-right">{t('callLogs.columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCallLogs.map((call) => (
                      <tr key={call.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          {formatDate(call.callDate)}
                        </td>
                        <td className="py-3 px-4">
                          {call.customerName || call.contactName || 'Unknown'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="max-w-[200px] truncate">{call.subject}</div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge 
                            variant="outline" 
                            className={getCallTypeColor(call.callType)}
                          >
                            <span className="flex items-center">
                              {call.callType === 'inbound' ? (
                                <Phone className="mr-1 h-3 w-3" />
                              ) : call.callType === 'outbound' ? (
                                <PhoneOutgoing className="mr-1 h-3 w-3" />
                              ) : call.callType === 'missed' ? (
                                <PhoneMissed className="mr-1 h-3 w-3" />
                              ) : (
                                <CalendarClock className="mr-1 h-3 w-3" />
                              )}
                              {t(`callLogs.form.callTypes.${call.callType}`)}
                            </span>
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge 
                            variant="outline" 
                            className={getPriorityColor(call.priority)}
                          >
                            <span className="flex items-center">
                              <Tag className="mr-1 h-3 w-3" />
                              {t(`callLogs.form.priorities.${call.priority}`)}
                            </span>
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {call.needsFollowup && call.followupDate ? (
                            <div className="whitespace-nowrap text-amber-600 flex items-center">
                              <Bell className="mr-1 h-3 w-3" />
                              {formatDate(call.followupDate)}
                            </div>
                          ) : call.needsFollowup ? (
                            <div className="text-amber-600 flex items-center">
                              <Bell className="mr-1 h-3 w-3" />
                              {t('callLogs.needsFollowup')}
                            </div>
                          ) : (
                            <div className="text-muted-foreground">—</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleViewCallClick(call)}
                              title={t('callLogs.viewCall')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleEditCallClick(call)}
                              title={t('callLogs.editCall')}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CallLogForm 
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={selectedCallLog}
        mode={formMode}
      />
    </>
  );
};

export default CallLogs;