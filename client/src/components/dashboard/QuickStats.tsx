import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ShoppingCart, Package, CheckCircle, AlertTriangle, Phone, AlertOctagon } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Stats {
  pendingOrders: number;
  itemsToPick: number;
  shippedToday: number;
  lowStockItems: number;
  callsYesterday: number;
  errorsPerFiftyOrders: number;
}

const QuickStats = () => {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['/api/dashboard/stats'],
    select: (data: any) => {
      // Handle API response structure: { success: true, data: {...} }
      if (data && typeof data === 'object' && 'data' in data) {
        return data.data;
      }
      // Fallback for direct object response
      return data || {};
    }
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-4 flex items-center animate-pulse h-full">
            <div className="rounded-full bg-slate-200 p-3 mr-4 h-12 w-12 flex-shrink-0"></div>
            <div className="w-full min-w-0">
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div className="h-6 bg-slate-200 rounded w-1/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  const statCards = [
    {
      title: t('dashboard.stats.pendingOrders'),
      value: stats?.pendingOrders || 0,
      icon: <ShoppingCart className="h-6 w-6" />,
      bgColor: "bg-blue-100",
      textColor: "text-primary",
      path: "/orders",
      filter: "?status=pending"
    },
    {
      title: t('dashboard.stats.itemsToPick'),
      value: stats?.itemsToPick || 0,
      icon: <Package className="h-6 w-6" />,
      bgColor: "bg-amber-100",
      textColor: "text-amber-500",
      path: "/order-picking"
    },
    {
      title: t('dashboard.stats.shippedOrders'),
      value: stats?.shippedToday || 0,
      icon: <CheckCircle className="h-6 w-6" />,
      bgColor: "bg-green-100",
      textColor: "text-green-500",
      path: "/orders",
      filter: "?status=shipped"
    },
    {
      title: t('dashboard.stats.lowStock'),
      value: stats?.lowStockItems || 0,
      icon: <AlertTriangle className="h-6 w-6" />,
      bgColor: "bg-red-100",
      textColor: "text-red-500",
      path: "/products",
      filter: "?stock=low"
    },
    {
      title: t('dashboard.stats.callsYesterday') || "Yesterday's Calls",
      value: stats?.callsYesterday || 0,
      icon: <Phone className="h-6 w-6" />,
      bgColor: "bg-purple-100",
      textColor: "text-purple-500",
      path: "/call-logs"
    },
    {
      title: t('dashboard.stats.errorsPerFiftyOrders') || "Errors per 50 Orders",
      value: (stats?.errorsPerFiftyOrders || 0).toFixed(1),
      icon: <AlertOctagon className="h-6 w-6" />,
      bgColor: "bg-orange-100",
      textColor: "text-orange-500",
      path: "/order-errors"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 mb-6">
      {statCards.map((card, index) => (
        <Link key={index} href={card.path + (card.filter || "")}>
          <div className="bg-white rounded-lg shadow p-4 flex items-center hover:bg-slate-50 transition-colors cursor-pointer group h-full">
            <div className={`rounded-full ${card.bgColor} p-3 mr-4 group-hover:scale-110 transition-transform flex items-center justify-center h-12 w-12 flex-shrink-0`}>
              <span className={card.textColor}>{card.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm text-slate-500 font-medium truncate">{card.title}</h3>
              <p className="text-2xl font-semibold">{card.value}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default QuickStats;
