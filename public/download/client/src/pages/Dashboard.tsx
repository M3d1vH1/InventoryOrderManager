import { useState, useEffect } from "react";
import { useSidebar } from "@/context/SidebarContext";
import QuickStats from "@/components/dashboard/QuickStats";
import RecentOrders from "@/components/dashboard/RecentOrders";
import InventoryAlerts from "@/components/dashboard/InventoryAlerts";
import OrderForm from "@/components/orders/OrderForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";

const Dashboard = () => {
  const { setCurrentPage } = useSidebar();
  const [showOrderForm, setShowOrderForm] = useState(false);

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
