import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Eye, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  priority?: 'low' | 'medium' | 'high' | 'urgent';
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

const getPriorityBadgeClass = (priority?: string) => {
  switch (priority) {
    case 'low':
      return 'bg-slate-100 text-slate-800';
    case 'medium':
      return 'bg-blue-100 text-blue-800';
    case 'high':
      return 'bg-amber-100 text-amber-800';
    case 'urgent':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
};

const RecentOrders = () => {
  const { t } = useTranslation();
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
          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-8"></div></td>
          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-12"></div></td>
        </tr>
      ));
    }

    if (!orders || orders.length === 0) {
      return (
        <tr>
          <td colSpan={7} className="py-6 text-center text-slate-500">
            {t('orders.noOrdersFound')}
          </td>
        </tr>
      );
    }

    return orders.map((order) => (
      <tr key={order.id} className="hover:bg-slate-50">
        <td className="py-3 px-4">{order.orderNumber}</td>
        <td className="py-3 px-4">{order.customerName}</td>
        <td className="py-3 px-4">{format(new Date(order.orderDate), 'MMM dd, yyyy')}</td>
        <td className="py-3 px-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
            {t(`orders.statusValues.${order.status}`)}
          </span>
        </td>
        <td className="py-3 px-4">
          {order.priority && 
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityBadgeClass(order.priority)}`}>
              {t(`orders.form.priorities.${order.priority}`)}
            </span>
          }
        </td>
        <td className="py-3 px-4">{order.items?.length || 0}</td>
        <td className="py-3 px-4">
          <div className="flex space-x-2">
            <Link href={`/orders/${order.id}`} className="text-slate-600 hover:text-primary">
              <Eye className="h-4 w-4" />
            </Link>
            <Link href={`/orders/${order.id}/edit`} className="text-slate-600 hover:text-primary">
              <Edit className="h-4 w-4" />
            </Link>
          </div>
        </td>
      </tr>
    ));
  };

  return (
    <div className="lg:col-span-2 bg-white rounded-lg shadow">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <h2 className="font-semibold text-lg">{t('dashboard.recentOrders')}</h2>
        <Link href="/orders" className="text-primary hover:text-blue-700 text-sm font-medium">
          {t('common.viewAll')}
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50 text-slate-500 text-sm">
            <tr>
              <th className="py-3 px-4 text-left font-medium">{t('orders.columns.orderId')}</th>
              <th className="py-3 px-4 text-left font-medium">{t('orders.columns.customer')}</th>
              <th className="py-3 px-4 text-left font-medium">{t('orders.columns.date')}</th>
              <th className="py-3 px-4 text-left font-medium">{t('orders.columns.status')}</th>
              <th className="py-3 px-4 text-left font-medium">{t('orders.columns.priority')}</th>
              <th className="py-3 px-4 text-left font-medium">{t('orders.columns.items')}</th>
              <th className="py-3 px-4 text-left font-medium">{t('orders.columns.actions')}</th>
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
              ? t('common.loading')
              : orders?.length 
                ? t('orders.showingOrders', { count: orders.length, total: orders.length })
                : t('orders.noOrdersFound')
            }
          </span>
          <div className="flex items-center space-x-1">
            <button className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecentOrders;
