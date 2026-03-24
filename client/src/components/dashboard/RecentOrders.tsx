import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Eye, Edit, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
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
      return 'bg-amber-50 text-amber-600 border-amber-200/60';
    case 'picked':
      return 'bg-blue-50 text-blue-600 border-blue-200/60';
    case 'shipped':
      return 'bg-emerald-50 text-emerald-600 border-emerald-200/60';
    case 'cancelled':
      return 'bg-rose-50 text-rose-600 border-rose-200/60';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200/60';
  }
};

const getPriorityBadgeClass = (priority?: string) => {
  switch (priority) {
    case 'low':
      return 'bg-slate-50 text-slate-500 border-slate-200/60';
    case 'medium':
      return 'bg-blue-50 text-blue-500 border-blue-200/60';
    case 'high':
      return 'bg-amber-50 text-amber-600 border-amber-200/60';
    case 'urgent':
      return 'bg-rose-50 text-rose-600 border-rose-200/60';
    default:
      return 'bg-slate-50 text-slate-500 border-slate-200/60';
  }
};

const RecentOrders = () => {
  const { t } = useTranslation();
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders/recent'],
    select: (data: any) => {
      if (data && typeof data === 'object' && 'data' in data) {
        return Array.isArray(data.data) ? data.data : [];
      }
      return Array.isArray(data) ? data : [];
    }
  });

  const renderTableBody = () => {
    if (isLoading) {
      return Array(4).fill(0).map((_, index) => (
        <tr key={index}>
          <td className="py-3 px-4"><div className="shimmer h-4 rounded-lg w-20" /></td>
          <td className="py-3 px-4"><div className="shimmer h-4 rounded-lg w-28" /></td>
          <td className="py-3 px-4"><div className="shimmer h-4 rounded-lg w-24" /></td>
          <td className="py-3 px-4"><div className="shimmer h-5 rounded-full w-16" /></td>
          <td className="py-3 px-4"><div className="shimmer h-5 rounded-full w-16" /></td>
          <td className="py-3 px-4"><div className="shimmer h-4 rounded-lg w-8" /></td>
          <td className="py-3 px-4"><div className="shimmer h-4 rounded-lg w-12" /></td>
        </tr>
      ));
    }

    if (!orders || orders.length === 0) {
      return (
        <tr>
          <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
            {t('orders.noOrdersFound')}
          </td>
        </tr>
      );
    }

    return orders.map((order) => (
      <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
        <td className="py-3 px-4 text-sm font-medium text-slate-900">{order.orderNumber}</td>
        <td className="py-3 px-4 text-sm text-slate-600">{order.customerName}</td>
        <td className="py-3 px-4 text-sm text-slate-500">{format(new Date(order.orderDate), 'MMM dd, yyyy')}</td>
        <td className="py-3 px-4">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClass(order.status)}`}>
            {t(`orders.statusValues.${order.status}`)}
          </span>
        </td>
        <td className="py-3 px-4">
          {order.priority &&
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getPriorityBadgeClass(order.priority)}`}>
              {t(`orders.form.priorities.${order.priority}`)}
            </span>
          }
        </td>
        <td className="py-3 px-4 text-sm text-slate-500 text-center">{order.items?.length || 0}</td>
        <td className="py-3 px-4">
          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Link href={`/orders/${order.id}`} className="text-slate-400 hover:text-teal-500 p-1 rounded-lg hover:bg-teal-50 transition-colors">
              <Eye className="h-4 w-4" />
            </Link>
            <Link href={`/orders/${order.id}/edit`} className="text-slate-400 hover:text-teal-500 p-1 rounded-lg hover:bg-teal-50 transition-colors">
              <Edit className="h-4 w-4" />
            </Link>
          </div>
        </td>
      </tr>
    ));
  };

  return (
    <div className="card-floating overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.1s', animationFillMode: 'backwards' }}>
      <div className="p-5 flex justify-between items-center">
        <h2 className="font-semibold text-base text-slate-900">{t('dashboard.recentOrders')}</h2>
        <Link href="/orders" className="text-teal-500 hover:text-teal-600 text-sm font-medium flex items-center gap-1 transition-colors">
          {t('common.viewAll')}
          <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-t border-b border-slate-100">
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('orders.columns.orderId')}</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('orders.columns.customer')}</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('orders.columns.date')}</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('orders.columns.status')}</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('orders.columns.priority')}</th>
              <th className="py-3 px-4 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">{t('orders.columns.items')}</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('orders.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {renderTableBody()}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-slate-100 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs">
            {isLoading
              ? t('common.loading')
              : orders?.length
                ? t('orders.showingOrders', { count: orders.length, total: orders.length })
                : t('orders.noOrdersFound')
            }
          </span>
          <div className="flex items-center space-x-1">
            <button className="px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-white text-slate-400 hover:bg-slate-50 disabled:opacity-40 transition-colors" disabled>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button className="px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-white text-slate-400 hover:bg-slate-50 disabled:opacity-40 transition-colors" disabled>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecentOrders;
