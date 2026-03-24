import { useEffect } from "react";
import { useSidebar } from "@/context/SidebarContext";
import QuickStats from "@/components/dashboard/QuickStats";
import RecentOrders from "@/components/dashboard/RecentOrders";
import InventoryAlerts from "@/components/dashboard/InventoryAlerts";
import SlowMovingItems from "@/components/dashboard/SlowMovingItems";

const Dashboard = () => {
  const { setCurrentPage } = useSidebar();

  useEffect(() => {
    setCurrentPage("Dashboard");
  }, [setCurrentPage]);

  return (
    <div className="space-y-6">
      <QuickStats />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <RecentOrders />
        </div>
        <div className="lg:col-span-2">
          <InventoryAlerts />
        </div>
      </div>

      <div className="card-floating p-5 animate-fade-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'backwards' }}>
        <SlowMovingItems />
      </div>
    </div>
  );
};

export default Dashboard;
