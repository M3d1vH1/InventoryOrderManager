import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "@/lib/utils";
import type { Order } from "@/lib/types";

import { useQuery } from "@tanstack/react-query";

const RecentOrders = () => {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['/api/orders/recent'],
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Recent Orders</h2>
      <div className="space-y-4">
        {orders.map((order: Order) => (
          <div key={order.id} className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
            <div>
              <div className="font-medium">{order.customerName}</div>
              <div className="text-sm text-gray-500">
                {format(parseISO(order.orderDate), 'MMM d, yyyy')}
              </div>
            </div>
            <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentOrders;