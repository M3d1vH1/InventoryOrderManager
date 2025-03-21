import { Link, useLocation } from "wouter";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from 'react-i18next';

const Sidebar = () => {
  const { isSidebarOpen, toggleSidebar, setCurrentPage } = useSidebar();
  const { user } = useAuth();
  const [location] = useLocation();
  const { t } = useTranslation();

  const isActive = (path: string): boolean => {
    // Special case for root path
    if (path === "/" && location === "/") return true;
    
    // Special case for unshipped items - consider both paths active
    if (path === "/unshipped-items" && location === "/orders/unshipped-items") return true;
    if (path === "/orders/unshipped-items" && location === "/unshipped-items") return true;
    
    // Special case for orders - make parent active when children are active
    if (path === "/orders" && location.startsWith("/orders/")) return true;
    
    // Default behavior
    if (path !== "/" && location.startsWith(path)) return true;
    
    return false;
  };
  
  // Warehouse staff only see order picking
  const isWarehouseStaff = user?.role === 'warehouse';
  
  // Admin can see everything, front office can't see user management
  const isAdmin = user?.role === 'admin';

  return (
    <div className="relative">
      <aside className={`${isSidebarOpen ? "w-64" : "w-16"} bg-slate-800 text-white h-screen flex-shrink-0 transition-all duration-300 md:block fixed md:relative z-40 inset-y-0 left-0 flex flex-col`}>
        <div className="p-4 border-b border-slate-700 flex items-center justify-center mb-1">
          {isSidebarOpen ? (
            <h1 className="text-xl font-semibold">{t('app.title')}</h1>
          ) : (
            <span className="text-xl font-semibold">WMS</span>
          )}
        </div>
        
        <nav className="p-2 flex-grow">
          <ul>
            {!isWarehouseStaff && (
              <>
                <li className="mb-1">
                  <Link href="/" onClick={() => setCurrentPage("Dashboard")}>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors ${!isSidebarOpen && "justify-center"}`}
                      title={t('dashboard.title')}
                    >
                      <i className="fas fa-tachometer-alt w-5 h-5 flex-shrink-0 text-center"></i>
                      {isSidebarOpen && <span className="ml-2">{t('dashboard.title')}</span>}
                    </button>
                  </Link>
                </li>
                <li className="mb-1">
                  <Link href="/orders" onClick={() => setCurrentPage("Orders")}>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/orders") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors ${!isSidebarOpen && "justify-center"}`}
                      title={t('orders.title')}
                    >
                      <i className="fas fa-shopping-cart w-5 h-5 flex-shrink-0 text-center"></i>
                      {isSidebarOpen && <span className="ml-2">{t('orders.title')}</span>}
                    </button>
                  </Link>
                </li>
                <li className="mb-1">
                  <Link href="/products" onClick={() => setCurrentPage("Products")}>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/products") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors ${!isSidebarOpen && "justify-center"}`}
                      title={t('products.title')}
                    >
                      <i className="fas fa-box w-5 h-5 flex-shrink-0 text-center"></i>
                      {isSidebarOpen && <span className="ml-2">{t('products.title')}</span>}
                    </button>
                  </Link>
                </li>
                <li className="mb-1">
                  <Link href="/customers" onClick={() => setCurrentPage("Customers")}>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/customers") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors ${!isSidebarOpen && "justify-center"}`}
                      title={t('app.customers')}
                    >
                      <i className="fas fa-users w-5 h-5 flex-shrink-0 text-center"></i>
                      {isSidebarOpen && <span className="ml-2">{t('app.customers')}</span>}
                    </button>
                  </Link>
                </li>
                <li className="mb-1">
                  <Link href="/inventory" onClick={() => setCurrentPage("Inventory")}>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/inventory") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors ${!isSidebarOpen && "justify-center"}`}
                      title={t('app.inventory')}
                    >
                      <i className="fas fa-warehouse w-5 h-5 flex-shrink-0 text-center"></i>
                      {isSidebarOpen && <span className="ml-2">{t('app.inventory')}</span>}
                    </button>
                  </Link>
                </li>
                <li className="mb-1">
                  <Link href="/reports" onClick={() => setCurrentPage("Reports")}>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/reports") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors ${!isSidebarOpen && "justify-center"}`}
                      title={t('app.reports')}
                    >
                      <i className="fas fa-chart-bar w-5 h-5 flex-shrink-0 text-center"></i>
                      {isSidebarOpen && <span className="ml-2">{t('app.reports')}</span>}
                    </button>
                  </Link>
                </li>
              </>
            )}
            
            {/* Order picking - visible to all users */}
            <li className="mb-1">
              <Link href="/order-picking" onClick={() => setCurrentPage("Order Picking")}>
                <button 
                  className={`flex items-center w-full p-2 text-left rounded ${isActive("/order-picking") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors ${!isSidebarOpen && "justify-center"}`}
                  title={t('app.orderPicking')}
                >
                  <i className="fas fa-clipboard-check w-5 h-5 flex-shrink-0 text-center"></i>
                  {isSidebarOpen && <span className="ml-2">{t('app.orderPicking')}</span>}
                </button>
              </Link>
            </li>
            
            {/* Settings - visible only to admin users */}
            {isAdmin && (
              <li className="mb-1">
                <Link href="/settings" onClick={() => setCurrentPage("Settings")}>
                  <button 
                    className={`flex items-center w-full p-2 text-left rounded ${isActive("/settings") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors ${!isSidebarOpen && "justify-center"}`}
                    title={t('app.settings')}
                  >
                    <i className="fas fa-cog w-5 h-5 flex-shrink-0 text-center"></i>
                    {isSidebarOpen && <span className="ml-2">{t('app.settings')}</span>}
                  </button>
                </Link>
              </li>
            )}
          </ul>
        </nav>
        
        {/* Toggle button at the bottom of the sidebar */}
        <div className="p-3 border-t border-slate-700 mt-auto">
          <button 
            onClick={toggleSidebar}
            className={`flex items-center w-full p-2 text-left rounded hover:bg-slate-700 transition-colors ${!isSidebarOpen ? "justify-center" : ""}`}
            title={isSidebarOpen ? t('app.collapseSidebar') : t('app.expandSidebar')}
          >
            <i className={`fas ${isSidebarOpen ? 'fa-angle-double-left' : 'fa-angle-double-right'} w-5 h-5 flex-shrink-0 text-center text-blue-400`}></i>
            {isSidebarOpen && <span className="ml-2">{t('app.collapseSidebar')}</span>}
          </button>
        </div>
      </aside>
    </div>
  );
};

export default Sidebar;
