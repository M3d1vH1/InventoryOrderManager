import { useEffect } from "react";
import { useSidebar } from "@/context/SidebarContext";
import QuickStats from "@/components/dashboard/QuickStats";
import RecentOrders from "@/components/dashboard/RecentOrders";
import InventoryAlerts from "@/components/dashboard/InventoryAlerts";
import OrderForm from "@/components/orders/OrderForm";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { useQuery } from '@tanstack/react-query';

const OrderTrends = () => {
  const { data: orders = [] } = useQuery({
    queryKey: ['/api/orders'],
  });

  const data = React.useMemo(() => {
    if (!orders) return [];
    const grouped = orders.reduce((acc: any, order: any) => {
      const date = new Date(order.orderDate).toLocaleDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped).map(([date, count]) => ({ date, count }));
  }, [orders]);

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Order Trends</h2>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};


const Dashboard = () => {
  const { setCurrentPage } = useSidebar();

  useEffect(() => {
    setCurrentPage("Dashboard");
  }, [setCurrentPage]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <QuickStats />
      <OrderTrends /> {/* Added OrderTrends component */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> {/* Adjusted grid columns for larger screens */}
        <RecentOrders />
        <InventoryAlerts />
      </div>
      <OrderForm />
    </div>
  );
};

export default Dashboard;