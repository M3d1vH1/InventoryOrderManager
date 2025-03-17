import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSidebar } from "@/context/SidebarContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import PickList from "@/components/orders/PickList";
import { useLocation } from "wouter";

interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
}

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  orderDate: string;
  status: 'pending' | 'picked' | 'shipped' | 'cancelled';
  notes?: string;
  items?: OrderItem[];
}

const OrderPicking = () => {
  const { setCurrentPage } = useSidebar();
  const [location] = useLocation();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  // Extract order ID from URL if it exists
  useEffect(() => {
    const orderId = location.split('/').pop();
    if (orderId && !isNaN(Number(orderId))) {
      setSelectedOrderId(orderId);
    }
  }, [location]);
  
  useEffect(() => {
    setCurrentPage("OrderPicking");
  }, [setCurrentPage]);

  // Fetch all orders
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
  });

  // Filter orders that can be picked (pending status)
  const pickableOrders = orders.filter(order => order.status === 'pending');
  
  // Get the selected order details
  const selectedOrder = orders.find(order => order.id.toString() === selectedOrderId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Order Picking</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Pending Orders</CardTitle>
              <CardDescription>
                Select an order to create a pick list
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center p-4">Loading orders...</div>
              ) : pickableOrders.length === 0 ? (
                <div className="text-center p-4 text-slate-500">No pending orders to pick</div>
              ) : (
                <div className="space-y-4">
                  <Select 
                    value={selectedOrderId || ""} 
                    onValueChange={setSelectedOrderId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an order" />
                    </SelectTrigger>
                    <SelectContent>
                      {pickableOrders.map(order => (
                        <SelectItem key={order.id} value={order.id.toString()}>
                          {order.orderNumber} - {order.customerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Order Status Legend:</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge>Pending</Badge>
                      <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">
                        Picking
                      </Badge>
                      <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50">
                        Picked
                      </Badge>
                      <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50">
                        Shipped
                      </Badge>
                      <Badge variant="outline" className="border-red-500 text-red-700 bg-red-50">
                        Cancelled
                      </Badge>
                    </div>
                  </div>

                  {orders.length > pickableOrders.length && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <h3 className="text-sm font-medium mb-2">Recently Picked:</h3>
                      <ul className="space-y-2">
                        {orders
                          .filter(order => order.status === 'picked')
                          .slice(0, 3)
                          .map(order => (
                            <li key={order.id} className="flex justify-between items-center text-sm">
                              <span>{order.orderNumber}</span>
                              <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50">
                                Picked
                              </Badge>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          {selectedOrder ? (
            <PickList order={selectedOrder} />
          ) : (
            <Card>
              <CardContent className="pt-6 pb-6">
                <div className="text-center text-slate-500">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="mx-auto h-12 w-12 text-slate-400"
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" 
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-slate-900">No order selected</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Select an order from the list to create a pick list.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderPicking;