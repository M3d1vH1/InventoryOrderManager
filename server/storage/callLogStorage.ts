import { CallLog, InsertCallLog } from '@shared/schema';
import { IStorage } from '../storage';

export interface ICallLogStorage {
  getCallLog(id: number): Promise<CallLog | undefined>;
  getAllCallLogs(): Promise<CallLog[]>;
  createCallLog(callLog: InsertCallLog): Promise<CallLog>;
  updateCallLog(id: number, callLog: Partial<InsertCallLog>): Promise<CallLog | undefined>;
  deleteCallLog(id: number): Promise<boolean>;
  getCallLogsByCustomer(customerId: number): Promise<CallLog[]>;
  getCallLogsByDateRange(startDate: Date, endDate: Date): Promise<CallLog[]>;
  getCallLogsByStatus(status: string): Promise<CallLog[]>;
  getCallLogsByType(type: string): Promise<CallLog[]>;
  getCallLogsByPurpose(purpose: string): Promise<CallLog[]>;
  getCallLogsNeedingFollowup(): Promise<CallLog[]>;
  getCallLogsByUser(userId: number): Promise<CallLog[]>;
}

export class MemCallLogStorage implements ICallLogStorage {
  private callLogs: Map<number, CallLog>;
  private callLogIdCounter: number;

  constructor() {
    this.callLogs = new Map();
    this.callLogIdCounter = 1;
  }

  async getCallLog(id: number): Promise<CallLog | undefined> {
    return this.callLogs.get(id);
  }

  async getAllCallLogs(): Promise<CallLog[]> {
    return Array.from(this.callLogs.values());
  }

  async createCallLog(callLog: InsertCallLog): Promise<CallLog> {
    const id = this.callLogIdCounter++;
    const newCallLog: CallLog = {
      id,
      customerId: callLog.customerId ?? null,
      contactName: callLog.contactName,
      companyName: callLog.companyName ?? null,
      subject: callLog.subject ?? null,
      callDate: callLog.callDate,
      callTime: callLog.callTime ?? null,
      duration: callLog.duration ?? null,
      callType: callLog.callType,
      callPurpose: callLog.callPurpose,
      callStatus: callLog.callStatus,
      priority: callLog.priority ?? 'normal',
      notes: callLog.notes ?? null,
      userId: callLog.userId,
      followupDate: callLog.followupDate ?? null,
      followupTime: callLog.followupTime ?? null,
      followupAssignedTo: callLog.followupAssignedTo ?? null,
      reminderSent: false,
      isFollowup: callLog.isFollowup ?? false,
      previousCallId: callLog.previousCallId ?? null,
      tags: callLog.tags ?? [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.callLogs.set(id, newCallLog);
    return newCallLog;
  }

  async updateCallLog(id: number, callLogUpdate: Partial<InsertCallLog>): Promise<CallLog | undefined> {
    const callLog = this.callLogs.get(id);
    if (callLog) {
      const updatedCallLog = {
        ...callLog,
        ...callLogUpdate,
        updatedAt: new Date()
      };
      this.callLogs.set(id, updatedCallLog);
      return updatedCallLog;
    }
    return undefined;
  }

  async deleteCallLog(id: number): Promise<boolean> {
    return this.callLogs.delete(id);
  }

  async getCallLogsByCustomer(customerId: number): Promise<CallLog[]> {
    return Array.from(this.callLogs.values())
      .filter(log => log.customerId === customerId);
  }

  async getCallLogsByDateRange(startDate: Date, endDate: Date): Promise<CallLog[]> {
    return Array.from(this.callLogs.values())
      .filter(log => {
        const callDate = log.callDate;
        return callDate >= startDate && callDate <= endDate;
      });
  }

  async getCallLogsByStatus(status: string): Promise<CallLog[]> {
    return Array.from(this.callLogs.values())
      .filter(log => log.callStatus === status);
  }

  async getCallLogsByType(type: string): Promise<CallLog[]> {
    return Array.from(this.callLogs.values())
      .filter(log => log.callType === type);
  }

  async getCallLogsByPurpose(purpose: string): Promise<CallLog[]> {
    return Array.from(this.callLogs.values())
      .filter(log => log.callPurpose === purpose);
  }

  async getCallLogsNeedingFollowup(): Promise<CallLog[]> {
    const now = new Date();
    return Array.from(this.callLogs.values())
      .filter(log => {
        if (!log.followupDate) return false;
        return log.followupDate > now && !log.reminderSent;
      });
  }

  async getCallLogsByUser(userId: number): Promise<CallLog[]> {
    return Array.from(this.callLogs.values())
      .filter(log => log.userId === userId);
  }
} 