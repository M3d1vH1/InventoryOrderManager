import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SupplierList } from '../components/suppliers/SupplierList';
import { InvoiceList } from '../components/suppliers/InvoiceList';
import { PaymentList } from '../components/suppliers/PaymentList';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PaymentDashboard } from '../components/suppliers/PaymentDashboard';
import { useQuery } from '@tanstack/react-query';

export default function SupplierPayments() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const { toast } = useToast();

  // Load payment summary for dashboard
  const { data: paymentSummary, isLoading } = useQuery({
    queryKey: ['/api/supplier-payments/summary'],
    retry: 1,
  });

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">{t('supplierPayments.title')}</h1>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">{t('supplierPayments.dashboard')}</TabsTrigger>
          <TabsTrigger value="suppliers">{t('supplierPayments.suppliers')}</TabsTrigger>
          <TabsTrigger value="invoices">{t('supplierPayments.invoices')}</TabsTrigger>
          <TabsTrigger value="payments">{t('supplierPayments.payments')}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <PaymentDashboard summary={paymentSummary} />
          )}
        </TabsContent>

        <TabsContent value="suppliers">
          <SupplierList />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoiceList />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentList />
        </TabsContent>
      </Tabs>
    </div>
  );
}