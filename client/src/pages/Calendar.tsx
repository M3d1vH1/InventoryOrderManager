import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/el';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/context/SidebarContext';
import { PageHeader } from '@/components/common/PageHeader';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Set up localizer for the calendar
const localizer = momentLocalizer(moment);

// Define event types
type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'created' | 'shipped' | 'call';
  orderNumber?: string;
  customerName: string;
  callDetails?: string;
};

// Order type definition
type Order = {
  id: number;
  orderNumber: string;
  status: 'shipped' | 'pending' | 'cancelled' | 'picked';
  customerName: string;
  orderDate: string;
  shippedDate?: string;
  notes: string | null;
};

// Call log type definition
type CallLog = {
  id: number;
  customerName: string;
  phoneNumber: string;
  callType: string;
  callDate: string;
  scheduledDate: string | null;
  summary: string;
  status: string;
  userId: number;
  callDirection: 'inbound' | 'outbound';
  followUpRequired: boolean;
  followUpDate: string | null;
};

const CalendarPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { setCurrentPage } = useSidebar();
  const [view, setView] = React.useState('month');

  useEffect(() => {
    setCurrentPage(t('calendar.title'));
    
    // Set moment locale based on the app locale
    moment.locale(i18n.language);
    
  }, [setCurrentPage, t, i18n.language]);

  // Fetch orders
  const { data: orders, isLoading: ordersLoading, isError: ordersError } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch call logs
  const { data: callLogs, isLoading: callsLoading, isError: callsError } = useQuery<CallLog[]>({
    queryKey: ['/api/call-logs'],
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Transform orders and call logs to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    const calendarEvents: CalendarEvent[] = [];
    
    // Add order creation events
    if (orders && Array.isArray(orders)) {
      orders.forEach((order: Order) => {
      const orderDate = new Date(order.orderDate);
      
      // Order created event
      calendarEvents.push({
        id: `created-${order.id}`,
        title: `${t('calendar.orderCreated')}: ${order.orderNumber}`,
        start: orderDate,
        end: orderDate,
        type: 'created',
        orderNumber: order.orderNumber,
        customerName: order.customerName
      });
      
      // Order shipped event (if applicable)
      if (order.status === 'shipped' && order.shippedDate) {
        const shippedDate = new Date(order.shippedDate);
        calendarEvents.push({
          id: `shipped-${order.id}`,
          title: `${t('calendar.orderShipped')}: ${order.orderNumber}`,
          start: shippedDate,
          end: shippedDate,
          type: 'shipped',
          orderNumber: order.orderNumber,
          customerName: order.customerName
        });
      }
    });
    }

    // Add call log events
    if (callLogs && Array.isArray(callLogs)) {
      (callLogs as CallLog[]).forEach((call: CallLog) => {
        // Only add scheduled calls
        if (call.scheduledDate) {
          const scheduledDate = new Date(call.scheduledDate);
          calendarEvents.push({
            id: `call-${call.id}`,
            title: `${t('calendar.scheduledCall')}: ${call.customerName}`,
            start: scheduledDate,
            end: scheduledDate,
            type: 'call',
            customerName: call.customerName,
            callDetails: call.summary
          });
        }

        // Add follow-up events
        if (call.followUpRequired && call.followUpDate) {
          const followUpDate = new Date(call.followUpDate);
          calendarEvents.push({
            id: `followup-${call.id}`,
            title: `${t('calendar.followUpCall')}: ${call.customerName}`,
            start: followUpDate,
            end: followUpDate,
            type: 'call',
            customerName: call.customerName,
            callDetails: call.summary
          });
        }
      });
    }
    
    return calendarEvents;
  }, [orders, callLogs, t]);

  // Filter events based on the selected tab
  const filteredEvents = useMemo(() => {
    if (view === 'created') {
      return events.filter(event => event.type === 'created');
    } else if (view === 'shipped') {
      return events.filter(event => event.type === 'shipped');
    } else if (view === 'calls') {
      return events.filter(event => event.type === 'call');
    }
    return events;
  }, [events, view]);

  // Custom event styling
  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor;
    
    // Determine color based on event type
    if (event.type === 'created') {
      backgroundColor = '#4F46E5'; // Blue for order created
    } else if (event.type === 'shipped') {
      backgroundColor = '#10B981'; // Green for shipped
    } else if (event.type === 'call') {
      backgroundColor = '#F59E0B'; // Amber for calls
    } else {
      backgroundColor = '#6B7280'; // Gray default
    }
    
    let style = {
      backgroundColor,
      borderRadius: '4px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block'
    };
    
    return {
      style
    };
  };

  // Loading state
  if (ordersLoading || callsLoading) {
    return (
      <div className="space-y-4">
        <PageHeader 
          title={t('calendar.pageTitle')}
          description={t('calendar.pageDescription')}
        />
        <Card>
          <CardHeader>
            <CardTitle>{t('common.loading')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[600px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (ordersError || callsError) {
    return (
      <div className="space-y-4">
        <PageHeader 
          title={t('calendar.pageTitle')}
          description={t('calendar.pageDescription')}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">{t('common.error')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{t('common.errorLoadingData')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader 
        title={t('calendar.pageTitle')}
        description={t('calendar.pageDescription')}
      />

      <Tabs value={view} onValueChange={setView} className="w-full">
        <TabsList className="grid w-full md:w-auto grid-cols-4 mb-4">
          <TabsTrigger value="month">{t('calendar.allEvents')}</TabsTrigger>
          <TabsTrigger value="created">{t('calendar.ordersCreated')}</TabsTrigger>
          <TabsTrigger value="shipped">{t('calendar.ordersShipped')}</TabsTrigger>
          <TabsTrigger value="calls">{t('calendar.customerCalls')}</TabsTrigger>
        </TabsList>

        <TabsContent value={view} className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex flex-wrap gap-2">
                <Badge className="bg-[#4F46E5]">{t('calendar.orderCreated')}</Badge>
                <Badge className="bg-[#10B981]">{t('calendar.orderShipped')}</Badge>
                <Badge className="bg-[#F59E0B]">{t('calendar.customerCalls')}</Badge>
              </div>

              <div className="h-[600px]">
                <BigCalendar
                  localizer={localizer}
                  events={filteredEvents}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: '100%' }}
                  eventPropGetter={eventStyleGetter}
                  views={['month', 'week', 'day', 'agenda']}
                  messages={{
                    next: t('calendar.controls.next'),
                    previous: t('calendar.controls.previous'),
                    today: t('calendar.controls.today'),
                    month: t('calendar.controls.month'),
                    week: t('calendar.controls.week'),
                    day: t('calendar.controls.day'),
                    agenda: t('calendar.controls.agenda'),
                    date: t('calendar.controls.date'),
                    time: t('calendar.controls.time'),
                    event: t('calendar.controls.event'),
                    noEventsInRange: t('calendar.controls.noEventsInRange'),
                  }}
                  tooltipAccessor={(event: any) => {
                    if (event.type === 'call') {
                      return `${event.customerName} - ${event.callDetails || t('calendar.noCallDetails')}`;
                    }
                    return `${event.customerName} - ${event.orderNumber || ''}`;
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CalendarPage;