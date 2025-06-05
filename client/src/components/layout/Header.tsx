import { useState } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { apiRequest } from "@/lib/queryClient";
import { Menu, Bell, PlusCircle, PhoneCall, MoreVertical, Barcode, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import OrderForm from "@/components/orders/OrderForm";
import CallLogForm from "@/components/call-logs/CallLogForm";
import EnhancedBarcodeScanner, { ScanMode } from "@/components/barcode/EnhancedBarcodeScanner";
import ProductLookup from "@/components/products/ProductLookup";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const Header = () => {
  const { toggleSidebar, currentPage } = useSidebar();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showCallLogForm, setShowCallLogForm] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>('lookup');
  const [showProductLookup, setShowProductLookup] = useState(false);
  const { t } = useTranslation();

  const handleLogout = async () => {
    try {
      await apiRequest('/api/logout', { method: 'POST' });
      logout();
    } catch (error) {
      toast({
        title: "Logout Failed",
        description: "Could not log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 flex-shrink-0 relative z-50">
        <div className="flex items-center">
          <Button 
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="text-slate-800 rounded-md hover:bg-slate-100"
            title="Toggle sidebar"
          >
            <Menu />
          </Button>
          <h2 className="text-xl font-semibold ml-2 truncate max-w-[150px] sm:max-w-xs md:max-w-md">{currentPage}</h2>
        </div>
        
        {/* Responsive actions section */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Buttons for larger screens with responsive text */}
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowOrderForm(true)}
              className="flex items-center gap-1 bg-green-600 hover:bg-green-700 whitespace-nowrap"
            >
              <PlusCircle className="h-4 w-4 flex-shrink-0" />
              <span>{t('orders.new')}</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCallLogForm(true)}
              className="flex items-center gap-1 whitespace-nowrap"
            >
              <PhoneCall className="h-4 w-4 flex-shrink-0" />
              <span>{t('callLogs.new')}</span>
            </Button>

            <div className="ml-1">
              <EnhancedBarcodeScanner 
                buttonVariant="secondary"
                buttonSize="sm"
                showInHeader={true}
                buttonText={t('scanner.scanBarcode')}
                modalTitle={t('scanner.scanProduct')}
                onBarcodeScanned={(barcode, mode) => {
                  setScannedBarcode(barcode);
                  setScanMode(mode);
                  setShowProductLookup(true);
                }}
                // Add data attribute for mobile menu to target
                data-scanner-trigger
              />
            </div>
          </div>
          
          {/* Language toggle button removed - now in settings */}

          {/* Notifications dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex justify-between items-center">
                <span>Notifications</span>
                {notifications.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={markAllAsRead}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    Mark all as read
                  </Button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="h-[300px]">
                {notifications.length === 0 ? (
                  <div className="py-4 px-2 text-center text-sm text-gray-500">
                    No notifications
                  </div>
                ) : (
                  notifications.map(notification => (
                    <div 
                      key={notification.id} 
                      className={`p-3 border-b border-gray-100 ${notification.read ? 'bg-white' : 'bg-blue-50'} hover:bg-gray-50 cursor-pointer`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h5 className="font-medium text-sm">{notification.title}</h5>
                        <span className="text-[10px] text-gray-500">{format(new Date(notification.timestamp), 'HH:mm')}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{notification.message}</p>
                      {notification.orderNumber && (
                        <div className="text-xs text-blue-500">Order: {notification.orderNumber}</div>
                      )}
                    </div>
                  ))
                )}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* User profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer p-1 rounded-md hover:bg-slate-100">
                <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center text-slate-600">
                  <i className="fas fa-user"></i>
                </div>
                <span className="hidden md:inline text-sm">{user?.fullName || "User"}</span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {user?.fullName}
                <div className="text-xs text-muted-foreground">
                  {user?.role === 'admin' && 'Administrator'}
                  {user?.role === 'front_office' && 'Front Office'}
                  {user?.role === 'warehouse' && 'Warehouse Staff'}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = "/settings"}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-red-500" onClick={handleLogout}>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Mobile actions dropdown (only for small screens) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="flex md:hidden">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowOrderForm(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                <span>{t('orders.createNew')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowCallLogForm(true)}>
                <PhoneCall className="h-4 w-4 mr-2" />
                <span>{t('callLogs.addNewCall')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const scanner = document.querySelector('[data-scanner-trigger]') as HTMLButtonElement;
                if (scanner) scanner.click();
              }}>
                <Barcode className="h-4 w-4 mr-2" />
                <span>{t('scanner.scanBarcode')}</span>
              </DropdownMenuItem>
              {/* Language toggle removed - now in settings */}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {showOrderForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">{t('orders.createNew')}</h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowOrderForm(false)}
              >
                {t('app.close')}
              </Button>
            </div>
            <div className="p-4">
              <OrderForm 
                onSuccess={() => setShowOrderForm(false)}
                onCancel={() => setShowOrderForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      <CallLogForm
        open={showCallLogForm}
        onOpenChange={setShowCallLogForm}
        mode="create"
      />
      
      {/* Product Lookup Component */}
      <ProductLookup
        isOpen={showProductLookup}
        onClose={() => setShowProductLookup(false)}
        barcode={scannedBarcode}
        scanMode={scanMode}
      />
    </>
  );
};

export default Header;
