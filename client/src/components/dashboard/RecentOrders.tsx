import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";

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

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'picked':
      return 'bg-blue-100 text-blue-800';
    case 'shipped':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
};

const RecentOrders = () => {
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders/recent'],
  });

  const renderTableBody = () => {
    if (isLoading) {
      return Array(4).fill(0).map((_, index) => (
        <tr key={index} className="animate-pulse">
          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded"></div></td>
          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded"></div></td>
          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded"></div></td>
          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-8"></div></td>
          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-12"></div></td>
        </tr>
      ));
    }

    if (!orders || orders.length === 0) {
      return (
        <tr>
          <td colSpan={6} className="py-6 text-center text-slate-500">
            No recent orders found
          </td>
        </tr>
      );
    }

    return orders.map((order) => (
      <tr key={order.id} className="hover:bg-slate-50">
        <td className="py-3 px-4">{order.orderNumber}</td>
        <td className="py-3 px-4">{order.customerName || '?'}</td>
        <td className="py-3 px-4">{format(new Date(order.orderDate), 'MMM dd, yyyy')}</td>
        <td className="py-3 px-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
            {order.status?.charAt(0)?.toUpperCase() + order.status?.slice(1) || '?'}
          </span>
        </td>
        <td className="py-3 px-4">{order.items?.length || 0}</td>
        <td className="py-3 px-4">
          <div className="flex space-x-2">
            <Link href={`/orders/${order.id}`}>
              <button className="text-slate-600 hover:text-primary">
                <i className="fas fa-eye"></i>
              </button>
            </Link>
            <Link href={`/orders/${order.id}/edit`}>
              <button className="text-slate-600 hover:text-primary">
                <i className="fas fa-edit"></i>
              </button>
            </Link>
          </div>
        </td>
      </tr>
    ));
  };

  return (
    <div className="lg:col-span-2 bg-white rounded-lg shadow">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <h2 className="font-semibold text-lg">Recent Orders</h2>
        <Link href="/orders">
          <button className="text-primary hover:text-blue-700 text-sm font-medium">
            View All
          </button>
        </Link>
      </div>
      {/* Added chart placeholder */}
      <div className="p-4">
        {/*  Replace this with your actual chart component */}
        <div>Order Trend Chart (Implementation Needed)</div> 
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50 text-slate-500 text-sm">
            <tr>
              <th className="py-3 px-4 text-left font-medium">Order ID</th>
              <th className="py-3 px-4 text-left font-medium">Customer</th>
              <th className="py-3 px-4 text-left font-medium">Date</th>
              <th className="py-3 px-4 text-left font-medium">Status</th>
              <th className="py-3 px-4 text-left font-medium">Items</th>
              <th className="py-3 px-4 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {renderTableBody()}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-slate-200 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">
            {isLoading 
              ? "Loading..." 
              : orders?.length 
                ? `Showing ${orders.length} of ${orders.length} orders`
                : "No orders found"
            }
          </span>
          <div className="flex items-center space-x-1">
            <button className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              <i className="fas fa-chevron-left"></i>
            </button>
            <button className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecentOrders;