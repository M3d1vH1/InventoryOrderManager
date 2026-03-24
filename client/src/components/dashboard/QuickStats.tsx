import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ShoppingCart, Package, CheckCircle, AlertTriangle, Phone, AlertOctagon, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";

interface Stats {
  pendingOrders: number;
  itemsToPick: number;
  shippedToday: number;
  lowStockItems: number;
  callsYesterday: number;
  errorsPerFiftyOrders: number;
}

const AnimatedNumber = ({ value, decimals = 0 }: { value: number; decimals?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const duration = 800;
    const startTime = performance.now();
    const startValue = displayValue;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (value - startValue) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span ref={ref}>{decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue)}</span>;
};

const QuickStats = () => {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['/api/dashboard/stats'],
    select: (data: any) => {
      if (data && typeof data === 'object' && 'data' in data) {
        return data.data;
      }
      return data || {};
    }
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card-floating p-5 h-[120px]">
            <div className="flex items-start justify-between mb-3">
              <div className="shimmer rounded-xl h-10 w-10" />
              <div className="shimmer rounded-lg h-5 w-12" />
            </div>
            <div className="shimmer rounded-lg h-4 w-24 mb-2" />
            <div className="shimmer rounded-lg h-7 w-16" />
          </div>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: t('dashboard.stats.pendingOrders'),
      value: stats?.pendingOrders || 0,
      icon: <ShoppingCart className="h-5 w-5" />,
      gradient: "from-blue-500 to-indigo-500",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      shadowColor: "shadow-blue-500/10",
      path: "/orders",
      filter: "?status=pending"
    },
    {
      title: t('dashboard.stats.itemsToPick'),
      value: stats?.itemsToPick || 0,
      icon: <Package className="h-5 w-5" />,
      gradient: "from-amber-500 to-orange-500",
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      shadowColor: "shadow-amber-500/10",
      path: "/order-picking"
    },
    {
      title: t('dashboard.stats.shippedOrders'),
      value: stats?.shippedToday || 0,
      icon: <CheckCircle className="h-5 w-5" />,
      gradient: "from-emerald-500 to-teal-500",
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-500",
      shadowColor: "shadow-emerald-500/10",
      path: "/orders",
      filter: "?status=shipped"
    },
    {
      title: t('dashboard.stats.lowStock'),
      value: stats?.lowStockItems || 0,
      icon: <AlertTriangle className="h-5 w-5" />,
      gradient: "from-rose-500 to-pink-500",
      iconBg: "bg-rose-50",
      iconColor: "text-rose-500",
      shadowColor: "shadow-rose-500/10",
      path: "/products",
      filter: "?stock=low"
    },
    {
      title: t('dashboard.stats.callsYesterday') || "Yesterday's Calls",
      value: stats?.callsYesterday || 0,
      icon: <Phone className="h-5 w-5" />,
      gradient: "from-violet-500 to-purple-500",
      iconBg: "bg-violet-50",
      iconColor: "text-violet-500",
      shadowColor: "shadow-violet-500/10",
      path: "/call-logs"
    },
    {
      title: t('dashboard.stats.errorsPerFiftyOrders') || "Errors per 50 Orders",
      value: stats?.errorsPerFiftyOrders || 0,
      decimals: 1,
      icon: <AlertOctagon className="h-5 w-5" />,
      gradient: "from-orange-500 to-amber-500",
      iconBg: "bg-orange-50",
      iconColor: "text-orange-500",
      shadowColor: "shadow-orange-500/10",
      path: "/order-errors"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 mb-6">
      {statCards.map((card, index) => (
        <Link key={index} href={card.path + (card.filter || "")}>
          <div
            className={`card-floating p-5 cursor-pointer group animate-fade-in-up stagger-${index + 1}`}
            style={{ animationFillMode: 'backwards' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`${card.iconBg} rounded-xl p-2.5 ${card.shadowColor} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                <span className={card.iconColor}>{card.icon}</span>
              </div>
              <ArrowUpRight size={16} className="text-slate-300 group-hover:text-teal-400 transition-colors duration-200 opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0 -translate-y-1 group-hover:translate-y-0" />
            </div>
            <h3 className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{card.title}</h3>
            <p className="text-2xl font-bold text-slate-900 tracking-tight">
              <AnimatedNumber value={card.value as number} decimals={(card as any).decimals || 0} />
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default QuickStats;
