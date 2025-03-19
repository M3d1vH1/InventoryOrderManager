import { Link, useLocation } from "wouter";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from 'react-i18next';

const Sidebar = () => {
  const { isSidebarOpen, setCurrentPage } = useSidebar();
  const { user } = useAuth();
  const [location] = useLocation();
  const { t } = useTranslation();

  const isActive = (path: string): boolean => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };
  
  // Don't render if sidebar is closed on mobile
  if (!isSidebarOpen) {
    return null;
  }
  
  // Warehouse staff only see order picking
  const isWarehouseStaff = user?.role === 'warehouse';
  
  // Admin can see everything, front office can't see user management
  const isAdmin = user?.role === 'admin';

  return (
    <aside className={`w-64 bg-slate-800 text-white h-screen flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? "md:block" : "hidden"} ${!isSidebarOpen ? "hidden" : "fixed md:relative z-40 inset-y-0 left-0"}`}>
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-semibold">{t('app.title')}</h1>
      </div>
      <nav className="p-2">
        <ul>
          {!isWarehouseStaff && (
            <>
              <li className="mb-1">
                <Link href="/" onClick={() => setCurrentPage("Dashboard")}>
                  <button 
                    className={`flex items-center w-full p-2 text-left rounded ${isActive("/") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                  >
                    <i className="fas fa-tachometer-alt w-5"></i>
                    <span className="ml-2">{t('dashboard.title')}</span>
                  </button>
                </Link>
              </li>
              <li className="mb-1">
                <Link href="/orders" onClick={() => setCurrentPage("Orders")}>
                  <button 
                    className={`flex items-center w-full p-2 text-left rounded ${isActive("/orders") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                  >
                    <i className="fas fa-shopping-cart w-5"></i>
                    <span className="ml-2">{t('orders.title')}</span>
                  </button>
                </Link>
              </li>
              <li className="mb-1">
                <Link href="/products" onClick={() => setCurrentPage("Products")}>
                  <button 
                    className={`flex items-center w-full p-2 text-left rounded ${isActive("/products") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                  >
                    <i className="fas fa-box w-5"></i>
                    <span className="ml-2">{t('products.title')}</span>
                  </button>
                </Link>
              </li>
              <li className="mb-1">
                <Link href="/customers" onClick={() => setCurrentPage("Customers")}>
                  <button 
                    className={`flex items-center w-full p-2 text-left rounded ${isActive("/customers") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                  >
                    <i className="fas fa-users w-5"></i>
                    <span className="ml-2">{t('app.customers')}</span>
                  </button>
                </Link>
              </li>
              <li className="mb-1">
                <Link href="/inventory" onClick={() => setCurrentPage("Inventory")}>
                  <button 
                    className={`flex items-center w-full p-2 text-left rounded ${isActive("/inventory") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                  >
                    <i className="fas fa-warehouse w-5"></i>
                    <span className="ml-2">{t('app.inventory')}</span>
                  </button>
                </Link>
              </li>
              <li className="mb-1">
                <Link href="/reports" onClick={() => setCurrentPage("Reports")}>
                  <button 
                    className={`flex items-center w-full p-2 text-left rounded ${isActive("/reports") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                  >
                    <i className="fas fa-chart-bar w-5"></i>
                    <span className="ml-2">{t('app.reports')}</span>
                  </button>
                </Link>
              </li>
            </>
          )}
          
          {/* Order picking - visible to all users */}
          <li className="mb-1">
            <Link href="/order-picking" onClick={() => setCurrentPage("Order Picking")}>
              <button 
                className={`flex items-center w-full p-2 text-left rounded ${isActive("/order-picking") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
              >
                <i className="fas fa-clipboard-check w-5"></i>
                <span className="ml-2">{t('app.orderPicking')}</span>
              </button>
            </Link>
          </li>
          
          {/* Settings - visible only to admin users */}
          {isAdmin && (
            <li className="mb-1">
              <Link href="/settings" onClick={() => setCurrentPage("Settings")}>
                <button 
                  className={`flex items-center w-full p-2 text-left rounded ${isActive("/settings") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                >
                  <i className="fas fa-cog w-5"></i>
                  <span className="ml-2">{t('app.settings')}</span>
                </button>
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
