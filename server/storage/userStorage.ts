import { User, InsertUser, UserRole } from '@shared/schema';
import { IStorage } from '../storage';

export interface IUserStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getRolePermissionsForUser(userId: number): Promise<UserRole[]>;
  assignRoleToUser(userId: number, roleName: string): Promise<UserRole>;
  removeRoleFromUser(userId: number, roleName: string): Promise<boolean>;
}

export class MemUserStorage implements IUserStorage {
  private users: Map<number, User>;
  private userIdCounter: number;
  private userRoles: Map<string, UserRole>;
  private userRoleIdCounter: number;

  constructor() {
    this.users = new Map();
    this.userIdCounter = 1;
    this.userRoles = new Map();
    this.userRoleIdCounter = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const newUser: User = {
      id,
      ...user,
      email: user.email ?? null,
      createdAt: new Date(),
      lastLogin: null,
      active: true
    };
    this.users.set(id, newUser);
    return newUser;
  }

  async updateUserLastLogin(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      user.lastLogin = new Date();
      this.users.set(id, user);
    }
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      const updatedUser = { ...user, ...userData };
      this.users.set(id, updatedUser);
      return updatedUser;
    }
    return undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async getRolePermissionsForUser(userId: number): Promise<UserRole[]> {
    return Array.from(this.userRoles.values())
      .filter(ur => ur.userId === userId);
  }

  async assignRoleToUser(userId: number, roleName: string): Promise<UserRole> {
    const id = this.userRoleIdCounter++;
    const newRole: UserRole = {
      id,
      userId,
      roleId: 0, // This should be looked up from the roles table
      createdAt: new Date()
    };
    this.userRoles.set(`${userId}-${roleName}`, newRole);
    return newRole;
  }

  async removeRoleFromUser(userId: number, roleName: string): Promise<boolean> {
    const key = `${userId}-${roleName}`;
    return this.userRoles.delete(key);
  }
} 