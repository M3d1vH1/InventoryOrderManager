import { z } from 'zod';

// Define any missing types for the OrderWithItems used in label service
export interface Customer {
  id: number;
  name: string;
  vatNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  shippingCompany?: string | null;
  preferredShippingCompany?: string | null;
  billingCompany?: string | null;
  notes?: string | null;
  createdAt: Date;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  name: string;
  sku: string;
  quantity: number;
  price?: number | null;
  category?: string | null;
  tags?: string[] | null;
  piecesPerBox?: number | null;
}

export interface OrderWithItems {
  id: number;
  orderNumber: string;
  customerName: string;
  customerAddress?: string | null;
  customerCity?: string | null;
  customerState?: string | null;
  customerPostalCode?: string | null;
  customerCountry?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerVat?: string | null;
  status: string;
  priority?: string | null;
  area?: string | null;
  notes?: string | null;
  items: OrderItem[];
  customer?: Customer | null;
  createdAt: Date;
  updatedAt: Date;
  // Added properties for grouped display
  groupedItems?: Record<string, OrderItem[]>;
  tagGroups?: string[];
}

// Define the schema for order changelog
export const orderChangelogSchema = z.object({
  orderId: z.number(),
  userId: z.number(),
  changeType: z.string(),
  details: z.string().optional()
});

// Define the type for order changelog
export type OrderChangelog = z.infer<typeof orderChangelogSchema>;