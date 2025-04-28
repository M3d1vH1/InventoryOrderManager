import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
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
  CardFooter,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, ChevronLeft, ChevronRight, Clock, DollarSign, Factory, FileText, Package, Phone, Tag, User } from 'lucide-react';

// Set up localizer for the calendar
const localizer = momentLocalizer(moment);

// Define event types
type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'created' | 'shipped' | 'estimated' | 'call' | 'payment' | 'inventory' | 'production';
  orderNumber?: string;
  customerName: string;
  callDetails?: string;
  callId?: number;
  orderId?: number;
  isFollowUp?: boolean;
  isCallback?: boolean;
  paymentId?: number;
  paymentAmount?: number;
  supplierName?: string;
  invoiceNumber?: string;
  callbackRequired?: boolean;
  callbackDate?: Date;
  callbackNotes?: string;
  inventoryType?: 'restock' | 'audit' | 'adjustment';
  productId?: number;
  productName?: string;
  productionBatchId?: number;
  productionStage?: 'start' | 'complete' | 'estimated';
  recipeName?: string;
  productionQuantity?: number;
};

// Order type definition
type Order = {
  id: number;
  orderNumber: string;
  status: 'shipped' | 'pending' | 'cancelled' | 'picked';
  customerName: string;
  orderDate: string;
  shippedDate?: string;
  estimatedShippingDate?: string;
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
  const [filterView, setFilterView] = useState('month');
  const [calendarView, setCalendarView] = useState<any>(Views.MONTH);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [_, navigate] = useLocation();

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
  
  // Fetch supplier payments
  const { data: payments, isLoading: paymentsLoading, isError: paymentsError } = useQuery({
    queryKey: ['/api/supplier-payments/payments'],
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Fetch supplier invoices
  const { data: invoices, isLoading: invoicesLoading, isError: invoicesError } = useQuery({
    queryKey: ['/api/supplier-payments/invoices'],
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch inventory events
  const { data: inventoryEvents, isLoading: inventoryLoading, isError: inventoryError } = useQuery({
    queryKey: ['/api/inventory/events'],
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch production batches
  const { data: productionBatches, isLoading: productionLoading, isError: productionError } = useQuery({
    queryKey: ['/api/production/batches'],
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
        customerName: order.customerName,
        orderId: order.id
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
          customerName: order.customerName,
          orderId: order.id
        });
      }
      
      // Estimated shipping date event (if applicable)
      if (order.estimatedShippingDate && order.status !== 'shipped' && order.status !== 'cancelled') {
        const estimatedDate = new Date(order.estimatedShippingDate);
        calendarEvents.push({
          id: `estimated-${order.id}`,
          title: `${t('calendar.estimatedShipping')}: ${order.orderNumber}`,
          start: estimatedDate,
          end: estimatedDate,
          type: 'estimated',
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          orderId: order.id
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
            callDetails: call.summary,
            callId: call.id,
            isFollowUp: false
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
            callDetails: call.summary,
            callId: call.id,
            isFollowUp: true
          });
        }
      });
    }
    
    // Add supplier payment events
    if (payments && Array.isArray(payments)) {
      payments.forEach((payment: any) => {
        const paymentDate = new Date(payment.paymentDate);
        
        // Get supplier name from related invoice and supplier
        let supplierName = t('common.unknown');
        if (invoices && Array.isArray(invoices)) {
          const relatedInvoice = invoices.find((invoice: any) => invoice.id === payment.invoiceId);
          if (relatedInvoice) {
            supplierName = relatedInvoice.supplierName || t('common.unknown');
          }
        }
        
        // Payment event
        calendarEvents.push({
          id: `payment-${payment.id}`,
          title: `${t('calendar.payment')}: ${supplierName}`,
          start: paymentDate,
          end: paymentDate,
          type: 'payment',
          customerName: supplierName, // Required field in CalendarEvent type
          supplierName: supplierName,
          paymentId: payment.id,
          paymentAmount: payment.amount,
          callbackRequired: payment.callbackRequired || false,
          callbackDate: payment.callbackDate ? new Date(payment.callbackDate) : undefined,
          callbackNotes: payment.callbackNotes || ''
        });
        
        // Add callback event if required
        if (payment.callbackRequired && payment.callbackDate) {
          const callbackDate = new Date(payment.callbackDate);
          calendarEvents.push({
            id: `payment-callback-${payment.id}`,
            title: `${t('calendar.paymentCallback')}: ${supplierName}`,
            start: callbackDate,
            end: callbackDate,
            type: 'payment',
            customerName: supplierName, // Required field in CalendarEvent type
            supplierName: supplierName,
            paymentId: payment.id,
            callbackRequired: true,
            callbackDate: callbackDate,
            callbackNotes: payment.callbackNotes || ''
          });
        }
      });
    }
    
    // Add inventory events
    if (inventoryEvents && Array.isArray(inventoryEvents)) {
      inventoryEvents.forEach((event: any) => {
        const eventDate = new Date(event.date);
        
        calendarEvents.push({
          id: `inventory-${event.id}`,
          title: `${t('calendar.inventory')}: ${event.product_name || t('common.unknown')}`,
          start: eventDate,
          end: eventDate,
          type: 'inventory',
          inventoryType: event.event_type,
          productId: event.product_id,
          productName: event.product_name,
          customerName: event.product_name || t('common.unknown') // Reusing customerName field for consistent rendering
        });
      });
    }
    
    // Add production batch events
    if (productionBatches && Array.isArray(productionBatches)) {
      productionBatches.forEach((batch: any) => {
        // Production start date
        if (batch.start_date) {
          const startDate = new Date(batch.start_date);
          calendarEvents.push({
            id: `production-start-${batch.id}`,
            title: `${t('calendar.productionStart')}: ${batch.recipe_name || t('common.unknown')}`,
            start: startDate,
            end: startDate,
            type: 'production',
            productionBatchId: batch.id,
            productionStage: 'start',
            recipeName: batch.recipe_name,
            productionQuantity: batch.quantity,
            customerName: batch.recipe_name || t('common.unknown') // Reusing customerName field for display
          });
        }
        
        // Production completion date
        if (batch.completion_date) {
          const completionDate = new Date(batch.completion_date);
          calendarEvents.push({
            id: `production-complete-${batch.id}`,
            title: `${t('calendar.productionComplete')}: ${batch.recipe_name || t('common.unknown')}`,
            start: completionDate,
            end: completionDate,
            type: 'production',
            productionBatchId: batch.id,
            productionStage: 'complete',
            recipeName: batch.recipe_name,
            productionQuantity: batch.quantity,
            customerName: batch.recipe_name || t('common.unknown') // Reusing customerName field for display
          });
        }
        
        // Estimated completion date (if not completed yet)
        if (batch.estimated_completion_date && !batch.completion_date) {
          const estimatedDate = new Date(batch.estimated_completion_date);
          calendarEvents.push({
            id: `production-estimated-${batch.id}`,
            title: `${t('calendar.productionEstimated')}: ${batch.recipe_name || t('common.unknown')}`,
            start: estimatedDate,
            end: estimatedDate,
            type: 'production',
            productionBatchId: batch.id,
            productionStage: 'estimated',
            recipeName: batch.recipe_name,
            productionQuantity: batch.quantity,
            customerName: batch.recipe_name || t('common.unknown') // Reusing customerName field for display
          });
        }
      });
    }
    
    return calendarEvents;
  }, [orders, callLogs, payments, invoices, inventoryEvents, productionBatches, t]);

  // Filter events based on the selected tab
  const filteredEvents = useMemo(() => {
    switch(filterView) {
      case 'orders':
        return events.filter(event => ['created', 'shipped', 'estimated'].includes(event.type));
      case 'calls':
        return events.filter(event => event.type === 'call');
      case 'payments':
        return events.filter(event => event.type === 'payment');
      case 'inventory':
        return events.filter(event => event.type === 'inventory');
      case 'production':
        return events.filter(event => event.type === 'production');
      case 'all':
      default:
        return events;
    }
  }, [events, filterView]);
  
  // Get upcoming events for the sidebar
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    
    return events
      .filter(event => {
        return event.start >= now && event.start <= nextWeek;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5);
  }, [events]);
  
  // Format relative date for upcoming events
  const getRelativeDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const eventDate = new Date(date);
    eventDate.setHours(0, 0, 0, 0);
    
    if (eventDate.getTime() === today.getTime()) {
      return t('calendar.today');
    } else if (eventDate.getTime() === tomorrow.getTime()) {
      return t('calendar.tomorrow');
    } else {
      const diffDays = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return t('calendar.inXDays', { days: diffDays });
    }
  };

  // Custom event styling
  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor;
    let borderLeft;
    
    // Determine color based on event type
    if (event.type === 'created') {
      backgroundColor = '#4F46E5'; // Blue for order created
    } else if (event.type === 'shipped') {
      backgroundColor = '#10B981'; // Green for shipped
    } else if (event.type === 'estimated') {
      backgroundColor = '#8B5CF6'; // Purple for estimated shipping date
      borderLeft = '3px solid #7C3AED';
    } else if (event.type === 'call') {
      if (event.isFollowUp) {
        backgroundColor = '#F43F5E'; // Pink for follow-up calls
        borderLeft = '3px solid #BE185D';
      } else {
        backgroundColor = '#F59E0B'; // Amber for scheduled calls
        borderLeft = '3px solid #D97706';
      }
    } else if (event.type === 'payment') {
      if (event.callbackRequired) {
        backgroundColor = '#EC4899'; // Pink for payment callbacks
        borderLeft = '3px solid #BE185D';
      } else {
        backgroundColor = '#14B8A6'; // Teal for regular payments
        borderLeft = '3px solid #0F766E';
      }
    } else if (event.type === 'inventory') {
      backgroundColor = '#06B6D4'; // Cyan for inventory
      borderLeft = '3px solid #0E7490';
    } else if (event.type === 'production') {
      if (event.productionStage === 'start') {
        backgroundColor = '#2563EB'; // Blue for production start
        borderLeft = '3px solid #1D4ED8';
      } else if (event.productionStage === 'complete') {
        backgroundColor = '#16A34A'; // Green for production complete
        borderLeft = '3px solid #15803D';
      } else {
        backgroundColor = '#7C3AED'; // Purple for estimated completion
        borderLeft = '3px solid #6D28D9';
      }
    } else {
      backgroundColor = '#6B7280'; // Gray default
    }
    
    let style = {
      backgroundColor,
      borderRadius: '4px',
      opacity: 0.9,
      color: 'white',
      border: '0px',
      display: 'block',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontSize: '0.8rem',
      borderLeft
    };
    
    return {
      style
    };
  };
  
  // Handle event click
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };
  
  // Handle view customer
  const handleViewCustomer = () => {
    // Future implementation: Navigate to customer details
    toast({
      title: "Feature coming soon",
      description: "Customer details navigation will be available in a future update",
    });
    setIsEventModalOpen(false);
  };
  
  // Handle view order
  const handleViewOrder = () => {
    if (selectedEvent?.orderId) {
      navigate(`/orders/${selectedEvent.orderId}`);
      setIsEventModalOpen(false);
    }
  };
  
  // Handle view call
  const handleViewCall = () => {
    if (selectedEvent?.callId) {
      navigate(`/call-logs/${selectedEvent.callId}`);
      setIsEventModalOpen(false);
    }
  };
  
  // Handle new call log
  const handleNewCallLog = () => {
    navigate("/call-logs/new");
    setIsEventModalOpen(false);
  };

  // Loading state
  if (ordersLoading || callsLoading || paymentsLoading || invoicesLoading || inventoryLoading || productionLoading) {
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
  if (ordersError || callsError || paymentsError || invoicesError || inventoryError || productionError) {
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Tabs value={filterView} onValueChange={setFilterView} className="w-full">
            <TabsList className="grid grid-cols-6 gap-1 w-full mb-4">
              <TabsTrigger value="all" className="px-1 py-1 h-auto text-[10px] sm:text-xs md:text-sm whitespace-nowrap">{t('calendar.allEvents')}</TabsTrigger>
              <TabsTrigger value="orders" className="px-1 py-1 h-auto text-[10px] sm:text-xs md:text-sm whitespace-nowrap">{t('calendar.orders')}</TabsTrigger>
              <TabsTrigger value="calls" className="px-1 py-1 h-auto text-[10px] sm:text-xs md:text-sm whitespace-nowrap">{t('calendar.calls')}</TabsTrigger>
              <TabsTrigger value="payments" className="px-1 py-1 h-auto text-[10px] sm:text-xs md:text-sm whitespace-nowrap">{t('calendar.payments')}</TabsTrigger>
              <TabsTrigger value="inventory" className="px-1 py-1 h-auto text-[10px] sm:text-xs md:text-sm whitespace-nowrap">{t('calendar.inventory')}</TabsTrigger>
              <TabsTrigger value="production" className="px-1 py-1 h-auto text-[10px] sm:text-xs md:text-sm whitespace-nowrap">{t('calendar.production')}</TabsTrigger>
            </TabsList>

            <TabsContent value={filterView} className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {/* Show legend based on the selected tab */}
                    {(filterView === 'all' || filterView === 'orders') && (
                      <>
                        <Badge className="bg-[#4F46E5]">{t('calendar.orderCreated')}</Badge>
                        <Badge className="bg-[#10B981]">{t('calendar.orderShipped')}</Badge>
                        <Badge className="bg-[#8B5CF6]">{t('calendar.estimatedShipping')}</Badge>
                      </>
                    )}
                    {(filterView === 'all' || filterView === 'calls') && (
                      <>
                        <Badge className="bg-[#F59E0B]">{t('calendar.scheduledCall')}</Badge>
                        <Badge className="bg-[#F43F5E]">{t('calendar.followUpCall')}</Badge>
                      </>
                    )}
                    {(filterView === 'all' || filterView === 'payments') && (
                      <>
                        <Badge className="bg-[#14B8A6]">{t('calendar.payment')}</Badge>
                        <Badge className="bg-[#EC4899]">{t('calendar.paymentCallback')}</Badge>
                      </>
                    )}
                    {(filterView === 'all' || filterView === 'inventory') && (
                      <Badge className="bg-[#06B6D4]">{t('calendar.inventory')}</Badge>
                    )}
                    {(filterView === 'all' || filterView === 'production') && (
                      <>
                        <Badge className="bg-[#2563EB]">{t('calendar.productionStart')}</Badge>
                        <Badge className="bg-[#16A34A]">{t('calendar.productionComplete')}</Badge>
                        <Badge className="bg-[#7C3AED]">{t('calendar.productionEstimated')}</Badge>
                      </>
                    )}
                  </div>

                  <div className="h-[500px] md:h-[600px]">
                    <BigCalendar
                      localizer={localizer}
                      events={filteredEvents}
                      startAccessor="start"
                      endAccessor="end"
                      style={{ height: '100%' }}
                      eventPropGetter={eventStyleGetter}
                      views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                      view={calendarView}
                      onView={(view) => setCalendarView(view)}
                      components={{
                        toolbar: props => (
                          <div className="flex flex-col space-y-3 mb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex gap-1">
                                <button 
                                  type="button" 
                                  onClick={() => props.onNavigate('PREV')}
                                  className="inline-flex items-center justify-center h-7 w-7 text-xs font-medium rounded-md border border-input bg-background hover:bg-accent"
                                >
                                  <ChevronLeft className="h-3 w-3" />
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => props.onNavigate('NEXT')}
                                  className="inline-flex items-center justify-center h-7 w-7 text-xs font-medium rounded-md border border-input bg-background hover:bg-accent"
                                >
                                  <ChevronRight className="h-3 w-3" />
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => props.onNavigate('TODAY')}
                                  className="inline-flex items-center justify-center h-7 px-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 ml-1"
                                >
                                  {t('calendar.controls.today')}
                                </button>
                              </div>
                              <span className="text-xs sm:text-sm font-medium">
                                {moment(props.date).format('MMMM YYYY')}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-4 gap-1">
                              <button 
                                type="button" 
                                onClick={() => props.onView('month')}
                                className={`inline-flex items-center justify-center h-7 px-1 text-[10px] sm:text-xs font-medium rounded-md ${props.view === 'month' 
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                                  : 'border border-input bg-background hover:bg-accent'
                                }`}
                              >
                                {t('calendar.controls.month')}
                              </button>
                              <button 
                                type="button" 
                                onClick={() => props.onView('week')}
                                className={`inline-flex items-center justify-center h-7 px-1 text-[10px] sm:text-xs font-medium rounded-md ${props.view === 'week' 
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                                  : 'border border-input bg-background hover:bg-accent'
                                }`}
                              >
                                {t('calendar.controls.week')}
                              </button>
                              <button 
                                type="button" 
                                onClick={() => props.onView('day')}
                                className={`inline-flex items-center justify-center h-7 px-1 text-[10px] sm:text-xs font-medium rounded-md ${props.view === 'day' 
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                                  : 'border border-input bg-background hover:bg-accent'
                                }`}
                              >
                                {t('calendar.controls.day')}
                              </button>
                              <button 
                                type="button" 
                                onClick={() => props.onView('agenda')}
                                className={`inline-flex items-center justify-center h-7 px-1 text-[10px] sm:text-xs font-medium rounded-md ${props.view === 'agenda' 
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                                  : 'border border-input bg-background hover:bg-accent'
                                }`}
                              >
                                {t('calendar.controls.agenda')}
                              </button>
                            </div>
                          </div>
                        )
                      }}
                      onNavigate={(date) => setSelectedDate(date)}
                      date={selectedDate}
                      onSelectEvent={handleEventClick}
                      popup
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
                        } else if (event.type === 'payment') {
                          if (event.callbackRequired) {
                            return `${event.supplierName} - ${t('supplierPayments.callbackRequired')}: ${t('common.yes')}`;
                          }
                          return `${event.supplierName} - ${t('supplierPayments.amount')}: ${event.paymentAmount?.toFixed(2) || ''}`;
                        } else if (event.type === 'inventory') {
                          return `${event.productName} - ${
                            event.inventoryType === 'restock' ? t('inventory.restock') :
                            event.inventoryType === 'audit' ? t('inventory.audit') :
                            t('inventory.adjustment')
                          }`;
                        } else if (event.type === 'production') {
                          return `${event.recipeName} - ${
                            event.productionStage === 'start' ? t('production.started') :
                            event.productionStage === 'complete' ? t('production.completed') :
                            t('production.estimatedCompletion')
                          } - ${t('production.quantity')}: ${event.productionQuantity || ''}`;
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
        
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('calendar.upcomingEvents')}</CardTitle>
              <CardDescription>{t('calendar.today')}</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] md:h-[400px] overflow-auto">
              {upcomingEvents.length > 0 ? (
                <ul className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <li key={event.id} className="flex flex-col space-y-1">
                      <div 
                        className="p-3 border rounded-md cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => handleEventClick(event)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {event.type === 'created' && (
                              <Badge className="bg-[#4F46E5]">{t('calendar.orderCreated')}</Badge>
                            )}
                            {event.type === 'shipped' && (
                              <Badge className="bg-[#10B981]">{t('calendar.orderShipped')}</Badge>
                            )}
                            {event.type === 'estimated' && (
                              <Badge className="bg-[#8B5CF6]">{t('calendar.estimatedShipping')}</Badge>
                            )}
                            {event.type === 'call' && event.isFollowUp && (
                              <Badge className="bg-[#F43F5E]">{t('calendar.followUpCall')}</Badge>
                            )}
                            {event.type === 'call' && !event.isFollowUp && (
                              <Badge className="bg-[#F59E0B]">{t('calendar.scheduledCall')}</Badge>
                            )}
                            {event.type === 'payment' && !event.callbackRequired && (
                              <Badge className="bg-[#14B8A6]">{t('calendar.payment')}</Badge>
                            )}
                            {event.type === 'payment' && event.callbackRequired && (
                              <Badge className="bg-[#EC4899]">{t('calendar.paymentCallback')}</Badge>
                            )}
                            {event.type === 'inventory' && (
                              <Badge className="bg-[#06B6D4]">{t('calendar.inventory')}</Badge>
                            )}
                            {event.type === 'production' && event.productionStage === 'start' && (
                              <Badge className="bg-[#2563EB]">{t('calendar.productionStart')}</Badge>
                            )}
                            {event.type === 'production' && event.productionStage === 'complete' && (
                              <Badge className="bg-[#16A34A]">{t('calendar.productionComplete')}</Badge>
                            )}
                            {event.type === 'production' && event.productionStage === 'estimated' && (
                              <Badge className="bg-[#7C3AED]">{t('calendar.productionEstimated')}</Badge>
                            )}
                            <span className="text-sm font-medium">{getRelativeDate(event.start)}</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="mt-2">
                          <div className="flex items-start space-x-2">
                            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <span className="text-sm">{event.customerName}</span>
                          </div>
                          {event.orderNumber && (
                            <div className="flex items-start space-x-2 mt-1">
                              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <span className="text-sm">{event.orderNumber}</span>
                            </div>
                          )}
                          {event.callDetails && (
                            <div className="flex items-start space-x-2 mt-1">
                              <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <span className="text-sm truncate">{event.callDetails}</span>
                            </div>
                          )}
                          
                          {/* Payment specific info */}
                          {event.type === 'payment' && event.paymentAmount && (
                            <div className="flex items-start space-x-2 mt-1">
                              <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <span className="text-sm">{event.paymentAmount.toFixed(2)}</span>
                            </div>
                          )}
                          
                          {/* Inventory specific info */}
                          {event.type === 'inventory' && event.inventoryType && (
                            <div className="flex items-start space-x-2 mt-1">
                              <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <span className="text-sm">
                                {event.inventoryType === 'restock' && t('inventory.restock')}
                                {event.inventoryType === 'audit' && t('inventory.audit')}
                                {event.inventoryType === 'adjustment' && t('inventory.adjustment')}
                              </span>
                            </div>
                          )}
                          
                          {/* Production specific info */}
                          {event.type === 'production' && event.productionQuantity && (
                            <div className="flex items-start space-x-2 mt-1">
                              <Factory className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <span className="text-sm">{t('production.quantity')}: {event.productionQuantity}</span>
                            </div>
                          )}
                          <div className="flex items-start space-x-2 mt-1">
                            <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <span className="text-sm">{moment(event.start).format('h:mm A')}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <CalendarIcon className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">{t('calendar.noUpcomingEvents')}</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="outline" onClick={handleNewCallLog}>
                {t('calendar.newCallLog')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      {/* Event Details Modal */}
      <Dialog open={isEventModalOpen} onOpenChange={setIsEventModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('calendar.viewEventDetails')}</DialogTitle>
            <DialogDescription>
              {selectedEvent?.title}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('calendar.eventType')}</span>
                {selectedEvent?.type === 'created' && (
                  <Badge className="bg-[#4F46E5]">{t('calendar.orderCreated')}</Badge>
                )}
                {selectedEvent?.type === 'shipped' && (
                  <Badge className="bg-[#10B981]">{t('calendar.orderShipped')}</Badge>
                )}
                {selectedEvent?.type === 'estimated' && (
                  <Badge className="bg-[#8B5CF6]">{t('calendar.estimatedShipping')}</Badge>
                )}
                {selectedEvent?.type === 'call' && selectedEvent?.isFollowUp && (
                  <Badge className="bg-[#F43F5E]">{t('calendar.followUpCall')}</Badge>
                )}
                {selectedEvent?.type === 'call' && !selectedEvent?.isFollowUp && (
                  <Badge className="bg-[#F59E0B]">{t('calendar.scheduledCall')}</Badge>
                )}
                {selectedEvent?.type === 'payment' && !selectedEvent?.callbackRequired && (
                  <Badge className="bg-[#14B8A6]">{t('calendar.payment')}</Badge>
                )}
                {selectedEvent?.type === 'payment' && selectedEvent?.callbackRequired && (
                  <Badge className="bg-[#EC4899]">{t('calendar.paymentCallback')}</Badge>
                )}
                {selectedEvent?.type === 'inventory' && (
                  <Badge className="bg-[#06B6D4]">{t('calendar.inventory')}</Badge>
                )}
                {selectedEvent?.type === 'production' && selectedEvent?.productionStage === 'start' && (
                  <Badge className="bg-[#2563EB]">{t('calendar.productionStart')}</Badge>
                )}
                {selectedEvent?.type === 'production' && selectedEvent?.productionStage === 'complete' && (
                  <Badge className="bg-[#16A34A]">{t('calendar.productionComplete')}</Badge>
                )}
                {selectedEvent?.type === 'production' && selectedEvent?.productionStage === 'estimated' && (
                  <Badge className="bg-[#7C3AED]">{t('calendar.productionEstimated')}</Badge>
                )}
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('calendar.customer')}</span>
                <span className="text-sm">{selectedEvent?.customerName}</span>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('calendar.date')}</span>
                <span className="text-sm">
                  {selectedEvent?.start ? moment(selectedEvent.start).format('MMMM Do YYYY, h:mm a') : ''}
                </span>
              </div>
              
              {selectedEvent?.orderNumber && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t('calendar.orderNumber')}</span>
                    <span className="text-sm">{selectedEvent.orderNumber}</span>
                  </div>
                </>
              )}
              
              {selectedEvent?.callDetails && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm font-medium">{t('calendar.details')}</span>
                    <p className="text-sm mt-1">{selectedEvent.callDetails}</p>
                  </div>
                </>
              )}
              
              {/* Payment details */}
              {selectedEvent?.type === 'payment' && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm font-medium">{t('supplierPayments.supplier')}</span>
                    <p className="text-sm mt-1">{selectedEvent.supplierName}</p>
                  </div>
                  
                  {selectedEvent.paymentAmount && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{t('supplierPayments.amount')}</span>
                        <span className="text-sm">{selectedEvent.paymentAmount.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  
                  {selectedEvent.callbackRequired && (
                    <>
                      <Separator />
                      <div>
                        <span className="text-sm font-medium">{t('supplierPayments.callbackRequired')}</span>
                        <p className="text-sm mt-1">{t('common.yes')}</p>
                        
                        {selectedEvent.callbackDate && (
                          <div className="mt-2">
                            <span className="text-sm font-medium">{t('supplierPayments.callbackDate')}</span>
                            <p className="text-sm mt-1">
                              {moment(selectedEvent.callbackDate).format('MMMM Do YYYY')}
                            </p>
                          </div>
                        )}
                        
                        {selectedEvent.callbackNotes && (
                          <div className="mt-2">
                            <span className="text-sm font-medium">{t('supplierPayments.callbackNotes')}</span>
                            <p className="text-sm mt-1">{selectedEvent.callbackNotes}</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
              
              {/* Inventory details */}
              {selectedEvent?.type === 'inventory' && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm font-medium">{t('inventory.product')}</span>
                    <p className="text-sm mt-1">{selectedEvent.productName}</p>
                  </div>
                  
                  <Separator />
                  <div>
                    <span className="text-sm font-medium">{t('inventory.eventType')}</span>
                    <p className="text-sm mt-1">
                      {selectedEvent.inventoryType === 'restock' && t('inventory.restock')}
                      {selectedEvent.inventoryType === 'audit' && t('inventory.audit')}
                      {selectedEvent.inventoryType === 'adjustment' && t('inventory.adjustment')}
                    </p>
                  </div>
                </>
              )}
              
              {/* Production details */}
              {selectedEvent?.type === 'production' && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm font-medium">{t('production.recipe')}</span>
                    <p className="text-sm mt-1">{selectedEvent.recipeName}</p>
                  </div>
                  
                  {selectedEvent.productionQuantity && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{t('production.quantity')}</span>
                        <span className="text-sm">{selectedEvent.productionQuantity}</span>
                      </div>
                    </>
                  )}
                  
                  <Separator />
                  <div>
                    <span className="text-sm font-medium">{t('production.stage')}</span>
                    <p className="text-sm mt-1">
                      {selectedEvent.productionStage === 'start' && t('production.started')}
                      {selectedEvent.productionStage === 'complete' && t('production.completed')}
                      {selectedEvent.productionStage === 'estimated' && t('production.estimatedCompletion')}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            {/* Order related buttons */}
            {(selectedEvent?.type === 'created' || selectedEvent?.type === 'shipped' || selectedEvent?.type === 'estimated') && (
              <Button type="button" onClick={handleViewOrder}>
                {t('calendar.viewOrder')}
              </Button>
            )}
            
            {/* Call related buttons */}
            {selectedEvent?.type === 'call' && (
              <Button type="button" onClick={handleViewCall}>
                {t('calendar.viewCall')}
              </Button>
            )}
            
            {/* Payment related buttons */}
            {selectedEvent?.type === 'payment' && selectedEvent.paymentId && (
              <Button type="button" onClick={() => {
                navigate(`/supplier-payments/${selectedEvent.paymentId}`);
                setIsEventModalOpen(false);
              }}>
                {t('supplierPayments.viewPayment')}
              </Button>
            )}
            
            {/* Inventory related buttons */}
            {selectedEvent?.type === 'inventory' && selectedEvent.productId && (
              <Button type="button" onClick={() => {
                navigate(`/products/${selectedEvent.productId}`);
                setIsEventModalOpen(false);
              }}>
                {t('inventory.viewProduct')}
              </Button>
            )}
            
            {/* Production related buttons */}
            {selectedEvent?.type === 'production' && selectedEvent.productionBatchId && (
              <Button type="button" onClick={() => {
                navigate(`/production/batches/${selectedEvent.productionBatchId}`);
                setIsEventModalOpen(false);
              }}>
                {t('production.viewBatch')}
              </Button>
            )}
            
            {/* Common buttons */}
            {selectedEvent?.type !== 'inventory' && selectedEvent?.type !== 'production' && (
              <Button type="button" variant="outline" onClick={handleViewCustomer}>
                {t('calendar.viewCustomer')}
              </Button>
            )}
            
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('calendar.close')}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;