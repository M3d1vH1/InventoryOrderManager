import * as cron from 'node-cron';
import { IStorage } from '../storage';
import { createSlackService } from './notifications/slackService';

interface DailyMetrics {
  newOrders: Array<{ orderNumber: string; customerName: string }>;
  pickedOrders: Array<{ orderNumber: string; customerName: string }>;
  shippedOrders: Array<{ orderNumber: string; customerName: string }>;
  outstandingOrders: Array<{ orderNumber: string; customerName: string }>;
}

export class DailyReportScheduler {
  private storage: IStorage;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async start(): Promise<void> {
    console.log('[DailyReportScheduler] Starting daily report scheduler...');
    
    // Run every minute to check if it's time to send report
    this.cronJob = cron.schedule('* * * * *', async () => {
      if (this.isRunning) return; // Prevent multiple executions
      
      try {
        await this.checkAndSendReport();
      } catch (error) {
        console.error('[DailyReportScheduler] Error in scheduled task:', error);
      }
    }, {
      timezone: "Europe/Athens" // Greek timezone
    });

    console.log('[DailyReportScheduler] Scheduler started successfully');
  }

  async stop(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[DailyReportScheduler] Scheduler stopped');
    }
  }

  private async checkAndSendReport(): Promise<void> {
    const settings = await this.storage.getNotificationSettings();
    
    if (!settings?.dailyReportEnabled) {
      return; // Daily reports are disabled
    }

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm format
    const reportTime = settings.dailyReportTime || '17:30';

    // Check if today is a selected report day
    const daysOfWeek = settings.dailyReportDaysOfWeek || '1,2,3,4,5'; // Default: weekdays
    const selectedDays = daysOfWeek.split(',').map(d => parseInt(d.trim()));
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    if (!selectedDays.includes(currentDay)) {
      return; // Not a report day
    }

    // Check if current time matches report time (within same minute)
    if (currentTime === reportTime) {
      // Check if we already sent a report today
      const today = now.toISOString().split('T')[0];
      const lastReportKey = `daily_report_${today}`;
      
      // Simple check to prevent duplicate reports (you might want to store this in DB)
      if (this.isRunning) return;
      
      this.isRunning = true;
      
      try {
        await this.sendDailyReport(settings);
        console.log(`[DailyReportScheduler] Daily report sent at ${currentTime}`);
      } catch (error) {
        console.error('[DailyReportScheduler] Failed to send daily report:', error);
      } finally {
        this.isRunning = false;
      }
    }
  }

  private async sendDailyReport(): Promise<void> {
    const metrics = await this.collectDailyMetrics();
    const message = this.formatDailyReport(metrics);
    
    const settings = await this.storage.getNotificationSettings();
    const webhookUrl = settings?.dailyReportWebhookUrl || settings?.slackWebhookUrl;
    
    if (!webhookUrl) {
      console.warn('[DailyReportScheduler] No webhook URL configured for daily reports');
      return;
    }

    const slackService = createSlackService(this.storage);
    const success = await (slackService as any).sendSlackMessage(message, webhookUrl);
    
    if (!success) {
      throw new Error('Failed to send daily report to Slack');
    }
  }

  private async collectDailyMetrics(): Promise<DailyMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all orders for analysis
    const allOrders = await this.storage.getOrdersForReport();
    
    const newOrders = allOrders.filter((order: any) => {
      const orderDate = new Date(order.orderDate);
      return orderDate >= today && orderDate < tomorrow;
    }).map((order: any) => ({
      orderNumber: order.orderNumber,
      customerName: order.customerName
    }));

    const pickedOrders = allOrders.filter((order: any) => {
      if (!order.pickedAt) return false;
      const pickedDate = new Date(order.pickedAt);
      return pickedDate >= today && pickedDate < tomorrow;
    }).map((order: any) => ({
      orderNumber: order.orderNumber,
      customerName: order.customerName
    }));

    const shippedOrders = allOrders.filter((order: any) => {
      if (!order.shippedAt) return false;
      const shippedDate = new Date(order.shippedAt);
      return shippedDate >= today && shippedDate < tomorrow;
    }).map((order: any) => ({
      orderNumber: order.orderNumber,
      customerName: order.customerName
    }));

    const outstandingOrders = allOrders.filter((order: any) => 
      order.status === 'pending'
    ).map((order: any) => ({
      orderNumber: order.orderNumber,
      customerName: order.customerName
    }));

    return {
      newOrders,
      pickedOrders,
      shippedOrders,
      outstandingOrders
    };
  }

  private formatDailyReport(metrics: DailyMetrics): any {
    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const formatOrderList = (orders: Array<{ orderNumber: string; customerName: string }>, limit: number = 5): string => {
      if (orders.length === 0) return 'None';
      
      if (orders.length <= limit) {
        return orders.map(o => `${o.orderNumber} (${o.customerName})`).join(', ');
      } else {
        const shown = orders.slice(0, limit);
        const remaining = orders.length - limit;
        return shown.map(o => `${o.orderNumber} (${o.customerName})`).join(', ') + ` ... +${remaining} more`;
      }
    };

    const reportText = `📊 Daily Operations Report - ${today}

📦 NEW ORDERS (${metrics.newOrders.length} total)
${formatOrderList(metrics.newOrders)}

✅ PICKED TODAY (${metrics.pickedOrders.length} total)
${formatOrderList(metrics.pickedOrders)}

🚚 SHIPPED TODAY (${metrics.shippedOrders.length} total)
${formatOrderList(metrics.shippedOrders)}

⏳ OUTSTANDING ORDERS (${metrics.outstandingOrders.length} total)
${formatOrderList(metrics.outstandingOrders)}

📋 Full details: ${process.env.APP_URL || 'https://amphoreus.replit.app'}/orders
Generated at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

    return {
      text: reportText,
      mrkdwn: true
    };
  }

  // Method to manually trigger a report (for testing)
  async sendTestReport(): Promise<boolean> {
    try {
      await this.sendDailyReport();
      return true;
    } catch (error) {
      console.error('[DailyReportScheduler] Test report failed:', error);
      return false;
    }
  }
}

let schedulerInstance: DailyReportScheduler | null = null;

export function createDailyReportScheduler(storage: IStorage): DailyReportScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new DailyReportScheduler(storage);
  }
  return schedulerInstance;
}

export function getDailyReportScheduler(): DailyReportScheduler | null {
  return schedulerInstance;
}