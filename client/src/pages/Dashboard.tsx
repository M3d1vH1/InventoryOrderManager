import { useEffect, useState } from "react";
import { useSidebar } from "@/context/SidebarContext";
import QuickStats from "@/components/dashboard/QuickStats";
import RecentOrders from "@/components/dashboard/RecentOrders";
import InventoryAlerts from "@/components/dashboard/InventoryAlerts";
import SlowMovingItems from "@/components/dashboard/SlowMovingItems";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import axios from "axios";

const Dashboard = () => {
  const { setCurrentPage } = useSidebar();
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    setCurrentPage("Dashboard");
  }, [setCurrentPage]);

  const testPrinter = async () => {
    try {
      setIsPrinting(true);
      const response = await axios.get('/api/printer/test');
      if (response.data.success) {
        toast({
          title: "Δοκιμή εκτυπωτή",
          description: "Η εντολή εκτύπωσης στάλθηκε στον εκτυπωτή CAB EOS 1 επιτυχώς!",
          variant: "default"
        });
      } else {
        toast({
          title: "Σφάλμα εκτυπωτή",
          description: response.data.message || "Προέκυψε σφάλμα κατά την εκτύπωση",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Printer test error:", error);
      toast({
        title: "Σφάλμα εκτυπωτή",
        description: "Δεν ήταν δυνατή η επικοινωνία με τον εκτυπωτή. Ελέγξτε τη σύνδεση και τις ρυθμίσεις.",
        variant: "destructive"
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div>
      <QuickStats />
      
      <div className="flex justify-end mb-4">
        <Button 
          onClick={testPrinter}
          disabled={isPrinting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isPrinting ? "Εκτύπωση..." : "Δοκιμή Εκτυπωτή CAB EOS 1"}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <RecentOrders />
        <InventoryAlerts />
      </div>
      
      <div className="mb-6">
        <SlowMovingItems />
      </div>
    </div>
  );
};

export default Dashboard;
