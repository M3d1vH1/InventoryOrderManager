import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse,
  BarChart3, TrendingUp, Users, Phone, CalendarDays,
  Settings, ChevronDown, List, Truck, ClipboardCheck, ClipboardList,
  Boxes, ChevronsLeft, ChevronsRight, DollarSign, Factory
} from 'lucide-react';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isSidebarOpen: boolean;
  onClick: () => void;
}

const NavItem = ({ href, icon, label, isActive, isSidebarOpen, onClick }: NavItemProps) => (
  <li>
    <Link href={href} onClick={onClick}>
      <button
        className={`
          flex items-center w-full px-3 py-2.5 text-left rounded-xl text-sm font-medium
          transition-all duration-200 ease-out group relative
          ${isActive
            ? "bg-gradient-to-r from-teal-500/15 to-emerald-500/10 text-teal-400 shadow-sm shadow-teal-500/5"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]"
          }
        `}
        title={label}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-teal-400 rounded-r-full" />
        )}
        <span className={`flex items-center justify-center w-5 h-5 transition-colors ${isActive ? "text-teal-400" : "text-slate-500 group-hover:text-slate-300"}`}>
          {icon}
        </span>
        {isSidebarOpen && <span className="ml-3 truncate">{label}</span>}
      </button>
    </Link>
  </li>
);

interface SubMenuProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isSidebarOpen: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const SubMenu = ({ icon, label, isActive, isSidebarOpen, children, defaultOpen = false }: SubMenuProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen || isActive);

  return (
    <li>
      <button
        className={`
          flex items-center w-full px-3 py-2.5 text-left rounded-xl text-sm font-medium
          transition-all duration-200 ease-out group
          ${isActive
            ? "text-teal-400"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]"
          }
        `}
        title={label}
        onClick={() => {
          if (isSidebarOpen) {
            setIsOpen(!isOpen);
          }
        }}
      >
        <span className={`flex items-center justify-center w-5 h-5 transition-colors ${isActive ? "text-teal-400" : "text-slate-500 group-hover:text-slate-300"}`}>
          {icon}
        </span>
        {isSidebarOpen && (
          <div className="flex justify-between items-center flex-grow ml-3">
            <span className="truncate">{label}</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""} text-slate-500`}
            />
          </div>
        )}
      </button>

      {isSidebarOpen && isOpen && (
        <ul className="mt-1 ml-4 pl-4 border-l border-slate-700/50 space-y-0.5">
          {children}
        </ul>
      )}
    </li>
  );
};

interface SubNavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const SubNavItem = ({ href, icon, label, isActive, onClick }: SubNavItemProps) => (
  <li>
    <Link href={href} onClick={onClick}>
      <button
        className={`
          flex items-center w-full px-3 py-2 text-left rounded-lg text-xs font-medium
          transition-all duration-200
          ${isActive
            ? "bg-teal-500/10 text-teal-400"
            : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]"
          }
        `}
        title={label}
      >
        <span className="flex items-center justify-center w-4 h-4 mr-2.5">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </button>
    </Link>
  </li>
);

const Sidebar = () => {
  const { isSidebarOpen, toggleSidebar, setCurrentPage } = useSidebar();
  const { user } = useAuth();
  const [location] = useLocation();
  const { t } = useTranslation();

  const isActive = (path: string): boolean => {
    if (path === "/" && location === "/") return true;
    if (path === "/unshipped-items" && location === "/orders/unshipped-items") return true;
    if (path === "/orders/unshipped-items" && location === "/unshipped-items") return true;
    if (path === "/orders" &&
        (location.startsWith("/orders/") ||
         location === "/order-picking" ||
         location === "/order-quality" ||
         location === "/unshipped-items")) return true;
    if (path === "/sales" &&
        (location === "/call-logs" ||
         location === "/customers")) return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  const isWarehouseStaff = user?.role === 'warehouse';
  const isAdmin = user?.role === 'admin';

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
          onClick={toggleSidebar}
        />
      )}

      <div className="relative">
        <aside className={`
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${isSidebarOpen ? "w-64" : "w-64 md:w-[68px]"}
          h-screen flex-shrink-0 transition-all duration-300 ease-out
          fixed md:relative z-40 inset-y-0 left-0 flex flex-col
          md:m-3 md:rounded-2xl md:h-[calc(100vh-24px)]
          bg-[hsl(220,25%,11%)] md:shadow-xl md:shadow-black/20
          border-r md:border border-slate-800/50
        `}>
          {/* Logo area */}
          <div className="p-4 flex items-center justify-center">
            {isSidebarOpen ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                  <Boxes size={16} className="text-white" />
                </div>
                <h1 className="text-base font-bold text-white tracking-tight">{t('app.title')}</h1>
              </div>
            ) : (
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Boxes size={18} className="text-white" />
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-slate-700/50" />

          {/* Navigation */}
          <nav className="flex-grow overflow-y-auto scrollbar-thin px-3 py-3">
            <ul className="space-y-1">
              {/* Dashboard */}
              <NavItem
                href="/"
                icon={<LayoutDashboard size={18} />}
                label={t('dashboard.title')}
                isActive={isActive("/")}
                isSidebarOpen={isSidebarOpen}
                onClick={() => setCurrentPage("Dashboard")}
              />

              {!isWarehouseStaff && (
                <>
                  {/* Calendar */}
                  <NavItem
                    href="/calendar"
                    icon={<CalendarDays size={18} />}
                    label={t('app.calendar') || "Calendar"}
                    isActive={isActive("/calendar")}
                    isSidebarOpen={isSidebarOpen}
                    onClick={() => setCurrentPage("Calendar")}
                  />

                  {/* Orders submenu */}
                  <SubMenu
                    icon={<ShoppingCart size={18} />}
                    label={t('orders.title')}
                    isActive={isActive("/orders") || isActive("/unshipped-items") || isActive("/order-picking") || isActive("/order-quality")}
                    isSidebarOpen={isSidebarOpen}
                  >
                    <SubNavItem
                      href="/orders"
                      icon={<List size={14} />}
                      label={t('orders.management')}
                      isActive={isActive("/orders") && !isActive("/orders/")}
                      onClick={() => setCurrentPage("Orders")}
                    />
                    <SubNavItem
                      href="/unshipped-items"
                      icon={<Truck size={14} />}
                      label={t('unshippedItems.title')}
                      isActive={isActive("/unshipped-items")}
                      onClick={() => setCurrentPage("Unshipped Items")}
                    />
                    <SubNavItem
                      href="/order-picking"
                      icon={<ClipboardCheck size={14} />}
                      label={t('app.orderPicking')}
                      isActive={isActive("/order-picking")}
                      onClick={() => setCurrentPage("Order Picking")}
                    />
                    <SubNavItem
                      href="/order-quality"
                      icon={<ClipboardList size={14} />}
                      label={t('orderQuality.title')}
                      isActive={isActive("/order-quality")}
                      onClick={() => setCurrentPage(t('orderQuality.title'))}
                    />
                  </SubMenu>

                  {/* Products */}
                  <NavItem
                    href="/products"
                    icon={<Package size={18} />}
                    label={t('products.title')}
                    isActive={isActive("/products")}
                    isSidebarOpen={isSidebarOpen}
                    onClick={() => setCurrentPage("Products")}
                  />

                  {/* Inventory submenu */}
                  <SubMenu
                    icon={<Warehouse size={18} />}
                    label={t('app.inventory')}
                    isActive={isActive("/inventory") || isActive("/inventory-predictions")}
                    isSidebarOpen={isSidebarOpen}
                  >
                    <SubNavItem
                      href="/inventory"
                      icon={<Boxes size={14} />}
                      label={t('app.inventory')}
                      isActive={isActive("/inventory") && !isActive("/inventory-predictions")}
                      onClick={() => setCurrentPage("Inventory")}
                    />
                    <SubNavItem
                      href="/inventory-predictions"
                      icon={<TrendingUp size={14} />}
                      label={t('inventoryPredictions.title')}
                      isActive={isActive("/inventory-predictions")}
                      onClick={() => setCurrentPage(t('inventoryPredictions.title'))}
                    />
                  </SubMenu>

                  {/* Reports */}
                  <NavItem
                    href="/reports"
                    icon={<BarChart3 size={18} />}
                    label={t('app.reports')}
                    isActive={isActive("/reports")}
                    isSidebarOpen={isSidebarOpen}
                    onClick={() => setCurrentPage("Reports")}
                  />

                  {/* Production */}
                  <NavItem
                    href="/production"
                    icon={<Factory size={18} />}
                    label={t('production.title') || "Production"}
                    isActive={isActive("/production")}
                    isSidebarOpen={isSidebarOpen}
                    onClick={() => setCurrentPage("Production")}
                  />

                  {/* Supplier Payments */}
                  <NavItem
                    href="/supplier-payments"
                    icon={<DollarSign size={18} />}
                    label={t('supplierPayments.title') || "Payments"}
                    isActive={isActive("/supplier-payments")}
                    isSidebarOpen={isSidebarOpen}
                    onClick={() => setCurrentPage("Payments")}
                  />

                  {/* Sales submenu */}
                  <SubMenu
                    icon={<TrendingUp size={18} />}
                    label={t('app.sales') || "Sales"}
                    isActive={isActive("/call-logs") || isActive("/customers")}
                    isSidebarOpen={isSidebarOpen}
                  >
                    <SubNavItem
                      href="/customers"
                      icon={<Users size={14} />}
                      label={t('app.customers')}
                      isActive={isActive("/customers")}
                      onClick={() => setCurrentPage("Customers")}
                    />
                    <SubNavItem
                      href="/call-logs"
                      icon={<Phone size={14} />}
                      label={t('app.callLogs') || "Call Logs"}
                      isActive={isActive("/call-logs")}
                      onClick={() => setCurrentPage("Call Logs")}
                    />
                  </SubMenu>
                </>
              )}

              {/* Warehouse staff navigation */}
              {isWarehouseStaff && (
                <>
                  <SubMenu
                    icon={<ShoppingCart size={18} />}
                    label={t('orders.title')}
                    isActive={isActive("/orders") || isActive("/unshipped-items") || isActive("/order-picking")}
                    isSidebarOpen={isSidebarOpen}
                    defaultOpen
                  >
                    <SubNavItem
                      href="/orders"
                      icon={<List size={14} />}
                      label={t('orders.management')}
                      isActive={isActive("/orders") && !isActive("/orders/")}
                      onClick={() => setCurrentPage("Orders")}
                    />
                    <SubNavItem
                      href="/unshipped-items"
                      icon={<Truck size={14} />}
                      label={t('unshippedItems.title')}
                      isActive={isActive("/unshipped-items")}
                      onClick={() => setCurrentPage("Unshipped Items")}
                    />
                    <SubNavItem
                      href="/order-picking"
                      icon={<ClipboardCheck size={14} />}
                      label={t('app.orderPicking')}
                      isActive={isActive("/order-picking")}
                      onClick={() => setCurrentPage("Order Picking")}
                    />
                  </SubMenu>

                  <NavItem
                    href="/products"
                    icon={<Package size={18} />}
                    label={t('products.title')}
                    isActive={isActive("/products")}
                    isSidebarOpen={isSidebarOpen}
                    onClick={() => setCurrentPage("Products")}
                  />

                  <SubMenu
                    icon={<Warehouse size={18} />}
                    label={t('app.inventory')}
                    isActive={isActive("/inventory") || isActive("/inventory-predictions")}
                    isSidebarOpen={isSidebarOpen}
                  >
                    <SubNavItem
                      href="/inventory"
                      icon={<Boxes size={14} />}
                      label={t('app.inventory')}
                      isActive={isActive("/inventory") && !isActive("/inventory-predictions")}
                      onClick={() => setCurrentPage("Inventory")}
                    />
                    <SubNavItem
                      href="/inventory-predictions"
                      icon={<TrendingUp size={14} />}
                      label={t('inventoryPredictions.title')}
                      isActive={isActive("/inventory-predictions")}
                      onClick={() => setCurrentPage(t('inventoryPredictions.title'))}
                    />
                  </SubMenu>

                  <NavItem
                    href="/production"
                    icon={<Factory size={18} />}
                    label={t('production.title') || "Production"}
                    isActive={isActive("/production")}
                    isSidebarOpen={isSidebarOpen}
                    onClick={() => setCurrentPage("Production")}
                  />
                </>
              )}

              {/* Settings - admin only */}
              {isAdmin && (
                <>
                  <li className="pt-2 mt-2 border-t border-slate-700/50">
                    <Link href="/settings" onClick={() => setCurrentPage("Settings")}>
                      <button
                        className={`
                          flex items-center w-full px-3 py-2.5 text-left rounded-xl text-sm font-medium
                          transition-all duration-200 ease-out group relative
                          ${isActive("/settings")
                            ? "bg-gradient-to-r from-teal-500/15 to-emerald-500/10 text-teal-400 shadow-sm shadow-teal-500/5"
                            : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]"
                          }
                        `}
                        title={t('app.settings')}
                      >
                        {isActive("/settings") && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-teal-400 rounded-r-full" />
                        )}
                        <span className={`flex items-center justify-center w-5 h-5 transition-colors ${isActive("/settings") ? "text-teal-400" : "text-slate-500 group-hover:text-slate-300"}`}>
                          <Settings size={18} />
                        </span>
                        {isSidebarOpen && <span className="ml-3">{t('app.settings')}</span>}
                      </button>
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>

          {/* Toggle button at bottom */}
          <div className="p-3 border-t border-slate-700/50">
            <button
              onClick={toggleSidebar}
              className={`
                flex items-center w-full px-3 py-2.5 text-left rounded-xl text-sm
                text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]
                transition-all duration-200
                ${!isSidebarOpen ? "justify-center" : ""}
              `}
              title={isSidebarOpen ? t('app.collapseSidebar') : t('app.expandSidebar')}
            >
              <span className="flex justify-center items-center w-5 h-5">
                {isSidebarOpen ? (
                  <ChevronsLeft size={16} className="text-teal-400/60" />
                ) : (
                  <ChevronsRight size={16} className="text-teal-400/60" />
                )}
              </span>
              {isSidebarOpen && <span className="ml-3 text-slate-500">{t('app.collapseSidebar')}</span>}
            </button>
          </div>
        </aside>
      </div>
    </>
  );
};

export default Sidebar;
