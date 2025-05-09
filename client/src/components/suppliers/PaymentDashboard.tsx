import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Clock, AlertCircle, DollarSign, Calendar, CreditCard, ArrowUpDown, Activity, X, FileText } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { format, parseISO, isValid, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths } from 'date-fns';
import { useState, useEffect } from 'react';
import { el } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Types for the summary data
interface PaymentSummary {
  totalOutstanding: number;
  totalPaid: number;
  paidThisMonth: number;
  overdueAmount: number;
  dueWithin30Days: number;
  paymentCompletion: number;
  upcomingPayments: Array<{
    id: number;
    invoiceNumber: string;
    supplierName: string;
    remainingAmount: number;
    dueDate: string;
  }>;
  recentPayments: Array<{
    id: number;
    invoiceNumber: string;
    supplierName: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
  }>;
  invoices?: Array<{
    id: number;
    invoiceNumber: string;
    supplierName: string;
    amount: number;
    paidAmount: number;
    dueDate: string;
    status: string;
  }>;
}

interface PaymentCalendarEvent {
  date: Date;
  type: 'payment' | 'due' | 'invoice';
  amount: number;
  title: string;
  supplierName: string;
  invoiceNumber?: string;
  status?: string;
  isPaid?: boolean;
  isPartiallyPaid?: boolean;
  isOverdue?: boolean;
}

interface PaymentDashboardProps {
  summary?: PaymentSummary;
}

export const PaymentDashboard = ({ summary }: PaymentDashboardProps) => {
  const { t, i18n } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<PaymentCalendarEvent[]>([]);

  // Format currency consistently
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(i18n.language === 'el' ? 'el-GR' : 'en-US', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Format date with proper localization
  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) throw new Error('Invalid date');
      return format(date, 'dd/MM/yyyy', { locale: i18n.language === 'el' ? el : undefined });
    } catch (error) {
      return dateString;
    }
  };

  // Handle empty state
  if (!summary) {
    return (
      <div className="grid gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{t('supplierPayments.dashboard')}</CardTitle>
            <CardDescription>
              {t('common.noDataAvailable')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Process calendar data
  useEffect(() => {
    if (!summary) return;

    console.log('Processing dashboard summary:', summary);
    console.log('Invoices array:', summary.invoices);
    
    const events: PaymentCalendarEvent[] = [];

    // Add recent payments to calendar
    if (summary.recentPayments && Array.isArray(summary.recentPayments)) {
      summary.recentPayments.forEach(payment => {
        try {
          const paymentDate = parseISO(payment.paymentDate);
          if (isValid(paymentDate)) {
            events.push({
              date: paymentDate,
              type: 'payment',
              amount: payment.amount,
              title: t('supplierPayments.payment.paymentMade'),
              supplierName: payment.supplierName,
              invoiceNumber: payment.invoiceNumber
            });
          }
        } catch (error) {
          console.error('Error parsing payment date:', error);
        }
      });
    }

    // Add upcoming due dates to calendar
    if (summary.upcomingPayments && Array.isArray(summary.upcomingPayments)) {
      summary.upcomingPayments.forEach(payment => {
        try {
          const dueDate = parseISO(payment.dueDate);
          if (isValid(dueDate)) {
            events.push({
              date: dueDate,
              type: 'due',
              amount: payment.remainingAmount,
              title: t('supplierPayments.payment.paymentDue'),
              supplierName: payment.supplierName,
              invoiceNumber: payment.invoiceNumber
            });
          }
        } catch (error) {
          console.error('Error parsing due date:', error);
        }
      });
    }

    // Add invoices to calendar
    if (summary.invoices && Array.isArray(summary.invoices)) {
      console.log('Processing invoices for calendar, found:', summary.invoices.length);
      
      summary.invoices.forEach(invoice => {
        try {
          console.log('Processing invoice:', invoice);
          const dueDate = parseISO(invoice.dueDate);
          console.log('Invoice due date parsed:', dueDate, 'Valid:', isValid(dueDate));
          
          if (isValid(dueDate)) {
            const isPaid = invoice.status === 'paid';
            const isPartiallyPaid = invoice.status === 'partially_paid';
            const isOverdue = invoice.status === 'overdue';

            let title = '';
            if (isPaid) {
              title = t('supplierPayments.invoice.paid');
            } else if (isOverdue) {
              title = t('supplierPayments.invoice.overdue');
            } else if (isPartiallyPaid) {
              title = t('supplierPayments.invoice.partiallyPaid');
            } else {
              title = t('supplierPayments.invoice.due');
            }

            console.log('Creating invoice event:', {
              date: dueDate,
              type: 'invoice',
              title,
              status: invoice.status
            });

            events.push({
              date: dueDate,
              type: 'invoice',
              amount: Number(invoice.amount) - Number(invoice.paidAmount),
              title: title,
              supplierName: invoice.supplierName,
              invoiceNumber: invoice.invoiceNumber,
              status: invoice.status,
              isPaid,
              isPartiallyPaid,
              isOverdue
            });
          }
        } catch (error) {
          console.error('Error processing invoice for calendar:', error, invoice);
        }
      });
    }

    console.log('Total calendar events created:', events.length);
    setCalendarEvents(events);
  }, [summary, t]);

  // Generate calendar days for current month
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  // Go to previous month
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => addMonths(prev, -1));
  };

  // Go to next month
  const goToNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return calendarEvents.filter(event => isSameDay(event.date, day));
  };
  
  // State for selected day events and modal
  const [selectedDayEvents, setSelectedDayEvents] = useState<PaymentCalendarEvent[]>([]);
  const [isDayEventsModalOpen, setIsDayEventsModalOpen] = useState(false);
  
  // Handle day click to show events
  const handleDayClick = (day: Date) => {
    const events = getEventsForDay(day);
    if (events.length > 0) {
      setSelectedDayEvents(events);
      setIsDayEventsModalOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary cards row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('supplierPayments.unpaidInvoices')}
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalOutstanding)}</div>
            <Progress
              value={summary.paymentCompletion}
              className="h-2 mt-2 [&>div]:bg-amber-500"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {summary.paymentCompletion.toFixed(0)}% {t('supplierPayments.paymentCompletionRate')}
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('supplierPayments.totalPaid')}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalPaid)}</div>
            <div className="flex items-center gap-1 mt-2">
              <Activity className="h-3 w-3 text-green-500" />
              <p className="text-xs text-muted-foreground">
                {formatCurrency(summary.paidThisMonth)} {t('supplierPayments.paidThisMonth')}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('supplierPayments.invoice.statuses.overdue')}
            </CardTitle>
            <Clock className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.overdueAmount)}</div>
            <div className="flex items-center gap-1 mt-2">
              <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {formatCurrency(summary.dueWithin30Days)} {t('supplierPayments.dueWithin30Days')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming and recent payments row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('supplierPayments.upcomingPayments')}</CardTitle>
            <CardDescription>
              {t('supplierPayments.nextPaymentsDue')}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[250px] overflow-y-auto pb-2">
            {summary.upcomingPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('supplierPayments.noUpcomingPayments')}
              </p>
            ) : (
              <div className="space-y-3">
                {summary.upcomingPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center space-x-4 pb-2 border-b border-border">
                    <div className="bg-amber-100 dark:bg-amber-950/30 p-2 rounded-full">
                      <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {payment.supplierName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payment.invoiceNumber} - {formatDate(payment.dueDate)}
                      </p>
                    </div>
                    <div className="font-medium text-amber-600 dark:text-amber-400">
                      {formatCurrency(payment.remainingAmount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('supplierPayments.recentPayments')}</CardTitle>
            <CardDescription>
              {t('supplierPayments.lastPaymentsMade')}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[250px] overflow-y-auto pb-2">
            {summary.recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('supplierPayments.noRecentPayments')}
              </p>
            ) : (
              <div className="space-y-3">
                {summary.recentPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center space-x-4 pb-2 border-b border-border">
                    <div className="bg-green-100 dark:bg-green-950/30 p-2 rounded-full">
                      <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {payment.supplierName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payment.invoiceNumber} - {formatDate(payment.paymentDate)}
                      </p>
                    </div>
                    <div className="font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(payment.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Calendar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t('calendar.payments')}</CardTitle>
              <CardDescription>{t('supplierPayments.paymentCalendarDescription', 'View upcoming and past payments')}</CardDescription>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={goToPreviousMonth}
                className="p-1 rounded-md hover:bg-muted transition"
                aria-label="Previous month"
              >
                ←
              </button>
              <span className="text-sm font-medium">
                {format(currentMonth, 'MMMM yyyy', { locale: i18n.language === 'el' ? el : undefined })}
              </span>
              <button 
                onClick={goToNextMonth}
                className="p-1 rounded-md hover:bg-muted transition"
                aria-label="Next month"
              >
                →
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar grid header - days of week */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
              <div key={dayIndex} className="text-center text-xs text-muted-foreground py-1">
                {format(new Date(2023, 0, dayIndex + 2), 'EEE', { locale: i18n.language === 'el' ? el : undefined })}
              </div>
            ))}
          </div>
          
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days of previous month */}
            {Array.from({ length: startOfMonth(currentMonth).getDay() === 0 ? 6 : startOfMonth(currentMonth).getDay() - 1 }).map((_, index) => (
              <div key={`empty-start-${index}`} className="h-20 p-1 border border-border/30 rounded-md bg-muted/20"></div>
            ))}
            
            {/* Calendar days */}
            {daysInMonth.map(day => {
              const dayEvents = getEventsForDay(day);
              const hasPaymentEvent = dayEvents.some(e => e.type === 'payment');
              const hasDueEvent = dayEvents.some(e => e.type === 'due');
              const hasInvoiceEvent = dayEvents.some(e => e.type === 'invoice');
              const hasOverdueInvoice = dayEvents.some(e => e.type === 'invoice' && e.isOverdue);
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={`h-20 p-1 border rounded-md overflow-hidden 
                    ${hasPaymentEvent ? 'border-green-500/50 bg-green-50/30 dark:bg-green-950/10' : ''}
                    ${hasDueEvent ? 'border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/10' : ''}
                    ${hasInvoiceEvent && !hasOverdueInvoice ? 'border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/10' : ''}
                    ${hasOverdueInvoice ? 'border-red-500/50 bg-red-50/30 dark:bg-red-950/10' : ''}
                    ${!hasPaymentEvent && !hasDueEvent && !hasInvoiceEvent ? 'border-border/30' : ''}
                    ${dayEvents.length > 0 ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
                  `}
                  onClick={dayEvents.length > 0 ? () => handleDayClick(day) : undefined}
                >
                  <div className="text-right text-xs mb-1">
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    {dayEvents.map((event, idx) => (
                      <div 
                        key={`${day.toISOString()}-${idx}`}
                        className={`text-xs truncate px-1 py-0.5 rounded
                          ${event.type === 'payment' ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300' : ''}
                          ${event.type === 'due' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : ''}
                          ${event.type === 'invoice' && !event.isOverdue ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300' : ''}
                          ${event.type === 'invoice' && event.isOverdue ? 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300' : ''}
                        `}
                        title={`${event.supplierName} - ${event.invoiceNumber} - ${formatCurrency(event.amount)}`}
                      >
                        {event.type === 'payment' ? '💰' : event.type === 'due' ? '📅' : event.isOverdue ? '⚠️' : '📄'} {event.supplierName}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {/* Empty cells for days of next month */}
            {Array.from({ length: (7 - (endOfMonth(currentMonth).getDay() === 0 ? 7 : endOfMonth(currentMonth).getDay())) % 7 }).map((_, index) => (
              <div key={`empty-end-${index}`} className="h-20 p-1 border border-border/30 rounded-md bg-muted/20"></div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-100 border border-green-500 rounded mr-1"></div>
              <span>{t('supplierPayments.payment.paymentMade')}</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-amber-100 border border-amber-500 rounded mr-1"></div>
              <span>{t('supplierPayments.payment.paymentDue')}</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-100 border border-blue-500 rounded mr-1"></div>
              <span>{t('supplierPayments.invoice.due')}</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-100 border border-red-500 rounded mr-1"></div>
              <span>{t('supplierPayments.invoice.overdue')}</span>
            </div>
          </div>
        </CardFooter>
      </Card>
      
      {/* Day Events Modal */}
      <Dialog open={isDayEventsModalOpen} onOpenChange={setIsDayEventsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                {selectedDayEvents.length > 0 ? format(selectedDayEvents[0].date, 'PPP', { locale: i18n.language === 'el' ? el : undefined }) : ''}
              </span>
              <Badge variant="outline" className="ml-2">
                {selectedDayEvents.length} {selectedDayEvents.length === 1 ? t('calendar.event') : t('calendar.events')}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {selectedDayEvents.map((event, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-md space-y-2
                  ${event.type === 'payment' ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900' : ''}
                  ${event.type === 'due' ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900' : ''}
                  ${event.type === 'invoice' && !event.isOverdue ? 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900' : ''}
                  ${event.type === 'invoice' && event.isOverdue ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900' : ''}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {event.type === 'payment' ? (
                      <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : event.type === 'due' ? (
                      <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    ) : event.isOverdue ? (
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    ) : (
                      <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    )}
                    <span className="font-medium">
                      {event.title}
                    </span>
                  </div>
                  <Badge 
                    variant={
                      event.type === 'payment' ? 'default' : 
                      event.type === 'due' ? 'secondary' : 
                      event.isOverdue ? 'destructive' : 
                      'outline'
                    }
                  >
                    {event.type === 'payment' 
                      ? t('supplierPayments.payment.paymentMade')
                      : event.type === 'due'
                      ? t('supplierPayments.payment.paymentDue')
                      : event.isOverdue
                      ? t('supplierPayments.invoice.overdue')
                      : t('supplierPayments.invoice.due')
                    }
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t('supplierPayments.payment.supplier')}</p>
                    <p className="font-medium">{event.supplierName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('supplierPayments.payment.amount')}</p>
                    <p className={`font-medium 
                      ${event.type === 'payment' ? 'text-green-600 dark:text-green-400' : ''}
                      ${event.type === 'due' ? 'text-amber-600 dark:text-amber-400' : ''}
                      ${event.type === 'invoice' && !event.isOverdue ? 'text-blue-600 dark:text-blue-400' : ''}
                      ${event.type === 'invoice' && event.isOverdue ? 'text-red-600 dark:text-red-400' : ''}
                    `}>
                      {formatCurrency(event.amount)}
                    </p>
                  </div>
                  {event.invoiceNumber && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">{t('supplierPayments.payment.invoice')}</p>
                      <p className="font-medium">{event.invoiceNumber}</p>
                    </div>
                  )}
                  {event.status && event.type === 'invoice' && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">{t('supplierPayments.invoice.status')}</p>
                      <p className="font-medium">{t(`supplierPayments.invoice.statuses.${event.status}`)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDayEventsModalOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};