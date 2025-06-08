import { OrderChangelog, InsertOrderChangelog } from '@shared/schema';
import { IStorage } from '../storage';

export interface IOrderChangelogStorage {
  getOrderChangelog(id: number): Promise<OrderChangelog | undefined>;
  getOrderChangelogs(orderId: number): Promise<OrderChangelog[]>;
  createOrderChangelog(changelog: InsertOrderChangelog): Promise<OrderChangelog>;
  getOrderChangelogsByDateRange(startDate: Date, endDate: Date): Promise<OrderChangelog[]>;
  getOrderChangelogsByAction(action: string): Promise<OrderChangelog[]>;
  getOrderChangelogsByUser(userId: number): Promise<OrderChangelog[]>;
}

export class MemOrderChangelogStorage implements IOrderChangelogStorage {
  private changelogs: Map<number, OrderChangelog>;
  private orderChangelogs: Map<number, number[]>;
  private changelogIdCounter: number;

  constructor() {
    this.changelogs = new Map();
    this.orderChangelogs = new Map();
    this.changelogIdCounter = 1;
  }

  async getOrderChangelog(id: number): Promise<OrderChangelog | undefined> {
    return this.changelogs.get(id);
  }

  async getOrderChangelogs(orderId: number): Promise<OrderChangelog[]> {
    const changelogIds = this.orderChangelogs.get(orderId) ?? [];
    return changelogIds
      .map(id => this.changelogs.get(id))
      .filter((changelog): changelog is OrderChangelog => changelog !== undefined);
  }

  async createOrderChangelog(changelog: InsertOrderChangelog): Promise<OrderChangelog> {
    const id = this.changelogIdCounter++;
    const newChangelog: OrderChangelog = {
      id,
      orderId: changelog.orderId,
      userId: changelog.userId,
      action: changelog.action,
      timestamp: new Date(),
      changes: changelog.changes ?? null,
      previousValues: changelog.previousValues ?? null,
      notes: changelog.notes ?? null
    };
    this.changelogs.set(id, newChangelog);

    const orderChangelogs = this.orderChangelogs.get(changelog.orderId) ?? [];
    orderChangelogs.push(id);
    this.orderChangelogs.set(changelog.orderId, orderChangelogs);

    return newChangelog;
  }

  async getOrderChangelogsByDateRange(startDate: Date, endDate: Date): Promise<OrderChangelog[]> {
    return Array.from(this.changelogs.values())
      .filter(changelog => {
        const timestamp = changelog.timestamp;
        return timestamp >= startDate && timestamp <= endDate;
      });
  }

  async getOrderChangelogsByAction(action: string): Promise<OrderChangelog[]> {
    return Array.from(this.changelogs.values())
      .filter(changelog => changelog.action === action);
  }

  async getOrderChangelogsByUser(userId: number): Promise<OrderChangelog[]> {
    return Array.from(this.changelogs.values())
      .filter(changelog => changelog.userId === userId);
  }
} 