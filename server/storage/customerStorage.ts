import { Customer, InsertCustomer } from '@shared/schema';
import { IStorage } from '../storage';

export interface ICustomerStorage {
  getCustomer(id: number): Promise<Customer | undefined>;
  getAllCustomers(): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;
  searchCustomers(query: string): Promise<Customer[]>;
  getCustomersByShippingCompany(company: string): Promise<Customer[]>;
  getCustomersByCountry(country: string): Promise<Customer[]>;
}

export class MemCustomerStorage implements ICustomerStorage {
  private customers: Map<number, Customer>;
  private customerIdCounter: number;

  constructor() {
    this.customers = new Map();
    this.customerIdCounter = 1;
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async getAllCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const id = this.customerIdCounter++;
    const newCustomer: Customer = {
      id,
      name: customer.name,
      vatNumber: customer.vatNumber ?? null,
      address: customer.address ?? null,
      city: customer.city ?? null,
      state: customer.state ?? null,
      postalCode: customer.postalCode ?? null,
      country: customer.country ?? null,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      contactPerson: customer.contactPerson ?? null,
      shippingCompany: customer.shippingCompany ?? null,
      preferredShippingCompany: customer.preferredShippingCompany ?? null,
      billingCompany: customer.billingCompany ?? null,
      notes: customer.notes ?? null,
      createdAt: new Date()
    };
    this.customers.set(id, newCustomer);
    return newCustomer;
  }

  async updateCustomer(id: number, customerUpdate: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    if (customer) {
      const updatedCustomer = {
        ...customer,
        ...customerUpdate
      };
      this.customers.set(id, updatedCustomer);
      return updatedCustomer;
    }
    return undefined;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    return this.customers.delete(id);
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    const searchTerm = query.toLowerCase();
    return Array.from(this.customers.values())
      .filter(customer => {
        return customer.name.toLowerCase().includes(searchTerm) ||
               customer.email?.toLowerCase().includes(searchTerm) ||
               customer.phone?.toLowerCase().includes(searchTerm);
      });
  }

  async getCustomersByShippingCompany(company: string): Promise<Customer[]> {
    return Array.from(this.customers.values())
      .filter(customer => customer.shippingCompany === company);
  }

  async getCustomersByCountry(country: string): Promise<Customer[]> {
    return Array.from(this.customers.values())
      .filter(customer => customer.country === country);
  }
} 