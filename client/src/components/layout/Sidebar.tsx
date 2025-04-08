import { Link, useLocation } from "wouter";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from 'react-i18next';
import { FaTachometerAlt, FaShoppingCart, FaBox, FaWarehouse, 
  FaChartBar, FaChartLine, FaUsers, FaPhoneAlt, FaCalendarAlt, 
  FaCog, FaUserCog, FaSignOutAlt, FaChevronDown, 
  FaList, FaTruckLoading, FaClipboardCheck, FaClipboardList,
  FaBell, FaBoxes, FaAngleDoubleLeft, FaAngleDoubleRight } from 'react-icons/fa';

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
    if (path === "/orders" && 
        (location.startsWith("/orders/") || 
         location === "/order-picking" || 
         location === "/order-quality" || 
         location === "/unshipped-items")) return true;
         
    // Special case for sales - make parent active when children are active
    if (path === "/sales" && 
        (location === "/call-logs" || 
         location === "/calendar" ||
         location === "/customers")) return true;
    
    // Default behavior
    if (path !== "/" && location.startsWith(path)) return true;
    
    return false;
  };
  
  // Warehouse staff only see the orders menu (with order picking inside)
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
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                      title={t('dashboard.title')}
                    >
                      <span className="flex items-center w-5 h-5">
                        <FaTachometerAlt size={16} />
                      </span>
                      {isSidebarOpen && <span className="ml-2">{t('dashboard.title')}</span>}
                    </button>
                  </Link>
                </li>
                <li className="mb-1">
                  <div>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${(isActive("/orders") || isActive("/unshipped-items") || isActive("/order-picking") || isActive("/order-quality")) ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
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
                        <FaShoppingCart size={16} />
                      </span>
                      {isSidebarOpen && (
                        <div className="flex justify-between items-center flex-grow">
                          <span className="ml-2">{t('orders.title')}</span>
                          <FaChevronDown size={10} />
                        </div>
                      )}
                    </button>
                    
                    {isSidebarOpen && (
                      <div id="orders-submenu" className={`pl-7 mt-1 ${!isActive("/orders") && !isActive("/unshipped-items") && !isActive("/order-picking") && !isActive("/order-quality") ? 'hidden' : ''}`}>
                        <Link href="/orders" onClick={() => setCurrentPage("Orders")}>
                          <button 
                            className={`flex items-center w-full p-2 text-left rounded ${isActive("/orders") && !isActive("/orders/") ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors text-sm`}
                            title={t('orders.management')}
                          >
                            <FaList size={12} className="mr-2" />
                            <span>{t('orders.management')}</span>
                          </button>
                        </Link>
                        <Link href="/unshipped-items" onClick={() => setCurrentPage("Unshipped Items")}>
                          <button 
                            className={`flex items-center w-full p-2 text-left rounded ${isActive("/unshipped-items") ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors text-sm`}
                            title={t('unshippedItems.title')}
                          >
                            <FaTruckLoading size={12} className="mr-2" />
                            <span>{t('unshippedItems.title')}</span>
                          </button>
                        </Link>
                        <Link href="/order-picking" onClick={() => setCurrentPage("Order Picking")}>
                          <button 
                            className={`flex items-center w-full p-2 text-left rounded ${isActive("/order-picking") ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors text-sm`}
                            title={t('app.orderPicking')}
                          >
                            <FaClipboardCheck size={12} className="mr-2" />
                            <span>{t('app.orderPicking')}</span>
                          </button>
                        </Link>
                        <Link href="/order-quality" onClick={() => setCurrentPage(t('orderQuality.title'))}>
                          <button 
                            className={`flex items-center w-full p-2 text-left rounded ${isActive("/order-quality") ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors text-sm`}
                            title={t('orderQuality.title')}
                          >
                            <FaClipboardList size={12} className="mr-2" />
                            <span>{t('orderQuality.title')}</span>
                          </button>
                        </Link>
                      </div>
                    )}
                  </div>
                </li>
                <li className="mb-1">
                  <Link href="/products" onClick={() => setCurrentPage("Products")}>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/products") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                      title={t('products.title')}
                    >
                      <span className="flex items-center w-5 h-5">
                        <FaBox size={16} />
                      </span>
                      {isSidebarOpen && <span className="ml-2">{t('products.title')}</span>}
                    </button>
                  </Link>
                </li>

                <li className="mb-1">
                  <div>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${(isActive("/inventory") || isActive("/inventory-predictions")) ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                      title={t('app.inventory')}
                      onClick={() => {
                        if (isSidebarOpen) {
                          const submenu = document.getElementById('inventory-submenu');
                          if (submenu) {
                            submenu.classList.toggle('hidden');
                          }
                        } else {
                          // If sidebar is collapsed, just navigate to inventory
                          window.location.href = '/inventory';
                        }
                      }}
                    >
                      <span className="flex items-center w-5 h-5">
                        <FaWarehouse size={16} />
                      </span>
                      {isSidebarOpen && (
                        <div className="flex justify-between items-center flex-grow">
                          <span className="ml-2">{t('app.inventory')}</span>
                          <FaChevronDown size={10} />
                        </div>
                      )}
                    </button>
                    
                    {isSidebarOpen && (
                      <div id="inventory-submenu" className={`pl-7 mt-1 ${!isActive("/inventory") && !isActive("/inventory-predictions") ? 'hidden' : ''}`}>
                        <Link href="/inventory" onClick={() => setCurrentPage("Inventory")}>
                          <button 
                            className={`flex items-center w-full p-2 text-left rounded ${isActive("/inventory") && !isActive("/inventory-predictions") ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors text-sm`}
                            title={t('app.inventory')}
                          >
                            <FaBoxes size={12} className="mr-2" />
                            <span>{t('app.inventory')}</span>
                          </button>
                        </Link>
                        <Link href="/inventory-predictions" onClick={() => setCurrentPage(t('inventoryPredictions.title'))}>
                          <button 
                            className={`flex items-center w-full p-2 text-left rounded ${isActive("/inventory-predictions") ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors text-sm`}
                            title={t('inventoryPredictions.title')}
                          >
                            <FaChartLine size={12} className="mr-2" />
                            <span>{t('inventoryPredictions.title')}</span>
                          </button>
                        </Link>
                      </div>
                    )}
                  </div>
                </li>
                
                <li className="mb-1">
                  <Link href="/reports" onClick={() => setCurrentPage("Reports")}>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/reports") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                      title={t('app.reports')}
                    >
                      <span className="flex items-center w-5 h-5">
                        <FaChartBar size={16} />
                      </span>
                      {isSidebarOpen && <span className="ml-2">{t('app.reports')}</span>}
                    </button>
                  </Link>
                </li>
                
                <li className="mb-1">
                  <Link href="/production" onClick={() => setCurrentPage("Production")}>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${isActive("/production") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                      title={t('production.title') || "Production"}
                    >
                      <span className="flex items-center w-5 h-5">
                        <FaBoxes size={16} />
                      </span>
                      {isSidebarOpen && <span className="ml-2">{t('production.title') || "Production"}</span>}
                    </button>
                  </Link>
                </li>
                
                <li className="mb-1">
                  <div>
                    <button 
                      className={`flex items-center w-full p-2 text-left rounded ${(isActive("/call-logs") || isActive("/calendar") || isActive("/customers")) ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                      title={t('app.sales') || "Sales"}
                      onClick={() => {
                        if (isSidebarOpen) {
                          const submenu = document.getElementById('sales-submenu');
                          if (submenu) {
                            submenu.classList.toggle('hidden');
                          }
                        } else {
                          // If sidebar is collapsed, just navigate to customers
                          window.location.href = '/customers';
                        }
                      }}
                    >
                      <span className="flex items-center w-5 h-5">
                        <FaChartLine size={16} />
                      </span>
                      {isSidebarOpen && (
                        <div className="flex justify-between items-center flex-grow">
                          <span className="ml-2">{t('app.sales') || "Sales"}</span>
                          <FaChevronDown size={10} />
                        </div>
                      )}
                    </button>
                    
                    {isSidebarOpen && (
                      <div id="sales-submenu" className={`pl-7 mt-1 ${!isActive("/call-logs") && !isActive("/calendar") && !isActive("/customers") ? 'hidden' : ''}`}>
                        <Link href="/customers" onClick={() => setCurrentPage("Customers")}>
                          <button 
                            className={`flex items-center w-full p-2 text-left rounded ${isActive("/customers") ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors text-sm`}
                            title={t('app.customers')}
                          >
                            <FaUsers size={12} className="mr-2" />
                            <span>{t('app.customers')}</span>
                          </button>
                        </Link>
                        <Link href="/call-logs" onClick={() => setCurrentPage("Call Logs")}>
                          <button 
                            className={`flex items-center w-full p-2 text-left rounded ${isActive("/call-logs") ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors text-sm`}
                            title={t('app.callLogs') || "Call Logs"}
                          >
                            <FaPhoneAlt size={12} className="mr-2" />
                            <span>{t('app.callLogs') || "Call Logs"}</span>
                          </button>
                        </Link>
                        <Link href="/calendar" onClick={() => setCurrentPage("Calendar")}>
                          <button 
                            className={`flex items-center w-full p-2 text-left rounded ${isActive("/calendar") ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors text-sm`}
                            title={t('app.calendar') || "Calendar"}
                          >
                            <FaCalendarAlt size={12} className="mr-2" />
                            <span>{t('app.calendar') || "Calendar"}</span>
                          </button>
                        </Link>
                      </div>
                    )}
                  </div>
                </li>
              </>
            )}
            
            {/* Orders menu for warehouse staff */}
            {isWarehouseStaff && (
              <li className="mb-1">
                <div>
                  <button 
                    className={`flex items-center w-full p-2 text-left rounded ${(isActive("/orders") || isActive("/order-picking")) ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                    title={t('orders.title')}
                    onClick={() => {
                      if (isSidebarOpen) {
                        const submenu = document.getElementById('orders-staff-submenu');
                        if (submenu) {
                          submenu.classList.toggle('hidden');
                        }
                      } else {
                        // If sidebar is collapsed, just navigate to order picking
                        window.location.href = '/order-picking';
                      }
                    }}
                  >
                    <span className="flex items-center w-5 h-5">
                      <FaShoppingCart size={16} />
                    </span>
                    {isSidebarOpen && (
                      <div className="flex justify-between items-center flex-grow">
                        <span className="ml-2">{t('orders.title')}</span>
                        <FaChevronDown size={10} />
                      </div>
                    )}
                  </button>
                  
                  {isSidebarOpen && (
                    <div id="orders-staff-submenu" className={`pl-7 mt-1 ${!isActive("/order-picking") ? 'hidden' : ''}`}>
                      <Link href="/order-picking" onClick={() => setCurrentPage("Order Picking")}>
                        <button 
                          className={`flex items-center w-full p-2 text-left rounded ${isActive("/order-picking") ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors text-sm`}
                          title={t('app.orderPicking')}
                        >
                          <FaClipboardCheck size={12} className="mr-2" />
                          <span>{t('app.orderPicking')}</span>
                        </button>
                      </Link>
                    </div>
                  )}
                </div>
              </li>
            )}
            
            {/* Settings - visible only to admin users */}
            {isAdmin && (
              <li className="mb-1">
                <Link href="/settings" onClick={() => setCurrentPage("Settings")}>
                  <button 
                    className={`flex items-center w-full p-2 text-left rounded ${isActive("/settings") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
                    title={t('app.settings')}
                  >
                    <span className="flex items-center w-5 h-5">
                      <FaCog size={16} />
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
              {isSidebarOpen ? (
                <FaAngleDoubleLeft size={16} className="text-blue-400" />
              ) : (
                <FaAngleDoubleRight size={16} className="text-blue-400" />
              )}
            </span>
            {isSidebarOpen && <span className="ml-2">{t('app.collapseSidebar')}</span>}
          </button>
        </div>
      </aside>
    </div>
  );
};

export default Sidebar;