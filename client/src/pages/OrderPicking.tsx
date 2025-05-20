import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { Button } from "@/components/ui/button";
import PickList from "@/components/orders/PickList";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Clipboard } from "lucide-react";

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

  // Fetch all orders with items
  const { data: orders = [], isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
    queryFn: async () => {
      const response = await fetch('/api/orders');
      const data = await response.json();
      return data;
    }
  });

  // Fetch specific order with items if ID is provided
  const { data: specificOrder, isLoading: isLoadingSpecificOrder } = useQuery<Order>({
    queryKey: ['/api/orders', selectedOrderId],
    enabled: !!selectedOrderId,
    queryFn: async () => {
      const response = await fetch(`/api/orders/${selectedOrderId}`);
      const data = await response.json();
      return data;
    }
  });

  // Filter orders that can be picked (pending status)
  const pickableOrders = orders.filter(order => order.status === 'pending');

  // Get the selected order details - either from the specific query or from all orders
  const selectedOrder = specificOrder || orders.find(order => order.id.toString() === selectedOrderId);

  // Combined loading state
  const isLoading = isLoadingOrders || isLoadingSpecificOrder;

  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('orderPickingPage.title')}</h1>
        <Link href="/orders">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('orderPickingPage.backToOrders')}
          </Button>
        </Link>
      </div>

      {/* Pending Orders List - Top Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('orderPickingPage.pendingOrders')}</CardTitle>
          <CardDescription>
            {t('orderPickingPage.selectOrderHelp')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center p-4">{t('common.loading')}</div>
          ) : pickableOrders.length === 0 ? (
            <div className="text-center p-4 text-slate-500">{t('orderPickingPage.noOrdersFound')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {pickableOrders.map(order => (
                <div 
                  key={order.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors
                    ${selectedOrderId === String(order.id) 
                      ? 'bg-primary/10 border-primary' 
                      : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50'}`}
                  onClick={() => setSelectedOrderId(String(order.id))}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{t('orders.order')} {order.orderNumber}</span>
                    <Badge variant="outline" className="text-xs">
                      {t('orders.itemCount', { count: order.items?.length || 0 })}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-600">
                    {t('orders.customer')}: {order.customerName}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {t('orders.created')}: {new Date(order.orderDate).toLocaleDateString('el-GR')}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex flex-wrap gap-2 mb-2">
              <h3 className="text-sm font-medium mr-2">{t('orders.columns.status')}:</h3>
              <Badge>{t('orders.statusValues.pending')}</Badge>
              <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">
                {t('orders.statusValues.picking')}
              </Badge>
              <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50">
                {t('orders.statusValues.picked')}
              </Badge>
              <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50">
                {t('orders.statusValues.shipped')}
              </Badge>
              <Badge variant="outline" className="border-red-500 text-red-700 bg-red-50">
                {t('orders.statusValues.cancelled')}
              </Badge>
            </div>

            {orders.length > pickableOrders.length && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div className="col-span-full sm:col-span-1">
                  <h3 className="text-sm font-medium mb-2">{t('orderPickingPage.recentlyPicked')}:</h3>
                </div>
                <div className="col-span-full sm:col-span-2">
                  <ul className="space-y-2">
                    {orders
                      .filter(order => order.status === 'picked')
                      .slice(0, 3)
                      .map(order => (
                        <li key={order.id} className="flex justify-between items-center text-sm">
                          <span>{order.orderNumber}</span>
                          <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50">
                            {t('orders.statusValues.picked')}
                          </Badge>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Picking Area - Bottom Section */}
      <div className="mt-6">
        {selectedOrder ? (
          <PickList order={selectedOrder} />
        ) : (
          <Card>
            <CardContent className="pt-6 pb-6">
              <div className="text-center text-slate-500">
                <Clipboard className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="mt-2 text-sm font-medium text-slate-900">{t('orderPickingPage.noOrderSelected')}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {t('orderPickingPage.selectOrderInstructions')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default OrderPicking;