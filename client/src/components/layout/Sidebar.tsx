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
                      <span className="flex justify-center items-center w-5 h-5">
                        <i className="fas fa-tachometer-alt"></i>
                      </span>
                      {isSidebarOpen && <span className="ml-2">{t('dashboard.title')}</span>}
                    </button>
                  </Link>
                </li>
                <li className="mb-1">
                  <div>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${(isActive("/orders") || isActive("/unshipped-items")) ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors ${!isSidebarOpen && "justify-center"}`}
                      title={t('orders.title')}
                      onClick={() => {
                        if (isSidebarOpen) {
                          const submenu = document.getElementById('orders-submenu');
                          if (submenu) {
                            submenu.classList.toggle('hidden');
                          }
                        } else {
                          // If sidebar is collapsed, just navigate to orders
                          window.location.href = '/orders';
                        }
                      }}
                    >
                      <span className="flex justify-center items-center w-5 h-5">
                        <i className="fas fa-shopping-cart"></i>
                      </span>
                      {isSidebarOpen && (
                        <div className="flex justify-between items-center flex-grow">
                          <span className="ml-2">{t('orders.title')}</span>
                          <i className="fas fa-chevron-down text-xs"></i>
                        </div>
                      )}
                    </button>
                    
                    {isSidebarOpen && (
                      <div id="orders-submenu" className={`pl-7 mt-1 ${!isActive("/orders") && !isActive("/unshipped-items") ? 'hidden' : ''}`}>
                        <Link href="/orders" onClick={() => setCurrentPage("Orders")}>
                          <button 
                            className={`flex items-center w-full p-2 text-left rounded ${isActive("/orders") && !isActive("/orders/") ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors text-sm`}
                            title={t('orders.management')}
                          >
                            <i className="fas fa-list mr-2 text-xs"></i>
                            <span>{t('orders.management')}</span>
                          </button>
                        </Link>
                        <Link href="/unshipped-items" onClick={() => setCurrentPage("Unshipped Items")}>
                          <button 
                            className={`flex items-center w-full p-2 text-left rounded ${isActive("/unshipped-items") ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors text-sm`}
                            title={t('unshippedItems.title')}
                          >
                            <i className="fas fa-truck-loading mr-2 text-xs"></i>
                            <span>{t('unshippedItems.title')}</span>
                          </button>
                        </Link>
                      </div>
                    )}
                  </div>
                </li>
                <li className="mb-1">
                  <Link href="/products" onClick={() => setCurrentPage("Products")}>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/products") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors ${!isSidebarOpen && "justify-center"}`}
                      title={t('products.title')}
                    >
                      <span className="flex justify-center items-center w-5 h-5">
                        <i className="fas fa-box"></i>
                      </span>
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
                      <span className="flex justify-center items-center w-5 h-5">
                        <i className="fas fa-users"></i>
                      </span>
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
                      <span className="flex justify-center items-center w-5 h-5">
                        <i className="fas fa-warehouse"></i>
                      </span>
                      {isSidebarOpen && <span className="ml-2">{t('app.inventory')}</span>}
                    </button>
                  </Link>
                </li>
                
                <li className="mb-1">
                  <Link href="/order-quality" onClick={() => setCurrentPage(t('orderQuality.title'))}>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/order-quality") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors ${!isSidebarOpen && "justify-center"}`}
                      title={t('orderQuality.title')}
                    >
                      <span className="flex justify-center items-center w-5 h-5">
                        <i className="fas fa-clipboard-list"></i>
                      </span>
                      {isSidebarOpen && <span className="ml-2">{t('orderQuality.title')}</span>}
                    </button>
                  </Link>
                </li>

                <li className="mb-1">
                  <Link href="/reports" onClick={() => setCurrentPage("Reports")}>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/reports") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors ${!isSidebarOpen && "justify-center"}`}
                      title={t('app.reports')}
                    >
                      <span className="flex justify-center items-center w-5 h-5">
                        <i className="fas fa-chart-bar"></i>
                      </span>
                      {isSidebarOpen && <span className="ml-2">{t('app.reports')}</span>}
                    </button>
                  </Link>
                </li>
                
                <li className="mb-1">
                  <Link href="/call-logs" onClick={() => setCurrentPage("Call Logs")}>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/call-logs") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors ${!isSidebarOpen && "justify-center"}`}
                      title={t('app.callLogs') || "Call Logs"}
                    >
                      <span className="flex justify-center items-center w-5 h-5">
                        <i className="fas fa-phone-alt"></i>
                      </span>
                      {isSidebarOpen && <span className="ml-2">{t('app.callLogs') || "Call Logs"}</span>}
                    </button>
                  </Link>
                </li>
                
                <li className="mb-1">
                  <Link href="/calendar" onClick={() => setCurrentPage("Calendar")}>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/calendar") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors ${!isSidebarOpen && "justify-center"}`}
                      title={t('app.calendar') || "Calendar"}
                    >
                      <span className="flex justify-center items-center w-5 h-5">
                        <i className="fas fa-calendar-alt"></i>
                      </span>
                      {isSidebarOpen && <span className="ml-2">{t('app.calendar') || "Calendar"}</span>}
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
                  <span className="flex justify-center items-center w-5 h-5">
                    <i className="fas fa-clipboard-check"></i>
                  </span>
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
                    <span className="flex justify-center items-center w-5 h-5">
                      <i className="fas fa-cog"></i>
                    </span>
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
            <span className="flex justify-center items-center w-5 h-5">
              <i className={`fas ${isSidebarOpen ? 'fa-angle-double-left' : 'fa-angle-double-right'} text-blue-400`}></i>
            </span>
            {isSidebarOpen && <span className="ml-2">{t('app.collapseSidebar')}</span>}
          </button>
        </div>
      </aside>
    </div>
  );
};

export default Sidebar;