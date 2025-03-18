import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface Stats {
  pendingOrders: number;
  itemsToPick: number;
  shippedToday: number;
  lowStockItems: number;
}

const QuickStats = () => {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['/api/dashboard/stats'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-4 flex items-center animate-pulse">
            <div className="rounded-full bg-slate-200 p-3 mr-4 h-12 w-12"></div>
            <div className="w-full">
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
      title: "Pending Orders",
      value: stats?.pendingOrders || 0,
      icon: "fas fa-shopping-cart",
      bgColor: "bg-blue-100",
      textColor: "text-primary",
      path: "/orders",
      filter: "?status=pending"
    },
    {
      title: "Items to Pick",
      value: stats?.itemsToPick || 0,
      icon: "fas fa-box",
      bgColor: "bg-amber-100",
      textColor: "text-amber-500",
      path: "/order-picking"
    },
    {
      title: "Shipped Today",
      value: stats?.shippedToday || 0,
      icon: "fas fa-check-circle",
      bgColor: "bg-green-100",
      textColor: "text-green-500",
      path: "/orders",
      filter: "?status=shipped"
    },
    {
      title: "Low Stock Items",
      value: stats?.lowStockItems || 0,
      icon: "fas fa-exclamation-triangle",
      bgColor: "bg-red-100",
      textColor: "text-red-500",
      path: "/products",
      filter: "?stock=low"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statCards.map((card, index) => (
        <Link key={index} href={card.path + (card.filter || "")}>
          <div className="bg-white rounded-lg shadow p-4 flex items-center hover:bg-slate-50 transition-colors cursor-pointer group">
            <div className={`rounded-full ${card.bgColor} p-3 mr-4 group-hover:scale-110 transition-transform`}>
              <i className={`${card.icon} ${card.textColor} text-xl`}></i>
            </div>
            <div>
              <h3 className="text-sm text-slate-500 font-medium">{card.title}</h3>
              <p className="text-2xl font-semibold">{card.value}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default QuickStats;
