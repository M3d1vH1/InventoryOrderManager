import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/el';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/context/SidebarContext';
import { useUser } from '@/context/UserContext';
import { PageHeader } from '@/components/common';
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
import { AlertCircle, CalendarIcon, ChevronLeft, ChevronRight, Clock, DollarSign, Factory, FileText, Package, Phone, Tag, User } from 'lucide-react';

// Set up localizer for the calendar
const localizer = momentLocalizer(moment);

// Define event types
type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'created' | 'shipped' | 'estimated' | 'call' | 'payment' | 'inventory' | 'production' | 'invoice';
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
  invoiceId?: number;
  invoiceAmount?: number;
  paidAmount?: number;
  invoiceStatus?: string;
  isOverdue?: boolean;
  isPartiallyPaid?: boolean;
  isPaid?: boolean;
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
  const { user } = useUser();
  const [filterView, setFilterView] = useState('all');
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
    staleTime: 1000 * 60 * 5, // 5 minutes,
    enabled: !!user && !!user.id,
    queryFn: () => apiRequest('/api/orders')
  });

  // Fetch call logs
  const { data: callLogs, isLoading: callsLoading, isError: callsError } = useQuery<CallLog[]>({
    queryKey: ['/api/call-logs'],
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes,
    enabled: !!user && !!user.id,
    queryFn: () => apiRequest('/api/call-logs')
  });
  
  // Fetch supplier payments
  const { data: payments, isLoading: paymentsLoading, isError: paymentsError } = useQuery({
    queryKey: ['/api/supplier-payments/payments'],
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes,
    enabled: !!user && !!user.id,
    queryFn: () => apiRequest('/api/supplier-payments/payments')
  });
  
  // Fetch supplier invoices with enhanced handling
  const { data: invoices, isLoading: invoicesLoading, isError: invoicesError, refetch: refetchInvoices } = useQuery({
    queryKey: ['/api/supplier-payments/invoices'],
    retry: 3, // Increase retry attempts for better resilience
    staleTime: 1000 * 60 * 5, // 5 minutes,
    // IMPORTANT: This endpoint is now public, so we can enable it regardless of auth status
    enabled: true,
    // Use direct fetch instead of apiRequest since this is now a public endpoint
    queryFn: async () => {
      const response = await fetch('/api/supplier-payments/invoices');
      if (!response.ok) {
        throw new Error(`Invoice API responded with status: ${response.status}`);
      }
      return response.json();
    }
  });
  
  // Direct fetch for invoices with backup SQL approach - this ensures we get invoice data one way or another
  const [rawInvoiceData, setRawInvoiceData] = useState<any[]>([]);
  
  useEffect(() => {
    // We always fetch invoices now since it's a public endpoint
    console.log('Starting direct invoice fetch for calendar...');
    
    // Use simple fetch without credentials since this is now a public endpoint
    fetch('/api/supplier-payments/invoices', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Direct fetch invoices result:', data);
        // Store the raw invoice data for processing
        if (Array.isArray(data)) {
          setRawInvoiceData(data);
          console.log(`Successfully loaded ${data.length} invoices for calendar`);
        } else {
          console.warn('Invoice data is not an array:', data);
          setRawInvoiceData([]);
        }
      })
      .catch(error => {
        console.error('Direct fetch invoice error:', error);
        // Show toast for user feedback
        toast({
          title: t('common.error'),
          description: t('calendar.errorLoadingInvoices'),
          variant: 'destructive',
        });
      });
  }, [toast, t]);
  
  // Log the supplier invoices when they change
  useEffect(() => {
    console.log('Supplier invoices data from useQuery:', invoices);
    if (invoicesError) {
      console.error('Error loading supplier invoices:', invoicesError);
    }
  }, [invoices, invoicesError]);

  // Fetch inventory events
  const { data: inventoryEvents, isLoading: inventoryLoading, isError: inventoryError } = useQuery({
    queryKey: ['/api/inventory/events'],
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes,
    enabled: !!user && !!user.id,
    queryFn: () => apiRequest('/api/inventory/events')
  });

  // Fetch production batches
  const { data: productionBatches, isLoading: productionLoading, isError: productionError } = useQuery({
    queryKey: ['/api/production/batches'],
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes,
    enabled: !!user && !!user.id,
    queryFn: () => apiRequest('/api/production/batches')
  });

  // Process orders to calendar events
  const createOrderEvents = (orders: Order[] | undefined): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    
    if (!orders || !Array.isArray(orders)) {
      return events;
    }
    
    for (const order of orders) {
      try {
        if (!order || !order.id || !order.orderDate || !order.orderNumber || !order.customerName) {
          console.warn('Skipping invalid order entry', order);
          continue;
        }
        
        // Order created event
        const orderDate = new Date(order.orderDate);
        if (!isNaN(orderDate.getTime())) {
          events.push({
            id: `created-${order.id}`,
            title: `${t('calendar.orderCreated')}: ${order.orderNumber}`,
            start: orderDate,
            end: orderDate,
            type: 'created',
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            orderId: order.id
          });
        }
        
        // Order shipped event
        if (order.status === 'shipped' && order.shippedDate) {
          const shippedDate = new Date(order.shippedDate);
          if (!isNaN(shippedDate.getTime())) {
            events.push({
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
        }
        
        // Estimated shipping date
        if (order.estimatedShippingDate && order.status !== 'shipped' && order.status !== 'cancelled') {
          const estimatedDate = new Date(order.estimatedShippingDate);
          if (!isNaN(estimatedDate.getTime())) {
            events.push({
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
        }
      } catch (err) {
        console.error('Error processing order for calendar:', err, order?.id);
      }
    }
    
    return events;
  };

  // Process call logs to calendar events
  const createCallEvents = (callLogs: CallLog[] | undefined): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    
    if (!callLogs || !Array.isArray(callLogs)) {
      return events;
    }
    
    for (const call of callLogs) {
      try {
        if (!call || !call.id || !call.customerName) {
          console.warn('Skipping invalid call log entry', call);
          continue;
        }
        
        // Add scheduled calls
        if (call.scheduledDate) {
          const scheduledDate = new Date(call.scheduledDate);
          if (!isNaN(scheduledDate.getTime())) {
            events.push({
              id: `call-${call.id}`,
              title: `${t('calendar.scheduledCall')}: ${call.customerName}`,
              start: scheduledDate,
              end: scheduledDate,
              type: 'call',
              customerName: call.customerName || t('common.unknown'),
              callDetails: call.summary || '',
              callId: call.id,
              isFollowUp: false
            });
          }
        }
        
        // Add follow-up calls
        if (call.followUpRequired && call.followUpDate) {
          const followUpDate = new Date(call.followUpDate);
          if (!isNaN(followUpDate.getTime())) {
            events.push({
              id: `followup-${call.id}`,
              title: `${t('calendar.followUpCall')}: ${call.customerName}`,
              start: followUpDate,
              end: followUpDate,
              type: 'call',
              customerName: call.customerName || t('common.unknown'),
              callDetails: call.summary || '',
              callId: call.id,
              isFollowUp: true
            });
          }
        }
      } catch (err) {
        console.error('Error processing call log for calendar:', err, call?.id);
      }
    }
    
    return events;
  };

  // Process payment events
  const createPaymentEvents = (payments: any[] | undefined, invoices: any[] | undefined): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    
    if (!payments || !Array.isArray(payments)) {
      return events;
    }
    
    for (const payment of payments) {
      try {
        if (!payment || !payment.id) {
          console.warn('Invalid payment data:', payment);
          continue;
        }
        
        // Handle both snake_case and camelCase field names
        const paymentDate = payment.paymentDate || payment.payment_date;
        if (!paymentDate) {
          console.warn('Payment missing date:', payment);
          continue;
        }
        
        const paymentDateObj = new Date(paymentDate);
        if (isNaN(paymentDateObj.getTime())) {
          console.warn('Invalid payment date:', paymentDate);
          continue;
        }
        
        const invoiceId = payment.invoiceId || payment.invoice_id;
        const callbackRequired = payment.callbackRequired || payment.callback_required || false;
        const callbackDate = payment.callbackDate || payment.callback_date;
        const callbackNotes = payment.callbackNotes || payment.callback_notes || '';
        
        // Find supplier name from related invoice
        let supplierName = t('common.unknown');
        if (invoices && Array.isArray(invoices) && invoices.length > 0) {
          const relatedInvoice = invoices.find((invoice: any) => 
            invoice && invoice.id === invoiceId
          );
          
          if (relatedInvoice) {
            supplierName = relatedInvoice.supplierName || relatedInvoice.supplier_name || t('common.unknown');
          }
        }
        
        // Add payment event
        events.push({
          id: `payment-${payment.id}`,
          title: `${t('calendar.payment')}: ${supplierName}`,
          start: paymentDateObj,
          end: paymentDateObj,
          type: 'payment',
          customerName: supplierName, // Required field in CalendarEvent type
          supplierName: supplierName,
          paymentId: payment.id,
          paymentAmount: parseFloat(payment.amount || '0'),
          callbackRequired: callbackRequired,
          callbackDate: callbackDate ? new Date(callbackDate) : undefined,
          callbackNotes: callbackNotes
        });
        
        // Add callback event if required
        if (callbackRequired && callbackDate) {
          try {
            const callbackDateObj = new Date(callbackDate);
            if (!isNaN(callbackDateObj.getTime())) {
              events.push({
                id: `payment-callback-${payment.id}`,
                title: `${t('calendar.paymentCallback')}: ${supplierName}`,
                start: callbackDateObj,
                end: callbackDateObj,
                type: 'payment',
                customerName: supplierName,
                supplierName: supplierName,
                paymentId: payment.id,
                callbackRequired: true,
                callbackDate: callbackDateObj,
                callbackNotes: callbackNotes
              });
            }
          } catch (callbackErr) {
            console.error('Error processing payment callback date:', callbackErr);
          }
        }
      } catch (err) {
        console.error('Error processing payment for calendar:', err, payment?.id);
      }
    }
    
    return events;
  };
  
  // Process invoice events with enhanced error handling and data normalization
  const createInvoiceEvents = (invoices: any[] | undefined): CalendarEvent[] => {
    console.log('Creating invoice events from data:', invoices?.length || 0, 'invoices available');
    const events: CalendarEvent[] = [];
    
    if (!invoices || !Array.isArray(invoices)) {
      console.warn('No valid invoices data received or not an array');
      return events;
    }
    
    console.log(`Starting to process ${invoices.length} invoices for calendar events`);
    
    // Define a function to normalize invoice fields consistently
    const normalizeInvoice = (invoice: any) => {
      if (!invoice) return null;
      
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber || invoice.invoice_number || '',
        supplierName: invoice.supplierName || invoice.supplier_name || t('common.unknown'),
        dueDate: invoice.dueDate || invoice.due_date,
        invoiceDate: invoice.invoiceDate || invoice.invoice_date,
        status: invoice.status || 'pending',
        amount: parseFloat(invoice.amount || '0'),
        paidAmount: parseFloat(invoice.paidAmount || invoice.paid_amount || '0')
      };
    };
    
    for (const invoice of invoices) {
      try {
        if (!invoice || !invoice.id) {
          console.warn('Invalid invoice data, skipping:', invoice);
          continue;
        }
        
        // Normalize invoice data to handle different field formats
        const normalizedInvoice = normalizeInvoice(invoice);
        if (!normalizedInvoice) {
          console.warn('Failed to normalize invoice data:', invoice);
          continue;
        }
        
        console.log(`Processing invoice ${normalizedInvoice.id}:`, {
          invoiceNumber: normalizedInvoice.invoiceNumber,
          dueDate: normalizedInvoice.dueDate,
          status: normalizedInvoice.status
        });
        
        // Prioritize due date, fall back to invoice date if needed
        const dueDateStr = normalizedInvoice.dueDate || normalizedInvoice.invoiceDate;
        if (!dueDateStr) {
          console.warn(`Invoice ${normalizedInvoice.id} missing due date, skipping`);
          continue;
        }
        
        let dueDateObj;
        try {
          dueDateObj = new Date(dueDateStr);
          if (isNaN(dueDateObj.getTime())) {
            // Try alternative date parsing formats
            const dateParts = dueDateStr.split(/[\/\-\.]/);
            if (dateParts.length === 3) {
              // Try different date formats (MM/DD/YYYY, DD/MM/YYYY, YYYY/MM/DD)
              const possibleFormats = [
                new Date(`${dateParts[2]}-${dateParts[0]}-${dateParts[1]}`), // MM/DD/YYYY
                new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`), // DD/MM/YYYY
                new Date(`${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`)  // YYYY/MM/DD
              ];
              
              // Find the first valid date
              dueDateObj = possibleFormats.find(d => !isNaN(d.getTime()));
              
              if (!dueDateObj) {
                throw new Error(`Could not parse date string: ${dueDateStr}`);
              }
            } else {
              throw new Error(`Invalid date format: ${dueDateStr}`);
            }
          }
        } catch (dateError) {
          console.warn(`Invalid invoice due date format for invoice ${normalizedInvoice.id}:`, dueDateStr, dateError);
          continue;
        }
        
        console.log(`Invoice ${normalizedInvoice.id} due date:`, {
          rawDueDate: dueDateStr,
          parsedDate: dueDateObj.toISOString(),
          isValid: !isNaN(dueDateObj.getTime())
        });
        
        // Determine invoice status flags with safe defaults
        const isPaid = normalizedInvoice.status === 'paid';
        const isPartiallyPaid = normalizedInvoice.status === 'partially_paid';
        const isOverdue = normalizedInvoice.status === 'overdue';
        
        // Create appropriate title based on status
        let title = '';
        if (isPaid) {
          title = `${t('calendar.invoicePaid')}: ${normalizedInvoice.supplierName}`;
        } else if (isPartiallyPaid) {
          title = `${t('calendar.invoicePartiallyPaid')}: ${normalizedInvoice.supplierName}`;
        } else if (isOverdue) {
          title = `${t('calendar.invoiceOverdue')}: ${normalizedInvoice.supplierName}`;
        } else {
          title = `${t('calendar.invoiceDue')}: ${normalizedInvoice.supplierName}`;
        }
        
        // Generate unique invoice ID with prefix to avoid collisions
        const eventId = `invoice-${normalizedInvoice.id}`;
        
        // Add invoice event with all needed details
        events.push({
          id: eventId,
          title: title,
          start: dueDateObj,
          end: dueDateObj,
          type: 'invoice',
          customerName: normalizedInvoice.supplierName, // Required field in CalendarEvent type
          supplierName: normalizedInvoice.supplierName,
          invoiceId: normalizedInvoice.id,
          invoiceNumber: normalizedInvoice.invoiceNumber,
          invoiceAmount: normalizedInvoice.amount,
          paidAmount: normalizedInvoice.paidAmount,
          invoiceStatus: normalizedInvoice.status,
          isPaid,
          isPartiallyPaid,
          isOverdue
        });
        
        console.log(`Successfully created calendar event for invoice ${normalizedInvoice.id}`);
      } catch (err) {
        console.error('Error processing invoice for calendar:', err, invoice?.id);
      }
    }
    
    console.log(`Created ${events.length} invoice events for calendar`);
    return events;
  };

  // Process inventory events
  const createInventoryEvents = (inventoryEvents: any[] | undefined): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    
    if (!inventoryEvents || !Array.isArray(inventoryEvents)) {
      return events;
    }
    
    for (const event of inventoryEvents) {
      try {
        if (!event || !event.id || !event.date) {
          console.warn('Invalid inventory event data:', event);
          continue;
        }
        
        const eventDate = new Date(event.date);
        if (isNaN(eventDate.getTime())) {
          console.warn('Invalid inventory event date:', event.date);
          continue;
        }
        
        // Check if we have camelCase or snake_case fields
        const productName = event.productName || event.product_name || t('common.unknown');
        const eventType = event.eventType || event.event_type;
        const productId = event.productId || event.product_id;
        
        events.push({
          id: `inventory-${event.id}`,
          title: `${t('calendar.inventory')}: ${productName}`,
          start: eventDate,
          end: eventDate,
          type: 'inventory',
          inventoryType: eventType,
          productId: productId,
          productName: productName,
          customerName: productName // Reusing customerName field for consistent rendering
        });
      } catch (err) {
        console.error('Error processing inventory event for calendar:', err, event?.id);
      }
    }
    
    return events;
  };

  // Process production batch events
  const createProductionEvents = (productionBatches: any[] | undefined): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    
    if (!productionBatches || !Array.isArray(productionBatches)) {
      return events;
    }
    
    for (const batch of productionBatches) {
      try {
        if (!batch || !batch.id) {
          console.warn('Invalid production batch data:', batch);
          continue;
        }
        
        // Handle both camelCase and snake_case field names
        const startDate = batch.startDate || batch.start_date;
        const completionDate = batch.completionDate || batch.completion_date;
        const estimatedCompletionDate = batch.estimatedCompletionDate || batch.estimated_completion_date;
        const recipeName = batch.recipeName || batch.recipe_name || t('common.unknown');
        const quantity = parseFloat(batch.quantity || '0');
        
        // Production start date
        if (startDate) {
          try {
            const startDateTime = new Date(startDate);
            if (!isNaN(startDateTime.getTime())) {
              events.push({
                id: `production-start-${batch.id}`,
                title: `${t('calendar.productionStart')}: ${recipeName}`,
                start: startDateTime,
                end: startDateTime,
                type: 'production',
                productionBatchId: batch.id,
                productionStage: 'start',
                recipeName: recipeName,
                productionQuantity: quantity,
                customerName: recipeName // Reusing customerName field for display
              });
            }
          } catch (startErr) {
            console.error('Error processing production start date', startErr);
          }
        }
        
        // Production completion date
        if (completionDate) {
          try {
            const completionDateTime = new Date(completionDate);
            if (!isNaN(completionDateTime.getTime())) {
              events.push({
                id: `production-complete-${batch.id}`,
                title: `${t('calendar.productionComplete')}: ${recipeName}`,
                start: completionDateTime,
                end: completionDateTime,
                type: 'production',
                productionBatchId: batch.id,
                productionStage: 'complete',
                recipeName: recipeName,
                productionQuantity: quantity,
                customerName: recipeName // Reusing customerName field for display
              });
            }
          } catch (completeErr) {
            console.error('Error processing production completion date', completeErr);
          }
        }
        
        // Estimated completion date (if not completed yet)
        if (estimatedCompletionDate && !completionDate) {
          try {
            const estimatedDateTime = new Date(estimatedCompletionDate);
            if (!isNaN(estimatedDateTime.getTime())) {
              events.push({
                id: `production-estimated-${batch.id}`,
                title: `${t('calendar.productionEstimated')}: ${recipeName}`,
                start: estimatedDateTime,
                end: estimatedDateTime,
                type: 'production',
                productionBatchId: batch.id,
                productionStage: 'estimated',
                recipeName: recipeName,
                productionQuantity: quantity,
                customerName: recipeName // Reusing customerName field for display
              });
            }
          } catch (estimateErr) {
            console.error('Error processing estimated completion date', estimateErr);
          }
        }
      } catch (err) {
        console.error('Error processing production batch for calendar:', err, batch?.id);
      }
    }
    
    return events;
  };

  // Combine all events
  const events = useMemo<CalendarEvent[]>(() => {
    let allEvents: CalendarEvent[] = [];
    
    try {
      console.log('Creating all calendar events from data sources');
      
      // Process orders
      const orderEvents = createOrderEvents(orders);
      console.log(`Created ${orderEvents.length} order events`);
      allEvents = [...allEvents, ...orderEvents];
      
      // Process call logs
      const callEvents = createCallEvents(callLogs);
      console.log(`Created ${callEvents.length} call events`);
      allEvents = [...allEvents, ...callEvents];
      
      // Process payments - use rawInvoiceData instead of invoices
      const paymentEvents = createPaymentEvents(payments, rawInvoiceData);
      console.log(`Created ${paymentEvents.length} payment events`);
      allEvents = [...allEvents, ...paymentEvents];
      
      // Process invoices - Use BOTH rawInvoiceData and regular invoices if available
      // This gives us the best chance of getting invoice data from either source
      let mergedInvoices: any[] = [];
      
      // First add invoices from the useQuery hook if available
      if (invoices && Array.isArray(invoices) && invoices.length > 0) {
        console.log(`Found ${invoices.length} invoices from useQuery hook`);
        mergedInvoices = [...invoices];
      }
      
      // Then add any invoices from the direct fetch that aren't already included
      if (rawInvoiceData && Array.isArray(rawInvoiceData) && rawInvoiceData.length > 0) {
        console.log(`Found ${rawInvoiceData.length} invoices from direct fetch`);
        
        // Only add invoices that aren't already in the merged array (avoid duplicates)
        rawInvoiceData.forEach(rawInvoice => {
          if (!mergedInvoices.some(inv => inv.id === rawInvoice.id)) {
            mergedInvoices.push(rawInvoice);
          }
        });
      }
      
      console.log(`Processing ${mergedInvoices.length} total unique invoices for calendar`);
      const invoiceEvents = createInvoiceEvents(mergedInvoices);
      console.log(`Created ${invoiceEvents.length} invoice events`);
      allEvents = [...allEvents, ...invoiceEvents];
      
      // Process inventory events
      const inventoryEventsList = createInventoryEvents(inventoryEvents);
      console.log(`Created ${inventoryEventsList.length} inventory events`);
      allEvents = [...allEvents, ...inventoryEventsList];
      
      // Process production batches
      const productionEvents = createProductionEvents(productionBatches);
      console.log(`Created ${productionEvents.length} production events`);
      allEvents = [...allEvents, ...productionEvents];
      
      console.log(`Total events created: ${allEvents.length}`);
    } catch (error) {
      console.error('Error creating calendar events:', error);
    }
    
    return allEvents;
  }, [orders, callLogs, payments, rawInvoiceData, inventoryEvents, productionBatches, t]);

  // Filter events based on the selected tab
  const filteredEvents = useMemo(() => {
    console.log(`Filtering events for tab: ${filterView}, total events: ${events.length}`);
    
    let result = [];
    switch(filterView) {
      case 'orders':
        result = events.filter(event => ['created', 'shipped', 'estimated'].includes(event.type));
        console.log(`Filtered orders events: ${result.length}`);
        break;
      case 'calls':
        result = events.filter(event => event.type === 'call');
        console.log(`Filtered call events: ${result.length}`);
        break;
      case 'payments':
        // Include both actual payments and invoice-related payments
        result = events.filter(event => 
          (event.type === 'payment') || // All payment events
          (event.type === 'invoice')    // All invoice events too
        );
        console.log(`Filtered payment events: ${result.length}`);
        break;
      case 'invoices':
        // Include both payment-based invoices and dedicated invoice events
        result = events.filter(event => 
          (event.type === 'payment' && event.invoiceNumber && event.supplierName) ||
          event.type === 'invoice'
        );
        console.log(`Filtered invoice events: ${result.length}`);
        break;
      case 'inventory':
        result = events.filter(event => event.type === 'inventory');
        console.log(`Filtered inventory events: ${result.length}`);
        break;
      case 'production':
        result = events.filter(event => event.type === 'production');
        console.log(`Filtered production events: ${result.length}`);
        break;
      case 'all':
      default:
        result = events;
        console.log(`Showing all events: ${result.length}`);
        break;
    }
    
    return result;
  }, [events, filterView]);
  
  // Get upcoming events for the sidebar
  const upcomingEvents = useMemo(() => {
    if (!events || !Array.isArray(events) || events.length === 0) {
      return [];
    }
    
    try {
      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);
      
      return events
        .filter(event => {
          if (!event || !event.start) return false;
          
          try {
            // Make sure we have a valid start date
            let eventStart: Date;
            if (event.start instanceof Date) {
              eventStart = event.start;
            } else if (typeof event.start === 'string') {
              eventStart = new Date(event.start);
            } else {
              return false;
            }
            
            // Check if date is valid
            if (isNaN(eventStart.getTime())) {
              return false;
            }
            
            return eventStart >= now && eventStart <= nextWeek;
          } catch (err) {
            console.error("Error filtering event:", err);
            return false;
          }
        })
        .sort((a, b) => {
          try {
            // Safe date conversion
            let aStart: Date, bStart: Date;
            
            if (a.start instanceof Date) {
              aStart = a.start;
            } else {
              aStart = new Date(String(a.start));
            }
            
            if (b.start instanceof Date) {
              bStart = b.start;
            } else {
              bStart = new Date(String(b.start));
            }
            
            // Check if dates are valid
            if (isNaN(aStart.getTime()) || isNaN(bStart.getTime())) {
              return 0;
            }
            
            return aStart.getTime() - bStart.getTime();
          } catch (err) {
            console.error("Error sorting event:", err);
            return 0;
          }
        })
        .slice(0, 5);
    } catch (err) {
      console.error("Error getting upcoming events:", err);
      return [];
    }
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
  const eventStyleGetter = (event: any) => {
    const defaultStyle = {
      style: {
        backgroundColor: '#6B7280', // Default gray
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: '0.8rem'
      }
    };
    
    try {
      if (!event || typeof event !== 'object') {
        return defaultStyle;
      }
      
      const eventType = event.type;
      if (!eventType) {
        return defaultStyle;
      }
      
      let backgroundColor = '#6B7280'; // Default gray
      let borderLeft;
      
      // Determine color based on event type
      switch (eventType) {
        case 'created':
          backgroundColor = '#4F46E5'; // Blue for order created
          break;
        case 'shipped':
          backgroundColor = '#10B981'; // Green for shipped
          break;
        case 'estimated':
          backgroundColor = '#8B5CF6'; // Purple for estimated shipping date
          borderLeft = '3px solid #7C3AED';
          break;
        case 'call':
          if (event.isFollowUp) {
            backgroundColor = '#F43F5E'; // Pink for follow-up calls
            borderLeft = '3px solid #BE185D';
          } else {
            backgroundColor = '#F59E0B'; // Amber for scheduled calls
            borderLeft = '3px solid #D97706';
          }
          break;
        case 'payment':
          if (event.callbackRequired) {
            backgroundColor = '#EC4899'; // Pink for payment callbacks
            borderLeft = '3px solid #BE185D';
          } else if (event.invoiceNumber && event.supplierName && !event.callbackRequired) {
            // This is an invoice event using payment type
            if (event.invoiceStatus === 'overdue') {
              backgroundColor = '#EF4444'; // Red for overdue invoices
              borderLeft = '3px solid #B91C1C';
            } else if (event.invoiceStatus === 'paid') {
              backgroundColor = '#10B981'; // Green for paid invoices
              borderLeft = '3px solid #059669';
            } else if (event.invoiceStatus === 'partially_paid') {
              backgroundColor = '#F59E0B'; // Amber for partially paid invoices
              borderLeft = '3px solid #D97706';
            } else {
              backgroundColor = '#0EA5E9'; // Sky blue for pending invoices
              borderLeft = '3px solid #0284C7';
            }
          } else {
            backgroundColor = '#14B8A6'; // Teal for regular payments
            borderLeft = '3px solid #0F766E';
          }
          break;
        case 'invoice':
          // Style dedicated invoice events with enhanced visual treatment 
          if (event.invoiceStatus === 'overdue' || event.isOverdue) {
            backgroundColor = '#EF4444'; // Red for overdue invoices
            borderLeft = '4px solid #B91C1C';
          } else if (event.invoiceStatus === 'paid' || event.isPaid) {
            backgroundColor = '#10B981'; // Green for paid invoices
            borderLeft = '4px solid #059669';
          } else if (event.invoiceStatus === 'partially_paid' || event.isPartiallyPaid) {
            backgroundColor = '#F59E0B'; // Amber for partially paid invoices
            borderLeft = '4px solid #D97706';
          } else {
            backgroundColor = '#0EA5E9'; // Sky blue for pending invoices
            borderLeft = '4px solid #0284C7';
          }
          break;
        case 'inventory':
          backgroundColor = '#06B6D4'; // Cyan for inventory
          borderLeft = '3px solid #0E7490';
          break;
        case 'production':
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
          break;
        default:
          // Default gray styling
          return defaultStyle;
      }
      
      return {
        style: {
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
        }
      };
    } catch (err) {
      console.error("Error styling event:", err);
      return defaultStyle;
    }
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
      try {
        navigate(`/orders/${selectedEvent.orderId}`);
        setIsEventModalOpen(false);
      } catch (error) {
        console.error("Error navigating to order:", error);
        toast({
          title: "Navigation Error",
          description: "Couldn't navigate to order details",
          variant: "destructive",
        });
      }
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
            <TabsList className="grid grid-cols-7 gap-1 w-full mb-4">
              <TabsTrigger value="all" className="px-1 py-1 h-auto text-[10px] sm:text-xs md:text-sm whitespace-nowrap">{t('calendar.allEvents')}</TabsTrigger>
              <TabsTrigger value="orders" className="px-1 py-1 h-auto text-[10px] sm:text-xs md:text-sm whitespace-nowrap">{t('calendar.orders')}</TabsTrigger>
              <TabsTrigger value="calls" className="px-1 py-1 h-auto text-[10px] sm:text-xs md:text-sm whitespace-nowrap">{t('calendar.calls')}</TabsTrigger>
              <TabsTrigger value="payments" className="px-1 py-1 h-auto text-[10px] sm:text-xs md:text-sm whitespace-nowrap">{t('calendar.payments')}</TabsTrigger>
              <TabsTrigger value="invoices" className="px-1 py-1 h-auto text-[10px] sm:text-xs md:text-sm whitespace-nowrap">{t('calendar.invoices')}</TabsTrigger>
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
                    {(filterView === 'all' || filterView === 'invoices') && (
                      <>
                        <Badge className="bg-[#0EA5E9]">{t('calendar.pendingInvoice')}</Badge>
                        <Badge className="bg-[#F59E0B]">{t('calendar.partiallyPaidInvoice')}</Badge>
                        <Badge className="bg-[#10B981]">{t('calendar.paidInvoice')}</Badge>
                        <Badge className="bg-[#EF4444]">{t('calendar.overdueInvoice')}</Badge>
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
                  <div className="h-[600px]">
                    <BigCalendar
                      localizer={localizer}
                      events={filteredEvents}
                      startAccessor="start"
                      endAccessor="end"
                      style={{ height: '100%' }}
                      defaultView={calendarView}
                      views={['month', 'week', 'day', 'agenda']}
                      onSelectEvent={handleEventClick}
                      eventPropGetter={eventStyleGetter}
                      date={selectedDate}
                      onNavigate={setSelectedDate}
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
            </TabsContent>
          </Tabs>
        </div>
        
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('calendar.upcomingEvents')}</CardTitle>
              <CardDescription>{t('calendar.nextSevenDays')}</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length > 0 ? (
                <div className="space-y-4">
                  {upcomingEvents.map((event) => (
                    <div 
                      key={event.id} 
                      className="border rounded-md p-3 cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => handleEventClick(event)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          {event.type === 'created' && <Package className="h-4 w-4 text-[#4F46E5]" />}
                          {event.type === 'shipped' && <Package className="h-4 w-4 text-[#10B981]" />}
                          {event.type === 'estimated' && <Package className="h-4 w-4 text-[#8B5CF6]" />}
                          {event.type === 'call' && <Phone className="h-4 w-4 text-[#F59E0B]" />}
                          {event.type === 'payment' && event.invoiceNumber && event.supplierName && (
                            <>
                              {event.invoiceStatus === 'overdue' && <FileText className="h-4 w-4 text-[#EF4444]" />}
                              {event.invoiceStatus === 'paid' && <FileText className="h-4 w-4 text-[#10B981]" />}
                              {event.invoiceStatus === 'partially_paid' && <FileText className="h-4 w-4 text-[#F59E0B]" />}
                              {(event.invoiceStatus === 'pending' || !event.invoiceStatus) && <FileText className="h-4 w-4 text-[#0EA5E9]" />}
                            </>
                          )}
                          {event.type === 'payment' && !(event.invoiceNumber && event.supplierName) && <DollarSign className="h-4 w-4 text-[#14B8A6]" />}
                          {event.type === 'inventory' && <Tag className="h-4 w-4 text-[#06B6D4]" />}
                          {event.type === 'production' && <Factory className="h-4 w-4 text-[#2563EB]" />}
                          <div className="flex-1 font-medium">{event.title}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center text-xs text-muted-foreground">
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        <time dateTime={event.start.toISOString()}>
                          {getRelativeDate(event.start)}, {event.start.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
                        </time>
                        <Clock className="ml-3 mr-1 h-3 w-3" />
                        <time dateTime={event.start.toISOString()}>
                          {event.start.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-center py-6">
                  <CalendarIcon className="mx-auto h-12 w-12 opacity-20 mb-2" />
                  <p>{t('calendar.noUpcomingEvents')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event details modal */}
      <Dialog open={isEventModalOpen} onOpenChange={setIsEventModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedEvent?.title || t('calendar.eventDetails')}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent?.start.toLocaleDateString(i18n.language, { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
              {' '}
              {selectedEvent?.start.toLocaleTimeString(i18n.language, { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              {selectedEvent?.type === 'call' && (
                <>
                  <div className="flex items-start">
                    <User className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('common.customer')}</p>
                      <p className="text-sm text-muted-foreground">{selectedEvent.customerName}</p>
                    </div>
                  </div>
                  
                  {selectedEvent.callDetails && (
                    <div className="flex items-start">
                      <FileText className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{t('common.details')}</p>
                        <p className="text-sm text-muted-foreground">{selectedEvent.callDetails}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-start">
                    <Phone className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('common.callType')}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedEvent.isFollowUp 
                          ? t('calendar.followUpCall') 
                          : t('calendar.scheduledCall')}
                      </p>
                    </div>
                  </div>
                </>
              )}
              
              {(selectedEvent?.type === 'created' || selectedEvent?.type === 'shipped' || selectedEvent?.type === 'estimated') && (
                <>
                  <div className="flex items-start">
                    <FileText className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('orders.orderNumber')}</p>
                      <p className="text-sm text-muted-foreground">{selectedEvent.orderNumber}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <User className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('common.customer')}</p>
                      <p className="text-sm text-muted-foreground">{selectedEvent.customerName}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Package className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('common.eventType')}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedEvent.type === 'created' && t('calendar.orderCreated')}
                        {selectedEvent.type === 'shipped' && t('calendar.orderShipped')}
                        {selectedEvent.type === 'estimated' && t('calendar.estimatedShipping')}
                      </p>
                    </div>
                  </div>
                </>
              )}
              
              {selectedEvent?.type === 'payment' && (
                <>
                  <div className="flex items-start">
                    <User className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('suppliers.supplier')}</p>
                      <p className="text-sm text-muted-foreground">{selectedEvent.supplierName}</p>
                    </div>
                  </div>
                  
                  {selectedEvent.paymentAmount && (
                    <div className="flex items-start">
                      <DollarSign className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{t('suppliers.amount')}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Intl.NumberFormat(i18n.language, { 
                            style: 'currency', 
                            currency: 'EUR' 
                          }).format(selectedEvent.paymentAmount)}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {selectedEvent.invoiceNumber && (
                    <>
                      <div className="flex items-start">
                        <FileText className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">{t('supplierPayments.payment.invoice')}</p>
                          <p className="text-sm text-muted-foreground">{selectedEvent.invoiceNumber}</p>
                        </div>
                      </div>
                      
                      {selectedEvent.invoiceStatus && (
                        <div className="flex items-start">
                          <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium">{t('common.status')}</p>
                            <p className="text-sm">
                              {selectedEvent.invoiceStatus === 'overdue' && (
                                <span className="text-red-500 font-medium">{t('calendar.invoiceOverdue')}</span>
                              )}
                              {selectedEvent.invoiceStatus === 'paid' && (
                                <span className="text-green-500 font-medium">{t('calendar.invoicePaid')}</span>
                              )}
                              {selectedEvent.invoiceStatus === 'partially_paid' && (
                                <span className="text-amber-500 font-medium">{t('calendar.invoicePartiallyPaid')}</span>
                              )}
                              {(selectedEvent.invoiceStatus === 'pending' || !selectedEvent.invoiceStatus) && (
                                <span className="text-blue-500 font-medium">{t('calendar.invoiceDue')}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {selectedEvent.invoiceAmount && (
                        <div className="flex items-start">
                          <DollarSign className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium">{t('common.amount')}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Intl.NumberFormat(i18n.language, { 
                                style: 'currency', 
                                currency: 'EUR' 
                              }).format(selectedEvent.invoiceAmount)}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {selectedEvent.callbackRequired && (
                    <div className="flex items-start">
                      <Phone className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{t('suppliers.callbackRequired')}</p>
                        {selectedEvent.callbackDate && (
                          <p className="text-sm text-muted-foreground">
                            {selectedEvent.callbackDate.toLocaleDateString(i18n.language)}
                          </p>
                        )}
                        {selectedEvent.callbackNotes && (
                          <p className="text-sm text-muted-foreground mt-1">{selectedEvent.callbackNotes}</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {selectedEvent?.type === 'inventory' && (
                <>
                  <div className="flex items-start">
                    <Tag className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('inventory.product')}</p>
                      <p className="text-sm text-muted-foreground">{selectedEvent.productName}</p>
                    </div>
                  </div>
                  
                  {selectedEvent.inventoryType && (
                    <div className="flex items-start">
                      <Package className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{t('inventory.eventType')}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedEvent.inventoryType === 'restock' && t('inventory.restock')}
                          {selectedEvent.inventoryType === 'audit' && t('inventory.audit')}
                          {selectedEvent.inventoryType === 'adjustment' && t('inventory.adjustment')}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {selectedEvent?.type === 'invoice' && (
                <>
                  <div className="flex items-start">
                    <User className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('suppliers.supplier')}</p>
                      <p className="text-sm text-muted-foreground">{selectedEvent.supplierName}</p>
                    </div>
                  </div>
                  
                  {selectedEvent.invoiceNumber && (
                    <div className="flex items-start">
                      <FileText className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{t('supplierPayments.payment.invoice')}</p>
                        <p className="text-sm text-muted-foreground">{selectedEvent.invoiceNumber}</p>
                      </div>
                    </div>
                  )}
                  
                  {selectedEvent.invoiceAmount && (
                    <div className="flex items-start">
                      <DollarSign className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{t('suppliers.amount')}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Intl.NumberFormat(i18n.language, { 
                            style: 'currency', 
                            currency: 'EUR' 
                          }).format(selectedEvent.invoiceAmount)}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {(typeof selectedEvent.paidAmount === 'number' || typeof selectedEvent.paidAmount === 'string') && Number(selectedEvent.paidAmount) > 0 && (
                    <div className="flex items-start">
                      <DollarSign className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{t('supplierPayments.payment.paidAmount')}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Intl.NumberFormat(i18n.language, { 
                            style: 'currency', 
                            currency: 'EUR' 
                          }).format(Number(selectedEvent.paidAmount))}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {selectedEvent.invoiceStatus && (
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{t('supplierPayments.payment.status')}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedEvent.invoiceStatus === 'pending' && t('supplierPayments.statuses.pending')}
                          {selectedEvent.invoiceStatus === 'paid' && t('supplierPayments.statuses.paid')}
                          {selectedEvent.invoiceStatus === 'partially_paid' && t('supplierPayments.statuses.partiallyPaid')}
                          {selectedEvent.invoiceStatus === 'overdue' && t('supplierPayments.statuses.overdue')}
                          {selectedEvent.invoiceStatus === 'cancelled' && t('supplierPayments.statuses.cancelled')}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {selectedEvent?.type === 'production' && (
                <>
                  <div className="flex items-start">
                    <Factory className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('production.recipe')}</p>
                      <p className="text-sm text-muted-foreground">{selectedEvent.recipeName}</p>
                    </div>
                  </div>
                  
                  {selectedEvent.productionQuantity && (
                    <div className="flex items-start">
                      <Package className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{t('production.quantity')}</p>
                        <p className="text-sm text-muted-foreground">{selectedEvent.productionQuantity}</p>
                      </div>
                    </div>
                  )}
                  
                  {selectedEvent.productionStage && (
                    <div className="flex items-start">
                      <Clock className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{t('production.stage')}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedEvent.productionStage === 'start' && t('production.started')}
                          {selectedEvent.productionStage === 'complete' && t('production.completed')}
                          {selectedEvent.productionStage === 'estimated' && t('production.estimated')}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="outline" onClick={() => setIsEventModalOpen(false)}>
              {t('common.close')}
            </Button>
            
            <div className="flex space-x-2">
              {/* Show relevant action buttons based on event type */}
              {selectedEvent?.type === 'call' && (
                <>
                  <Button onClick={handleViewCall}>
                    {t('callLogs.viewCall')}
                  </Button>
                  <Button variant="secondary" onClick={handleNewCallLog}>
                    {t('callLogs.newCall')}
                  </Button>
                </>
              )}
              
              {(selectedEvent?.type === 'created' || selectedEvent?.type === 'shipped' || selectedEvent?.type === 'estimated') && (
                <Button onClick={handleViewOrder}>
                  {t('orders.viewOrder')}
                </Button>
              )}
              
              {selectedEvent?.type === 'payment' && (
                <>
                  {selectedEvent.invoiceNumber ? (
                    <Button onClick={() => {
                      navigate(`/supplier-payments/invoices${selectedEvent.id ? `/${selectedEvent.id.toString().replace('invoice-', '')}` : ''}`);
                      setIsEventModalOpen(false);
                    }}>
                      {t('suppliers.viewInvoice')}
                    </Button>
                  ) : (
                    <Button onClick={() => {
                      navigate('/supplier-payments');
                      setIsEventModalOpen(false);
                    }}>
                      {t('suppliers.viewPayments')}
                    </Button>
                  )}
                </>
              )}
              
              {selectedEvent?.type === 'inventory' && selectedEvent.productId && (
                <Button onClick={() => {
                  navigate(`/inventory/products/${selectedEvent.productId}`);
                  setIsEventModalOpen(false);
                }}>
                  {t('inventory.viewProduct')}
                </Button>
              )}
              
              {selectedEvent?.type === 'production' && selectedEvent.productionBatchId && (
                <Button onClick={() => {
                  navigate(`/production/batches/${selectedEvent.productionBatchId}`);
                  setIsEventModalOpen(false);
                }}>
                  {t('production.viewBatch')}
                </Button>
              )}
              
              {selectedEvent?.type === 'invoice' && selectedEvent.invoiceId && (
                <Button onClick={() => {
                  navigate(`/supplier-payments/invoices/${selectedEvent.invoiceId}`);
                  setIsEventModalOpen(false);
                }}>
                  {t('suppliers.viewInvoice')}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;