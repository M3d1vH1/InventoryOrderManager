import { useState, useEffect } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useNotifications } from "@/context/NotificationContext";
import QuickStats from "@/components/dashboard/QuickStats";
import RecentOrders from "@/components/dashboard/RecentOrders";
import InventoryAlerts from "@/components/dashboard/InventoryAlerts";
import OrderForm from "@/components/orders/OrderForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlusCircle, Bell } from "lucide-react";

const Dashboard = () => {
  const { setCurrentPage } = useSidebar();
  const { playNotificationSound } = useNotifications();
  const [showOrderForm, setShowOrderForm] = useState(false);

  // Function to test notification sounds
  const testNotificationSound = (type: 'success' | 'warning' | 'error') => {
    playNotificationSound(type);
  };

  useEffect(() => {
    setCurrentPage("Dashboard");
  }, [setCurrentPage]);

  return (
    <div>
      <QuickStats />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <RecentOrders />
        <div className="flex flex-col">
          <Card className="h-full flex flex-col items-center justify-center p-6 mb-6">
            <div className="flex flex-col items-center text-center">
              <PlusCircle className="h-16 w-16 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-4">Create New Order</h3>
              <p className="text-muted-foreground mb-6">Quickly create a new customer order</p>
              <Button 
                size="lg"
                className="w-full"
                onClick={() => setShowOrderForm(true)}
              >
                Create Order
              </Button>
            </div>
          </Card>
          
          {/* Test Notification Card */}
          <Card className="p-6 mb-6">
            <div className="flex items-center mb-4">
              <Bell className="h-5 w-5 mr-2 text-primary" />
              <h3 className="text-lg font-semibold">Test Notifications</h3>
            </div>
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => testNotificationSound('success')}
              >
                <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                Success Sound
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => testNotificationSound('warning')}
              >
                <div className="w-3 h-3 rounded-full bg-amber-500 mr-2"></div>
                Warning Sound
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => testNotificationSound('error')}
              >
                <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                Error Sound
              </Button>
            </div>
          </Card>
          
          <InventoryAlerts />
        </div>
      </div>
      
      {showOrderForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Create New Order</h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowOrderForm(false)}
              >
                Close
              </Button>
            </div>
            <div className="p-4">
              <OrderForm onSuccess={() => setShowOrderForm(false)} onCancel={() => setShowOrderForm(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
