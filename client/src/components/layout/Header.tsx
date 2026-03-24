import { useState } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { apiRequest } from "@/lib/queryClient";
import { Menu, Bell, PlusCircle, PhoneCall, MoreVertical, Barcode, Search, LogOut, Settings, User } from "lucide-react";
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
      <header className="h-16 flex items-center justify-between px-4 md:px-6 flex-shrink-0 relative z-50 bg-white/60 backdrop-blur-xl border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="text-slate-600 rounded-xl hover:bg-slate-100/80 h-9 w-9"
            title="Toggle sidebar"
          >
            <Menu size={18} />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 truncate max-w-[150px] sm:max-w-xs md:max-w-md tracking-tight">{currentPage}</h2>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Desktop action buttons */}
          <div className="hidden md:flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowOrderForm(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-md shadow-teal-500/20 rounded-xl h-9 px-4 font-medium text-sm transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/30"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{t('orders.new')}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCallLogForm(true)}
              className="flex items-center gap-2 rounded-xl h-9 px-4 border-slate-200/80 hover:bg-slate-50 font-medium text-sm"
            >
              <PhoneCall className="h-4 w-4 text-slate-500" />
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
                data-scanner-trigger
              />
            </div>
          </div>

          {/* Notification bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-xl h-9 w-9 hover:bg-slate-100/80">
                <Bell className="h-[18px] w-[18px] text-slate-500" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-bold rounded-full h-4.5 w-4.5 min-w-[18px] flex items-center justify-center shadow-md shadow-rose-500/30 pulse-dot">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-xl shadow-xl shadow-black/10 border-slate-200/80 p-0 overflow-hidden">
              <div className="p-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex justify-between items-center">
                <span className="font-semibold text-sm text-slate-900">Notifications</span>
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs text-teal-600 hover:text-teal-700 h-7 px-2 rounded-lg"
                  >
                    Mark all as read
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[300px]">
                {notifications.length === 0 ? (
                  <div className="py-8 px-4 text-center text-sm text-slate-400">
                    <Bell className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    No notifications
                  </div>
                ) : (
                  notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`p-3 border-b border-slate-50 ${notification.read ? 'bg-white' : 'bg-teal-50/40'} hover:bg-slate-50 cursor-pointer transition-colors`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h5 className="font-medium text-sm text-slate-900">{notification.title}</h5>
                        <span className="text-[10px] text-slate-400 ml-2 whitespace-nowrap">{format(new Date(notification.timestamp), 'HH:mm')}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">{notification.message}</p>
                      {notification.orderNumber && (
                        <div className="text-xs text-teal-600 font-medium">Order: {notification.orderNumber}</div>
                      )}
                    </div>
                  ))
                )}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded-xl hover:bg-slate-100/80 transition-colors">
                <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-md shadow-teal-500/20">
                  {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="hidden md:inline text-sm font-medium text-slate-700">{user?.fullName || "User"}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl shadow-black/10 border-slate-200/80">
              <DropdownMenuLabel className="pb-0">
                <div className="font-semibold text-slate-900">{user?.fullName}</div>
                <div className="text-xs text-slate-400 font-normal mt-0.5">
                  {user?.role === 'admin' && 'Administrator'}
                  {user?.role === 'front_office' && 'Front Office'}
                  {user?.role === 'warehouse' && 'Warehouse Staff'}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer rounded-lg mx-1 gap-2" onClick={() => window.location.href = "/settings"}>
                <Settings size={14} className="text-slate-400" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-rose-500 hover:text-rose-600 rounded-lg mx-1 gap-2" onClick={handleLogout}>
                <LogOut size={14} />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="flex md:hidden rounded-xl h-9 w-9">
                <MoreVertical className="h-[18px] w-[18px] text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl shadow-xl">
              <DropdownMenuItem onClick={() => setShowOrderForm(true)} className="gap-2">
                <PlusCircle className="h-4 w-4 text-teal-500" />
                <span>{t('orders.createNew')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowCallLogForm(true)} className="gap-2">
                <PhoneCall className="h-4 w-4 text-slate-500" />
                <span>{t('callLogs.addNewCall')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const scanner = document.querySelector('[data-scanner-trigger]') as HTMLButtonElement;
                if (scanner) scanner.click();
              }} className="gap-2">
                <Barcode className="h-4 w-4 text-slate-500" />
                <span>{t('scanner.scanBarcode')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {showOrderForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200/60">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">{t('orders.createNew')}</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOrderForm(false)}
                className="rounded-xl"
              >
                {t('app.close')}
              </Button>
            </div>
            <div className="p-5">
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
