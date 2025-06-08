import { ShippingDocument, InsertShippingDocument } from '@shared/schema';
import { IStorage } from '../storage';

export interface IShippingDocumentStorage {
  getShippingDocument(id: number): Promise<ShippingDocument | undefined>;
  getShippingDocumentByOrderId(orderId: number): Promise<ShippingDocument | undefined>;
  getAllShippingDocuments(): Promise<ShippingDocument[]>;
  createShippingDocument(document: InsertShippingDocument): Promise<ShippingDocument>;
  updateShippingDocument(id: number, document: Partial<InsertShippingDocument>): Promise<ShippingDocument | undefined>;
  deleteShippingDocument(id: number): Promise<boolean>;
  getShippingDocumentsByType(type: string): Promise<ShippingDocument[]>;
  getShippingDocumentsByDateRange(startDate: Date, endDate: Date): Promise<ShippingDocument[]>;
  getShippingDocumentsByTrackingNumber(trackingNumber: string): Promise<ShippingDocument[]>;
}

export class MemShippingDocumentStorage implements IShippingDocumentStorage {
  private documents: Map<number, ShippingDocument>;
  private orderDocuments: Map<number, number>;
  private documentIdCounter: number;

  constructor() {
    this.documents = new Map();
    this.orderDocuments = new Map();
    this.documentIdCounter = 1;
  }

  async getShippingDocument(id: number): Promise<ShippingDocument | undefined> {
    return this.documents.get(id);
  }

  async getShippingDocumentByOrderId(orderId: number): Promise<ShippingDocument | undefined> {
    const documentId = this.orderDocuments.get(orderId);
    if (documentId) {
      return this.documents.get(documentId);
    }
    return undefined;
  }

  async getAllShippingDocuments(): Promise<ShippingDocument[]> {
    return Array.from(this.documents.values());
  }

  async createShippingDocument(document: InsertShippingDocument): Promise<ShippingDocument> {
    const id = this.documentIdCounter++;
    const newDocument: ShippingDocument = {
      id,
      orderId: document.orderId,
      documentPath: document.documentPath,
      documentType: document.documentType,
      trackingNumber: document.trackingNumber ?? null,
      uploadDate: new Date(),
      notes: document.notes ?? null
    };
    this.documents.set(id, newDocument);
    this.orderDocuments.set(document.orderId, id);
    return newDocument;
  }

  async updateShippingDocument(id: number, documentUpdate: Partial<InsertShippingDocument>): Promise<ShippingDocument | undefined> {
    const document = this.documents.get(id);
    if (document) {
      const updatedDocument = {
        ...document,
        ...documentUpdate
      };
      this.documents.set(id, updatedDocument);
      return updatedDocument;
    }
    return undefined;
  }

  async deleteShippingDocument(id: number): Promise<boolean> {
    const document = this.documents.get(id);
    if (document) {
      this.orderDocuments.delete(document.orderId);
      return this.documents.delete(id);
    }
    return false;
  }

  async getShippingDocumentsByType(type: string): Promise<ShippingDocument[]> {
    return Array.from(this.documents.values())
      .filter(doc => doc.documentType === type);
  }

  async getShippingDocumentsByDateRange(startDate: Date, endDate: Date): Promise<ShippingDocument[]> {
    return Array.from(this.documents.values())
      .filter(doc => {
        const uploadDate = doc.uploadDate;
        return uploadDate >= startDate && uploadDate <= endDate;
      });
  }

  async getShippingDocumentsByTrackingNumber(trackingNumber: string): Promise<ShippingDocument[]> {
    return Array.from(this.documents.values())
      .filter(doc => doc.trackingNumber === trackingNumber);
  }
} 