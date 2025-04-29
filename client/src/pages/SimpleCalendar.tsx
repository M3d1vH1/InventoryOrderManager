import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, momentLocalizer } from 'react-big-calendar';
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
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { X, Package, Calendar as CalendarIcon, DollarSign, Factory, Tag, Phone, Maximize2, Minimize2 } from 'lucide-react';

// Set up localizer for the calendar
const localizer = momentLocalizer(moment);

// Full screen calendar component
const FullCalendar = ({ title, icon, events, color, onClose }) => {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState('day');
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  const headerBgClass = 
    color === 'blue' ? 'bg-blue-50' : 
    color === 'emerald' ? 'bg-emerald-50' :
    color === 'green' ? 'bg-green-50' :
    color === 'amber' ? 'bg-amber-50' :
    color === 'purple' ? 'bg-purple-50' : '';
  
  const handleEventClick = (event) => {
    try {
      if (event.resource) {
        // Determine where to navigate based on the event type
        if (event.id.startsWith('order-')) {
          navigate(`/orders/${event.resource.id}`);
        } else if (event.id.startsWith('call-')) {
          navigate(`/call-logs/${event.resource.id}`);
        } else if (event.id.startsWith('payment-')) {
          navigate(`/supplier-payments?id=${event.resource.id}`);
        } else if (event.id.startsWith('inventory-')) {
          navigate(`/inventory?product=${event.resource.productId || ''}`);
        } else if (event.id.startsWith('production-')) {
          navigate(`/production/batches/${event.resource.id}`);
        }
      }
    } catch (error) {
      console.error('Error navigating from calendar event:', error);
      toast({
        title: t('common.error'),
        description: t('common.navigationError'),
        variant: 'destructive',
      });
    }
  };
  
  return (
    <>
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <DialogDescription className="sr-only">{t('calendar.fullCalendarDescription')}</DialogDescription>
      
      <div className="flex flex-col h-full w-full">
        <div className={`flex items-center justify-between p-4 ${headerBgClass}`}>
          <div className="flex items-center space-x-3">
            {icon}
            <h2 className="text-xl font-semibold">{title}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => setView('month')}>
              {t('calendar.month')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setView('week')}>
              {t('calendar.week')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setView('day')}>
              {t('calendar.day')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setView('agenda')}>
              {t('calendar.agenda')}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="flex-1 p-4 w-full">
          <Calendar
            localizer={localizer}
            events={events || []}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 'calc(85vh - 120px)', width: '100%' }}
            min={new Date(new Date().setHours(9, 0, 0))}
            max={new Date(new Date().setHours(17, 0, 0))}
            view={view}
            onView={setView}
            views={['month', 'week', 'day', 'agenda']}
            onSelectEvent={handleEventClick}
            components={{
              event: ({ event }) => (
                <div className="text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                  {event.title || ''}
                </div>
              ),
              // Hide time labels completely from the event display
              eventWrapper: ({ event, children }) => (
                <div title={typeof event === 'object' && event !== null && 'title' in event ? String(event.title) : ''}>
                  {children}
                </div>
              )
            }}
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
              showMore: (count) => t('calendar.showMore', { count }),
              allDay: t('calendar.allDay')
            }}
            eventPropGetter={(event) => {
              return {
                style: {
                  backgroundColor: (
                    typeof event === 'object' && event !== null && 'backgroundColor' in event ? 
                    event.backgroundColor : 
                    color === 'blue' ? '#3b82f6' : 
                    color === 'emerald' ? '#10b981' :
                    color === 'green' ? '#22c55e' :
                    color === 'amber' ? '#f59e0b' :
                    color === 'purple' ? '#8b5cf6' : '#3b82f6'
                  ),
                  cursor: 'pointer'
                }
              };
            }}
          />
        </div>
      </div>
    </>
  );
};

// Mini calendar component for each quadrant
const MiniCalendar = ({ title, icon, events, color, onNavigate, onExpand = () => {} }) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  
  const handleExpand = (e) => {
    e.stopPropagation();
    setIsOpen(true);
    if (onExpand) onExpand();
  };
  
  const headerBgClass = 
    color === 'blue' ? 'bg-blue-50' : 
    color === 'emerald' ? 'bg-emerald-50' :
    color === 'green' ? 'bg-green-50' :
    color === 'amber' ? 'bg-amber-50' :
    color === 'purple' ? 'bg-purple-50' : '';
  
  return (
    <>
      <Card className="h-full transition-all hover:shadow-md">
        <CardHeader className={`py-2 ${headerBgClass}`}>
          <div className="flex items-center justify-between">
            <div className="flex-1"></div>
            <div className="flex items-center space-x-2 justify-center">
              {icon}
              <CardTitle className="text-lg">{title}</CardTitle>
            </div>
            <div className="flex-1 flex justify-end">
              <Button variant="ghost" size="sm" onClick={handleExpand} className="flex items-center">
                <Maximize2 className="h-4 w-4 mr-1" />
                <span className="text-xs">{t('calendar.expand')}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <div className="h-[calc(25vh_+_60px)] min-h-[220px] max-h-[350px] w-full cursor-pointer" onClick={handleExpand}>
            <Calendar
              localizer={localizer}
              events={events || []}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              views={['work_week']}
              defaultView="work_week"
              toolbar={false}
              formats={{
                timeGutterFormat: (date, culture, localizer) => 
                  localizer.format(date, 'HH:mm', culture),
                dayFormat: (date, culture, localizer) =>
                  localizer.format(date, 'ddd', culture),
              }}
              min={new Date(new Date().setHours(9, 0, 0))}
              max={new Date(new Date().setHours(17, 0, 0))}
              components={{
                toolbar: () => null, // Ensure toolbar is hidden
                event: ({ event }) => (
                  <div className="text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                    {event.title || ''}
                  </div>
                ),
                // Hide time labels completely from the event display
                eventWrapper: ({ event, children }) => (
                  <div title={typeof event === 'object' && event !== null && 'title' in event ? String(event.title) : ''}>
                    {children}
                  </div>
                )
              }}
              messages={{
                noEventsInRange: t('calendar.noEvents'),
              }}
              onSelectEvent={() => {
                // Prevent default action which causes errors
                return false;
              }}
              eventPropGetter={(event) => {
                return {
                  style: {
                    backgroundColor: (
                      typeof event === 'object' && event !== null && 'backgroundColor' in event ? 
                      event.backgroundColor : 
                      color === 'blue' ? '#3b82f6' : 
                      color === 'emerald' ? '#10b981' :
                      color === 'green' ? '#22c55e' :
                      color === 'amber' ? '#f59e0b' :
                      color === 'purple' ? '#8b5cf6' : '#3b82f6'
                    )
                  }
                };
              }}
            />
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] h-[90vh]">
          <FullCalendar 
            title={title}
            icon={icon}
            events={events || []}
            color={color}
            onClose={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

const SimpleCalendar = () => {
  const { t, i18n } = useTranslation();
  const { setCurrentPage } = useSidebar();
  const [_, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    setCurrentPage(t('calendar.title'));
    
    // Set moment locale based on the app locale
    moment.locale(i18n.language);
  }, [setCurrentPage, t, i18n.language]);
  
  // Fetch all data sources
  const { data: orders, isLoading: ordersLoading, isError: ordersError } = useQuery({
    queryKey: ['/api/orders'],
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  const { data: callLogs, isLoading: callsLoading, isError: callsError } = useQuery({
    queryKey: ['/api/call-logs'],
    retry: 1, 
    staleTime: 1000 * 60 * 5
  });
  
  const { data: payments, isLoading: paymentsLoading, isError: paymentsError } = useQuery({
    queryKey: ['/api/supplier-payments/payments'],
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });
  
  const { data: inventory, isLoading: inventoryLoading, isError: inventoryError } = useQuery({
    queryKey: ['/api/inventory/events'],
    retry: 1, 
    staleTime: 1000 * 60 * 5,
  });
  
  const { data: production, isLoading: productionLoading, isError: productionError } = useQuery({
    queryKey: ['/api/production/batches'],
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });
  
  // Prepare events for each category
  const orderEvents = React.useMemo(() => {
    const events = [];
    try {
      if (orders && Array.isArray(orders)) {
        for (const order of orders) {
          if (!order || !order.orderDate) continue;
          
          // Add order creation date
          const orderDate = new Date(order.orderDate);
          if (!isNaN(orderDate.getTime())) {
            events.push({
              id: `order-${order.id}`,
              // Simplify title to just show order number and customer name
              title: `${order.orderNumber || ''} - ${order.customerName || t('common.unknown')}`,
              start: orderDate,
              end: orderDate,
              allDay: false,
              resource: order,
              backgroundColor: '#3b82f6' // blue-500
            });
          }
          
          // Add order shipping date if available
          if (order.shippingDate && order.status === 'shipped') {
            const shippingDate = new Date(order.shippingDate);
            if (!isNaN(shippingDate.getTime())) {
              events.push({
                id: `order-shipped-${order.id}`,
                title: `${order.orderNumber || ''} - ${order.customerName || t('common.unknown')} (${t('calendar.shipped')})`,
                start: shippingDate,
                end: shippingDate,
                allDay: false,
                resource: order,
                backgroundColor: '#22c55e' // green-500
              });
            }
          }
          
          // Add delivery date if available and status is delivered
          if (order.deliveryDate && order.status === 'delivered') {
            const deliveryDate = new Date(order.deliveryDate);
            if (!isNaN(deliveryDate.getTime())) {
              events.push({
                id: `order-delivered-${order.id}`,
                title: `${order.orderNumber || ''} - ${order.customerName || t('common.unknown')} (${t('calendar.delivered')})`,
                start: deliveryDate,
                end: deliveryDate,
                allDay: false,
                resource: order,
                backgroundColor: '#8b5cf6' // purple-500
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error preparing order events:', error);
    }
    return events;
  }, [orders, t]);

  // Call log events
  const callEvents = React.useMemo(() => {
    const events = [];
    try {
      if (callLogs && Array.isArray(callLogs)) {
        for (const call of callLogs) {
          if (!call || !call.callDate) continue;
          
          const start = new Date(call.callDate);
          if (isNaN(start.getTime())) continue;
          
          events.push({
            id: `call-${call.id}`,
            title: call.customerName || t('common.unknown'),
            start,
            end: start,
            allDay: false,
            resource: call
          });
        }
      }
    } catch (error) {
      console.error('Error preparing call events:', error);
    }
    return events;
  }, [callLogs, t]);
  
  // Payment events
  const paymentEvents = React.useMemo(() => {
    const events = [];
    try {
      if (payments && Array.isArray(payments)) {
        for (const payment of payments) {
          if (!payment || !payment.paymentDate) continue;
          
          const start = new Date(payment.paymentDate);
          if (isNaN(start.getTime())) continue;
          
          events.push({
            id: `payment-${payment.id}`,
            title: `${payment.amount || 0}€`,
            start,
            end: start,
            allDay: false,
            resource: payment
          });
        }
      }
    } catch (error) {
      console.error('Error preparing payment events:', error);
    }
    return events;
  }, [payments]);
  
  // Inventory events
  const inventoryEvents = React.useMemo(() => {
    const events = [];
    try {
      if (inventory && Array.isArray(inventory)) {
        for (const item of inventory) {
          if (!item || !item.date) continue;
          
          const start = new Date(item.date);
          if (isNaN(start.getTime())) continue;
          
          events.push({
            id: `inventory-${item.id}`,
            title: item.productName || t('common.unknown'),
            start,
            end: start,
            allDay: false,
            resource: item
          });
        }
      }
    } catch (error) {
      console.error('Error preparing inventory events:', error);
    }
    return events;
  }, [inventory, t]);
  
  // Production events
  const productionEvents = React.useMemo(() => {
    const events = [];
    try {
      if (production && Array.isArray(production)) {
        for (const batch of production) {
          if (!batch || !batch.startDate) continue;
          
          const start = new Date(batch.startDate);
          if (isNaN(start.getTime())) continue;
          
          events.push({
            id: `production-${batch.id}`,
            title: batch.batchNumber || t('common.unknown'),
            start,
            end: start,
            allDay: false,
            resource: batch
          });
        }
      }
    } catch (error) {
      console.error('Error preparing production events:', error);
    }
    return events;
  }, [production, t]);
  
  // Navigation handlers
  const navigateToOrders = () => {
    try {
      navigate('/orders');
    } catch (error) {
      console.error('Error navigating to orders:', error);
      toast({
        title: t('common.error'),
        description: t('common.navigationError'),
        variant: 'destructive',
      });
    }
  };
  
  const navigateToCalls = () => {
    try {
      navigate('/call-logs');
    } catch (error) {
      console.error('Error navigating to calls:', error);
      toast({
        title: t('common.error'),
        description: t('common.navigationError'),
        variant: 'destructive',
      });
    }
  };
  
  const navigateToPayments = () => {
    try {
      navigate('/supplier-payments');
    } catch (error) {
      console.error('Error navigating to payments:', error);
      toast({
        title: t('common.error'),
        description: t('common.navigationError'),
        variant: 'destructive',
      });
    }
  };
  
  const navigateToInventory = () => {
    try {
      navigate('/inventory');
    } catch (error) {
      console.error('Error navigating to inventory:', error);
      toast({
        title: t('common.error'),
        description: t('common.navigationError'),
        variant: 'destructive',
      });
    }
  };
  
  const navigateToProduction = () => {
    try {
      navigate('/production');
    } catch (error) {
      console.error('Error navigating to production:', error);
      toast({
        title: t('common.error'),
        description: t('common.navigationError'),
        variant: 'destructive',
      });
    }
  };
  
  // Loading state
  if (ordersLoading || callsLoading || paymentsLoading || inventoryLoading || productionLoading) {
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

  // Error state - show partial data if available, but only if we have actual data
  const hasAnyError = ordersError || callsError || paymentsError || inventoryError || productionError;
  const hasAnyData = Boolean(orders?.length || callLogs?.length || payments?.length || inventory?.length || production?.length);

  return (
    <div className="space-y-4">
      <PageHeader 
        title={t('calendar.pageTitle')}
        description={t('calendar.pageDescription')}
      />
      
      {/* Only show error message if there's actually missing critical data and not for supplier API errors */}
      {(ordersError || inventoryError) && hasAnyData && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-md mb-4">
          <p className="font-medium">{t('calendar.partialDataWarning')}</p>
          <p className="text-sm">{t('calendar.someDataMightBeMissing')}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top row: Orders and Payments */}
        <MiniCalendar 
          title={t('calendar.orders')}
          icon={<Package className="h-5 w-5 text-blue-600" />}
          events={orderEvents}
          color="blue"
          onNavigate={navigateToOrders}
        />
        
        <MiniCalendar 
          title={t('calendar.payments')}
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          events={paymentEvents}
          color="emerald"
          onNavigate={navigateToPayments}
        />
        
        {/* Middle row: Inventory and Calls */}
        <MiniCalendar 
          title={t('calendar.inventory')}
          icon={<Tag className="h-5 w-5 text-green-600" />}
          events={inventoryEvents}
          color="green"
          onNavigate={navigateToInventory}
        />
        
        <MiniCalendar 
          title={t('calendar.calls')}
          icon={<Phone className="h-5 w-5 text-amber-600" />}
          events={callEvents}
          color="amber"
          onNavigate={navigateToCalls}
        />
        
        {/* Production calendar - full width */}
        <div className="md:col-span-2">
          <MiniCalendar 
            title={t('calendar.production')}
            icon={<Factory className="h-5 w-5 text-purple-600" />}
            events={productionEvents}
            color="purple"
            onNavigate={navigateToProduction}
          />
        </div>
      </div>
    </div>
  );
};

export default SimpleCalendar;