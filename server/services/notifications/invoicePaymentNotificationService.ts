import { NotificationSettings, SupplierInvoice, SupplierPayment } from '@shared/schema';
import { storage } from '../../storage';
import { createSlackService } from './slackService';

export interface InvoiceCreatedEvent {
  type: 'invoice_created';
  invoice: SupplierInvoice;
  supplierName?: string;
}

export interface PaymentCreatedEvent {
  type: 'payment_created';
  payment: SupplierPayment;
  invoice: SupplierInvoice;
  supplierName?: string;
}

export interface InvoiceOverdueEvent {
  type: 'invoice_overdue';
  invoice: SupplierInvoice;
  supplierName?: string;
}

export type NotificationEvent = InvoiceCreatedEvent | PaymentCreatedEvent | InvoiceOverdueEvent;

class InvoicePaymentNotificationService {
  private slackService = createSlackService();

  async handleEvent(event: NotificationEvent): Promise<void> {
    try {
      const settings = await storage.getNotificationSettings();
      if (!settings) {
        console.log('No notification settings found, skipping notifications');
        return;
      }

      switch (event.type) {
        case 'invoice_created':
          await this.handleInvoiceCreated(event, settings);
          break;
        case 'payment_created':
          await this.handlePaymentCreated(event, settings);
          break;
        case 'invoice_overdue':
          await this.handleInvoiceOverdue(event, settings);
          break;
      }
    } catch (error) {
      console.error('Error handling notification event:', error);
    }
  }

  private async handleInvoiceCreated(event: InvoiceCreatedEvent, settings: NotificationSettings): Promise<void> {
    if (!settings.invoiceAlerts) {
      return;
    }

    // Send Slack notification if enabled
    if (settings.slackEnabled && settings.slackNotifyInvoices && settings.slackWebhookUrl) {
      const message = this.formatInvoiceSlackMessage(event.invoice, event.supplierName, settings.slackInvoiceTemplate);
      await this.slackService.sendNotification(settings.slackWebhookUrl, message);
    }

    // Store notification for UI display
    await this.storeNotification({
      type: 'invoice_created',
      title: 'New Invoice Created',
      message: `Invoice ${event.invoice.invoiceNumber} created for ${event.supplierName || 'Unknown Supplier'}`,
      data: { invoiceId: event.invoice.id, amount: event.invoice.amount }
    });
  }

  private async handlePaymentCreated(event: PaymentCreatedEvent, settings: NotificationSettings): Promise<void> {
    if (!settings.paymentAlerts) {
      return;
    }

    // Send Slack notification if enabled
    if (settings.slackEnabled && settings.slackNotifyPayments && settings.slackWebhookUrl) {
      const message = this.formatPaymentSlackMessage(event.payment, event.invoice, event.supplierName, settings.slackPaymentTemplate);
      await this.slackService.sendNotification(settings.slackWebhookUrl, message);
    }

    // Store notification for UI display
    await this.storeNotification({
      type: 'payment_created',
      title: 'Payment Recorded',
      message: `Payment of €${event.payment.amount} recorded for invoice ${event.invoice.invoiceNumber}`,
      data: { paymentId: event.payment.id, invoiceId: event.invoice.id, amount: event.payment.amount }
    });
  }

  private async handleInvoiceOverdue(event: InvoiceOverdueEvent, settings: NotificationSettings): Promise<void> {
    if (!settings.overdueInvoiceAlerts) {
      return;
    }

    // Send Slack notification if enabled
    if (settings.slackEnabled && settings.slackNotifyInvoices && settings.slackWebhookUrl) {
      const message = this.formatOverdueInvoiceSlackMessage(event.invoice, event.supplierName);
      await this.slackService.sendNotification(settings.slackWebhookUrl, message);
    }

    // Store notification for UI display
    await this.storeNotification({
      type: 'invoice_overdue',
      title: 'Invoice Overdue',
      message: `Invoice ${event.invoice.invoiceNumber} from ${event.supplierName || 'Unknown Supplier'} is overdue`,
      data: { invoiceId: event.invoice.id, amount: event.invoice.amount, dueDate: event.invoice.dueDate }
    });
  }

  private formatInvoiceSlackMessage(invoice: SupplierInvoice, supplierName?: string, template?: string | null): string {
    if (template) {
      return template
        .replace('{invoiceNumber}', invoice.invoiceNumber)
        .replace('{supplierName}', supplierName || 'Unknown Supplier')
        .replace('{amount}', `€${invoice.amount}`)
        .replace('{dueDate}', invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Not set');
    }

    return `📄 *New Invoice Created*
• Invoice: ${invoice.invoiceNumber}
• Supplier: ${supplierName || 'Unknown Supplier'}
• Amount: €${invoice.amount}
• Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Not set'}
• Status: ${invoice.status}`;
  }

  private formatPaymentSlackMessage(payment: SupplierPayment, invoice: SupplierInvoice, supplierName?: string, template?: string | null): string {
    if (template) {
      return template
        .replace('{paymentAmount}', `€${payment.amount}`)
        .replace('{invoiceNumber}', invoice.invoiceNumber)
        .replace('{supplierName}', supplierName || 'Unknown Supplier')
        .replace('{paymentMethod}', payment.paymentMethod)
        .replace('{paymentDate}', new Date(payment.paymentDate).toLocaleDateString());
    }

    return `💰 *Payment Recorded*
• Amount: €${payment.amount}
• Invoice: ${invoice.invoiceNumber}
• Supplier: ${supplierName || 'Unknown Supplier'}
• Method: ${payment.paymentMethod}
• Date: ${new Date(payment.paymentDate).toLocaleDateString()}
• Reference: ${payment.referenceNumber || 'Not provided'}`;
  }

  private formatOverdueInvoiceSlackMessage(invoice: SupplierInvoice, supplierName?: string): string {
    const daysPastDue = invoice.dueDate ? Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    
    return `⚠️ *Invoice Overdue*
• Invoice: ${invoice.invoiceNumber}
• Supplier: ${supplierName || 'Unknown Supplier'}
• Amount: €${invoice.amount}
• Days Past Due: ${daysPastDue}
• Outstanding: €${invoice.amount - (invoice.paidAmount || 0)}`;
  }

  private async storeNotification(notification: {
    type: string;
    title: string;
    message: string;
    data: any;
  }): Promise<void> {
    // Store notification in a simple in-memory store for now
    // In production, this would be stored in database
    console.log('Notification stored:', notification);
  }
}

export const invoicePaymentNotificationService = new InvoicePaymentNotificationService();