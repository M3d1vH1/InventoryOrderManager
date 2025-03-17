import { useEffect } from "react";
import { useSidebar } from "@/context/SidebarContext";
import QuickStats from "@/components/dashboard/QuickStats";
import RecentOrders from "@/components/dashboard/RecentOrders";
import InventoryAlerts from "@/components/dashboard/InventoryAlerts";
import OrderForm from "@/components/orders/OrderForm";

const Dashboard = () => {
  const { setCurrentPage } = useSidebar();

  useEffect(() => {
    setCurrentPage("Dashboard");
  }, [setCurrentPage]);

  return (
    <div>
      <QuickStats />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <RecentOrders />
        <InventoryAlerts />
      </div>
      
      <OrderForm />
    </div>
  );
};

export default Dashboard;
