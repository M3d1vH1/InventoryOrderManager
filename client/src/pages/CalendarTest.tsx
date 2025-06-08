import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/el';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/context/SidebarContext';
import { useUser } from '@/context/UserContext';
import { PageHeader } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Set up localizer for the calendar
const localizer = momentLocalizer(moment);

// Define event types
type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  supplierName?: string;
  invoiceNumber?: string;
};

const CalendarTestPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { setCurrentPage } = useSidebar();
  const { user } = useUser();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rawInvoiceData, setRawInvoiceData] = useState<any[]>([]);

  useEffect(() => {
    setCurrentPage('Calendar Test');
    
    // Set moment locale based on the app locale
    moment.locale(i18n.language);
  }, [setCurrentPage, i18n.language]);

  // Manual fetch directly
  useEffect(() => {
    if (user && user.id) {
      setIsLoading(true);
      
      // Fetch invoice data
      apiRequest('/api/supplier-payments/invoices')
        .then(data => {
          console.log('Invoice data loaded:', data);
          setRawInvoiceData(Array.isArray(data) ? data : []);
          
          // Process invoice data into calendar events
          const calendarEvents = processInvoiceEvents(data);
          setEvents(calendarEvents);
        })
        .catch(error => {
          console.error('Error loading invoices:', error);
          toast({
            title: t('common.error'),
            description: t('calendar.errorLoadingInvoices'),
            variant: 'destructive',
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [user, toast, t]);

  // Process invoice data into calendar events
  const processInvoiceEvents = (invoices: any[] | undefined): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    
    if (!invoices || !Array.isArray(invoices)) {
      console.warn('No valid invoices data received or not an array');
      return events;
    }
    
    for (const invoice of invoices) {
      try {
        if (!invoice || !invoice.id) {
          console.warn('Invalid invoice data:', invoice);
          continue;
        }
        
        // Handle both snake_case and camelCase field names
        const dueDate = invoice.dueDate || invoice.due_date || invoice.invoiceDate || invoice.invoice_date;
        if (!dueDate) {
          console.warn('Invoice missing due date:', invoice);
          continue;
        }
        
        const dueDateObj = new Date(dueDate);
        if (isNaN(dueDateObj.getTime())) {
          console.warn('Invalid invoice due date:', dueDate);
          continue;
        }
        
        // Get invoice details with appropriate field name handling
        const invoiceNumber = invoice.invoiceNumber || invoice.invoice_number || '';
        const supplierName = invoice.supplierName || invoice.supplier_name || t('common.unknown');
        
        // Create calendar event
        events.push({
          id: `invoice-${invoice.id}`,
          title: `Invoice: ${supplierName} - ${invoiceNumber}`,
          start: dueDateObj,
          end: dueDateObj,
          supplierName,
          invoiceNumber
        });
      } catch (err) {
        console.error('Error processing invoice for calendar:', err, invoice?.id);
      }
    }
    
    return events;
  };

  // Manual fetch handler
  const handleManualFetch = () => {
    if (user && user.id) {
      // Use direct fetch to check if API endpoint is accessible
      fetch('/api/supplier-payments/invoices', {
        credentials: 'include',
      })
        .then(response => {
          console.log('Direct fetch invoice status:', response.status);
          return response.json();
        })
        .then(data => {
          console.log('Direct fetch invoices result:', data);
          setRawInvoiceData(Array.isArray(data) ? data : []);
          
          // Process into calendar events
          const calendarEvents = processInvoiceEvents(data);
          setEvents(calendarEvents);
          
          toast({
            title: 'Data fetched',
            description: `Found ${data.length} invoices`,
          });
        })
        .catch(error => {
          console.error('Direct fetch invoice error:', error);
          toast({
            title: t('common.error'),
            description: 'Error fetching invoices',
            variant: 'destructive',
          });
        });
    }
  };

  // Display component based on data state
  const renderContent = () => {
    if (isLoading) {
      return <div className="text-center py-8">Loading invoice data...</div>;
    }

    if (events.length === 0) {
      return (
        <div className="text-center py-8">
          <p>No invoice events found in the calendar</p>
          <Button onClick={handleManualFetch} className="mt-4">
            Manually Fetch Invoice Data
          </Button>
          
          <div className="mt-8">
            <h3 className="text-lg font-medium mb-2">Raw Data ({rawInvoiceData.length} invoices):</h3>
            <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-sm">
              {JSON.stringify(rawInvoiceData, null, 2)}
            </pre>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="mb-4">
          <Badge variant="outline" className="mr-2">
            Showing {events.length} invoice events
          </Badge>
          <Button onClick={handleManualFetch} size="sm" variant="outline">
            Refresh Data
          </Button>
        </div>
        
        <div className="calendar-container h-[600px]">
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            views={['month', 'week', 'day']}
            defaultView={Views.MONTH}
            defaultDate={new Date()}
          />
        </div>
        
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-2">Raw Data ({rawInvoiceData.length} invoices):</h3>
          <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-sm">
            {JSON.stringify(rawInvoiceData, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 pb-8">
      <PageHeader title="Calendar Test Page" description="Testing invoice data display in calendar" />
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invoice Calendar Test</CardTitle>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarTestPage;