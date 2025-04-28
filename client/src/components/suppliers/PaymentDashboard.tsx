import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Clock, AlertCircle, DollarSign, CreditCard, Calendar } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';

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
    amount: number;
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
}

interface PaymentDashboardProps {
  summary?: PaymentSummary;
}

export const PaymentDashboard = ({ summary }: PaymentDashboardProps) => {
  const { t } = useTranslation();

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

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch (error) {
      return dateString;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary cards row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('supplierPayments.unpaidInvoices')}
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalOutstanding)}</div>
            <Progress
              value={summary.paymentCompletion}
              className="h-2 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {summary.paymentCompletion.toFixed(0)}% {t('supplierPayments.paymentCompletionRate')}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('supplierPayments.totalPaid')}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalPaid)}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {formatCurrency(summary.paidThisMonth)} {t('supplierPayments.paidThisMonth')}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('supplierPayments.invoice.statuses.overdue')}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.overdueAmount)}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {formatCurrency(summary.dueWithin30Days)} {t('supplierPayments.dueWithin30Days')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming and recent payments row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('supplierPayments.upcomingPayments')}</CardTitle>
            <CardDescription>
              {t('supplierPayments.nextPaymentsDue')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.upcomingPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('supplierPayments.noUpcomingPayments')}
              </p>
            ) : (
              <div className="space-y-4">
                {summary.upcomingPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center space-x-4">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {payment.supplierName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payment.invoiceNumber} - {formatDate(payment.dueDate)}
                      </p>
                    </div>
                    <div className="font-medium">
                      {formatCurrency(payment.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('supplierPayments.recentPayments')}</CardTitle>
            <CardDescription>
              {t('supplierPayments.lastPaymentsMade')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('supplierPayments.noRecentPayments')}
              </p>
            ) : (
              <div className="space-y-4">
                {summary.recentPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center space-x-4">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {payment.supplierName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payment.invoiceNumber} - {formatDate(payment.paymentDate)}
                      </p>
                    </div>
                    <div className="font-medium">
                      {formatCurrency(payment.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};