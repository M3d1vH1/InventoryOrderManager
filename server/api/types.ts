import { Customer } from "../../shared/schema";

// Define types for the OrderWithItems used in label service
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