import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/el';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/context/SidebarContext';
import { PageHeader } from '@/components/common/PageHeader';
import { useLocation } from 'wouter';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Set up localizer for the calendar
const localizer = momentLocalizer(moment);

const SimpleCalendar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { setCurrentPage } = useSidebar();
  const [_, navigate] = useLocation();

  useEffect(() => {
    setCurrentPage(t('calendar.title'));
    
    // Set moment locale based on the app locale
    moment.locale(i18n.language);
  }, [setCurrentPage, t, i18n.language]);
  
  // Fetch orders
  const { data: orders, isLoading: ordersLoading, isError: ordersError } = useQuery({
    queryKey: ['/api/orders'],
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Simple events calculation
  const events = React.useMemo(() => {
    const calendarEvents = [];
    
    try {
      if (orders && Array.isArray(orders)) {
        for (const order of orders) {
          if (!order || !order.orderDate) continue;
          
          const start = new Date(order.orderDate);
          if (isNaN(start.getTime())) continue;
          
          calendarEvents.push({
            id: `order-${order.id}`,
            title: `Order: ${order.orderNumber || 'Unknown'}`,
            start,
            end: start,
            allDay: true
          });
        }
      }
    } catch (error) {
      console.error('Error preparing calendar events:', error);
    }
    
    return calendarEvents;
  }, [orders]);
  
  // Loading state
  if (ordersLoading) {
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
  if (ordersError) {
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
      <Card>
        <CardContent className="pt-6">
          <div className="h-[600px]">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              views={['month', 'week', 'day', 'agenda']}
              messages={{
                today: t('calendar.today'),
                previous: t('calendar.previous'),
                next: t('calendar.next'),
                month: t('calendar.month'),
                week: t('calendar.week'),
                day: t('calendar.day'),
                agenda: t('calendar.agenda'),
                date: t('calendar.date'),
                time: t('calendar.time'),
                event: t('calendar.event'),
                noEventsInRange: t('calendar.noEvents'),
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleCalendar;