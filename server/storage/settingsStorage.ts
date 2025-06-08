import { 
  EmailSettings, InsertEmailSettings,
  CompanySettings, InsertCompanySettings,
  NotificationSettings, InsertNotificationSettings
} from '@shared/schema';
import { IStorage } from '../storage';

export interface ISettingsStorage {
  // Email settings methods
  getEmailSettings(): Promise<EmailSettings | undefined>;
  updateEmailSettings(settings: Partial<InsertEmailSettings>): Promise<EmailSettings | undefined>;
  
  // Company settings methods
  getCompanySettings(): Promise<CompanySettings | undefined>;
  updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings | undefined>;
  
  // Notification settings methods
  getNotificationSettings(): Promise<NotificationSettings | undefined>;
  updateNotificationSettings(settings: Partial<InsertNotificationSettings>): Promise<NotificationSettings | undefined>;
}

export class MemSettingsStorage implements ISettingsStorage {
  private emailSettingsData: EmailSettings | undefined;
  private companySettingsData: CompanySettings | undefined;
  private notificationSettingsData: NotificationSettings | undefined;

  constructor() {
    this.emailSettingsData = undefined;
    this.companySettingsData = undefined;
    this.notificationSettingsData = undefined;
  }

  async getEmailSettings(): Promise<EmailSettings | undefined> {
    return this.emailSettingsData;
  }

  async updateEmailSettings(settings: Partial<InsertEmailSettings>): Promise<EmailSettings | undefined> {
    if (!this.emailSettingsData) {
      this.emailSettingsData = {
        id: 1,
        host: settings.host ?? '',
        port: settings.port ?? 587,
        secure: settings.secure ?? true,
        authUser: settings.authUser ?? '',
        authPass: settings.authPass ?? '',
        fromEmail: settings.fromEmail ?? '',
        companyName: settings.companyName ?? 'Warehouse Management System',
        enableNotifications: settings.enableNotifications ?? true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } else {
      this.emailSettingsData = {
        ...this.emailSettingsData,
        ...settings,
        updatedAt: new Date()
      };
    }
    return this.emailSettingsData;
  }

  async getCompanySettings(): Promise<CompanySettings | undefined> {
    return this.companySettingsData;
  }

  async updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings | undefined> {
    if (!this.companySettingsData) {
      this.companySettingsData = {
        id: 1,
        companyName: settings.companyName ?? 'Warehouse Systems Inc.',
        email: settings.email ?? 'info@warehousesys.com',
        phone: settings.phone ?? null,
        address: settings.address ?? null,
        logoPath: settings.logoPath ?? null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } else {
      this.companySettingsData = {
        ...this.companySettingsData,
        ...settings,
        updatedAt: new Date()
      };
    }
    return this.companySettingsData;
  }

  async getNotificationSettings(): Promise<NotificationSettings | undefined> {
    return this.notificationSettingsData;
  }

  async updateNotificationSettings(settings: Partial<InsertNotificationSettings>): Promise<NotificationSettings | undefined> {
    if (!this.notificationSettingsData) {
      this.notificationSettingsData = {
        id: 1,
        lowStockAlerts: settings.lowStockAlerts ?? true,
        orderConfirmation: settings.orderConfirmation ?? true,
        shippingUpdates: settings.shippingUpdates ?? true,
        dailyReports: settings.dailyReports ?? false,
        weeklyReports: settings.weeklyReports ?? true,
        soundEnabled: settings.soundEnabled ?? true,
        slackEnabled: settings.slackEnabled ?? false,
        slackWebhookUrl: settings.slackWebhookUrl ?? null,
        slackNotifyNewOrders: settings.slackNotifyNewOrders ?? true,
        slackNotifyCallLogs: settings.slackNotifyCallLogs ?? true,
        slackNotifyLowStock: settings.slackNotifyLowStock ?? false,
        slackOrderTemplate: settings.slackOrderTemplate ?? null,
        slackCallLogTemplate: settings.slackCallLogTemplate ?? null,
        slackLowStockTemplate: settings.slackLowStockTemplate ?? null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } else {
      this.notificationSettingsData = {
        ...this.notificationSettingsData,
        ...settings,
        updatedAt: new Date()
      };
    }
    return this.notificationSettingsData;
  }
} 