import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, CreditCard, Bell, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import InvoicePaymentNotifications from "@/components/InvoicePaymentNotifications";

const InvoicePaymentDemo = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState<any>(null);
  const [lastCreatedPayment, setLastCreatedPayment] = useState<any>(null);

  // Demo invoice creation mutation
  const createDemoInvoiceMutation = useMutation({
    mutationFn: async () => {
      const demoInvoiceData = {
        invoiceNumber: `DEMO-${Date.now()}`,
        supplierId: 1, // Assuming supplier with ID 1 exists
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
        amount: Math.floor(Math.random() * 5000) + 500, // Random amount between 500-5500
        status: 'pending',
        company: 'Demo Supplier Inc.',
        notes: 'This is a demo invoice to test the notification system'
      };

      return apiRequest('/api/supplier-payments/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(demoInvoiceData),
      });
    },
    onSuccess: (data) => {
      setLastCreatedInvoice(data);
      toast({
        title: "Demo Invoice Created",
        description: `Invoice ${data.invoice_number || data.invoiceNumber} has been created successfully. Check your notifications!`,
      });
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/invoices'] });
    },
    onError: (error) => {
      console.error('Error creating demo invoice:', error);
      toast({
        title: "Error",
        description: "Failed to create demo invoice. " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  });

  // Demo payment creation mutation
  const createDemoPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!lastCreatedInvoice) {
        throw new Error('Please create an invoice first');
      }

      const demoPaymentData = {
        invoiceId: lastCreatedInvoice.id,
        paymentDate: new Date().toISOString().split('T')[0],
        amount: Math.floor(lastCreatedInvoice.amount * 0.7), // Pay 70% of the invoice
        paymentMethod: 'bank_transfer',
        referenceNumber: `PAY-${Date.now()}`,
        notes: 'Demo payment to test the notification system',
        company: 'Demo Supplier Inc.'
      };

      return apiRequest('/api/supplier-payments/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(demoPaymentData),
      });
    },
    onSuccess: (data) => {
      setLastCreatedPayment(data);
      toast({
        title: "Demo Payment Created",
        description: `Payment of €${data.amount} has been recorded successfully. Check your notifications!`,
      });
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/invoices'] });
    },
    onError: (error) => {
      console.error('Error creating demo payment:', error);
      toast({
        title: "Error",
        description: "Failed to create demo payment. " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Invoice & Payment Alert System Demo</h1>
        <p className="text-muted-foreground">
          Test the new invoice and payment notification system by creating demo records
        </p>
      </div>

      {/* Demo Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Demo Controls
          </CardTitle>
          <CardDescription>
            Create demo invoices and payments to test the notification system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Invoice Creation */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold">Create Demo Invoice</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Creates a new supplier invoice and triggers invoice creation alerts
              </p>
              <Button 
                onClick={() => createDemoInvoiceMutation.mutate()}
                disabled={createDemoInvoiceMutation.isPending}
                className="w-full"
              >
                {createDemoInvoiceMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Receipt className="h-4 w-4 mr-2" />
                    Create Demo Invoice
                  </>
                )}
              </Button>
              {lastCreatedInvoice && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Last Created Invoice</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p><strong>Number:</strong> {lastCreatedInvoice.invoice_number || lastCreatedInvoice.invoiceNumber}</p>
                    <p><strong>Amount:</strong> €{lastCreatedInvoice.amount}</p>
                    <p><strong>Status:</strong> <Badge variant="secondary">{lastCreatedInvoice.status}</Badge></p>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Creation */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold">Create Demo Payment</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Records a payment for the last created invoice and triggers payment alerts
              </p>
              <Button 
                onClick={() => createDemoPaymentMutation.mutate()}
                disabled={createDemoPaymentMutation.isPending || !lastCreatedInvoice}
                variant="outline"
                className="w-full"
              >
                {createDemoPaymentMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Record Demo Payment
                  </>
                )}
              </Button>
              {!lastCreatedInvoice && (
                <p className="text-xs text-muted-foreground">
                  Create an invoice first to enable payment creation
                </p>
              )}
              {lastCreatedPayment && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Last Created Payment</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p><strong>Amount:</strong> €{lastCreatedPayment.amount}</p>
                    <p><strong>Method:</strong> {lastCreatedPayment.payment_method || lastCreatedPayment.paymentMethod}</p>
                    <p><strong>Reference:</strong> {lastCreatedPayment.reference_number || lastCreatedPayment.referenceNumber}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert System Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alert System Features
          </CardTitle>
          <CardDescription>
            Overview of the implemented notification system capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="h-5 w-5 text-blue-500" />
                <h4 className="font-semibold">Invoice Alerts</h4>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Invoice creation notifications</li>
                <li>• Overdue invoice alerts</li>
                <li>• Slack integration support</li>
                <li>• Customizable templates</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-5 w-5 text-green-500" />
                <h4 className="font-semibold">Payment Alerts</h4>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Payment recording notifications</li>
                <li>• Invoice status updates</li>
                <li>• Supplier information included</li>
                <li>• Real-time processing</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-5 w-5 text-purple-500" />
                <h4 className="font-semibold">Configuration</h4>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Enable/disable individual alerts</li>
                <li>• Custom Slack templates</li>
                <li>• Template variables support</li>
                <li>• Settings persistence</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Display */}
      <InvoicePaymentNotifications />

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Configure</CardTitle>
          <CardDescription>
            Steps to set up the invoice and payment alert system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
              <div>
                <h4 className="font-semibold">Go to Settings</h4>
                <p className="text-sm text-muted-foreground">Navigate to Settings → Notifications tab</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">2</div>
              <div>
                <h4 className="font-semibold">Enable Invoice & Payment Alerts</h4>
                <p className="text-sm text-muted-foreground">Turn on the alerts you want to receive in the "Invoice & Payment Alerts" section</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">3</div>
              <div>
                <h4 className="font-semibold">Configure Slack (Optional)</h4>
                <p className="text-sm text-muted-foreground">Set up Slack integration in the Integrations tab for team notifications</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">4</div>
              <div>
                <h4 className="font-semibold">Test the System</h4>
                <p className="text-sm text-muted-foreground">Use the demo buttons above to create test invoices and payments</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoicePaymentDemo;