import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/context/SidebarContext';
import { PageHeader } from '@/components/common/PageHeader';
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
  const [activeTab, setActiveTab] = React.useState('all');
  
  React.useEffect(() => {
    setCurrentPage(t('callLogs.title'));
  }, [setCurrentPage, t]);

  const { data: callLogs, isLoading, isError } = useQuery<CallLog[]>({
    queryKey: ['/api/call-logs'],
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('common.errorLoadingData'),
        variant: 'destructive',
      });
    }
  });

  const filteredCallLogs = React.useMemo(() => {
    if (!callLogs) return [];
    
    if (activeTab === 'scheduled') {
      return callLogs.filter(call => 
        call.callType === 'scheduled' && 
        new Date(call.callDate) > new Date()
      );
    }
    
    if (activeTab === 'followup') {
      return callLogs.filter(call => call.needsFollowup);
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader 
          title={t('callLogs.pageTitle')}
          description={t('callLogs.pageDescription')}
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="p-4">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
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
              <i className="fas fa-redo mr-2"></i>
              {t('common.refresh')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader 
        title={t('callLogs.pageTitle')}
        description={t('callLogs.pageDescription')}
        actions={
          <Button>
            <i className="fas fa-plus mr-2"></i>
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
                <Button>
                  <i className="fas fa-plus mr-2"></i>
                  {t('callLogs.addNewCall')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCallLogs.map((call) => (
                <Card key={call.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base line-clamp-1">{call.subject}</CardTitle>
                      <Badge 
                        variant="outline" 
                        className={getCallTypeColor(call.callType)}
                      >
                        {t(`callLogs.form.callTypes.${call.callType}`)}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-1">
                      {call.customerName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="text-sm">
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">{t('callLogs.details.date')}:</span>
                        <span>{formatDate(call.callDate)}</span>
                      </div>
                      
                      {call.outcome && (
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">{t('callLogs.details.outcome')}:</span>
                          <span>{t(`callLogs.form.outcomes.${call.outcome}`)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">{t('callLogs.details.priority')}:</span>
                        <Badge 
                          variant="outline" 
                          className={getPriorityColor(call.priority)}
                        >
                          {t(`callLogs.form.priorities.${call.priority}`)}
                        </Badge>
                      </div>
                      
                      {call.needsFollowup && call.followupDate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('callLogs.details.followupDate')}:</span>
                          <span className="font-medium">{formatDate(call.followupDate)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <div className="flex items-center justify-between p-4 pt-0">
                    <Button variant="ghost" size="sm">
                      <i className="fas fa-eye mr-2"></i>
                      {t('callLogs.viewCall')}
                    </Button>
                    <Button variant="ghost" size="sm">
                      <i className="fas fa-edit mr-2"></i>
                      {t('callLogs.editCall')}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CallLogs;