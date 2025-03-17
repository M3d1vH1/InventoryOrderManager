import { useQuery } from "@tanstack/react-query";

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-4 flex items-center">
        <div className="rounded-full bg-blue-100 p-3 mr-4">
          <i className="fas fa-shopping-cart text-primary text-xl"></i>
        </div>
        <div>
          <h3 className="text-sm text-slate-500 font-medium">Pending Orders</h3>
          <p className="text-2xl font-semibold">{stats?.pendingOrders || 0}</p>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4 flex items-center">
        <div className="rounded-full bg-amber-100 p-3 mr-4">
          <i className="fas fa-box text-amber-500 text-xl"></i>
        </div>
        <div>
          <h3 className="text-sm text-slate-500 font-medium">Items to Pick</h3>
          <p className="text-2xl font-semibold">{stats?.itemsToPick || 0}</p>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4 flex items-center">
        <div className="rounded-full bg-green-100 p-3 mr-4">
          <i className="fas fa-check-circle text-green-500 text-xl"></i>
        </div>
        <div>
          <h3 className="text-sm text-slate-500 font-medium">Shipped Today</h3>
          <p className="text-2xl font-semibold">{stats?.shippedToday || 0}</p>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4 flex items-center">
        <div className="rounded-full bg-red-100 p-3 mr-4">
          <i className="fas fa-exclamation-triangle text-red-500 text-xl"></i>
        </div>
        <div>
          <h3 className="text-sm text-slate-500 font-medium">Low Stock Items</h3>
          <p className="text-2xl font-semibold">{stats?.lowStockItems || 0}</p>
        </div>
      </div>
    </div>
  );
};

export default QuickStats;
