import { useEffect } from "react";
import { useSidebar } from "@/context/SidebarContext";
import QuickStats from "@/components/dashboard/QuickStats";
import RecentOrders from "@/components/dashboard/RecentOrders";
import InventoryAlerts from "@/components/dashboard/InventoryAlerts";
import OrderForm from "@/components/orders/OrderForm";
import { Line } from 'react-chartjs-2'; // Added import for chart

const OrderTrends = () => { // New component for order trends
  const data = {
    labels: ['January', 'February', 'March', 'April', 'May', 'June'],
    datasets: [{
      label: 'Order Count',
      data: [12, 19, 3, 5, 2, 3],
      fill: false,
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1
    }]
  };
  return (
    <div>
        <h2>Order Trends</h2>
        <Line data={data} />
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