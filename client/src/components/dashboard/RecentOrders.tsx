
import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const RecentOrders = () => {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => apiRequest('GET', '/api/orders')
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {orders.slice(0, 5).map((order: Order) => (
        <div key={order.id} className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
          <div>
            <p className="font-medium">{order.customerName || 'N/A'}</p>
            <p className="text-sm text-gray-500">
              {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          <Badge className={getStatusColor(order.status || 'pending')}>
            {order.status || 'pending'}
          </Badge>
        </div>
      ))}
    </div>
  );
};

export default RecentOrders;
