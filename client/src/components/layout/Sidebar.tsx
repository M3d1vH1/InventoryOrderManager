import { Link, useLocation } from "wouter";
import { useSidebar } from "@/context/SidebarContext";

const Sidebar = () => {
  const { isSidebarOpen, setCurrentPage } = useSidebar();
  const [location] = useLocation();

  const isActive = (path: string): boolean => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };
  
  // Don't render if sidebar is closed on mobile
  if (!isSidebarOpen) {
    return null;
  }

  return (
    <aside className={`w-64 bg-slate-800 text-white h-screen flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? "md:block" : "hidden"} ${!isSidebarOpen ? "hidden" : "fixed md:relative z-40 inset-y-0 left-0"}`}>
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-semibold">Inventory System</h1>
      </div>
      <nav className="p-2">
        <ul>
          <li className="mb-1">
            <Link href="/" onClick={() => setCurrentPage("Dashboard")}>
              <button 
                className={`flex items-center w-full p-2 text-left rounded ${isActive("/") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
              >
                <i className="fas fa-tachometer-alt w-5"></i>
                <span className="ml-2">Dashboard</span>
              </button>
            </Link>
          </li>
          <li className="mb-1">
            <Link href="/orders" onClick={() => setCurrentPage("Orders")}>
              <button 
                className={`flex items-center w-full p-2 text-left rounded ${isActive("/orders") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
              >
                <i className="fas fa-shopping-cart w-5"></i>
                <span className="ml-2">Orders</span>
              </button>
            </Link>
          </li>
          <li className="mb-1">
            <Link href="/order-picking" onClick={() => setCurrentPage("OrderPicking")}>
              <button 
                className={`flex items-center w-full p-2 text-left rounded ${isActive("/order-picking") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
              >
                <i className="fas fa-clipboard-check w-5"></i>
                <span className="ml-2">Order Picking</span>
              </button>
            </Link>
          </li>
          <li className="mb-1">
            <Link href="/products" onClick={() => setCurrentPage("Products")}>
              <button 
                className={`flex items-center w-full p-2 text-left rounded ${isActive("/products") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
              >
                <i className="fas fa-box w-5"></i>
                <span className="ml-2">Products</span>
              </button>
            </Link>
          </li>
          <li className="mb-1">
            <Link href="/customers" onClick={() => setCurrentPage("Customers")}>
              <button 
                className={`flex items-center w-full p-2 text-left rounded ${isActive("/customers") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
              >
                <i className="fas fa-users w-5"></i>
                <span className="ml-2">Customers</span>
              </button>
            </Link>
          </li>
          <li className="mb-1">
            <Link href="/inventory" onClick={() => setCurrentPage("Inventory")}>
              <button 
                className={`flex items-center w-full p-2 text-left rounded ${isActive("/inventory") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
              >
                <i className="fas fa-warehouse w-5"></i>
                <span className="ml-2">Inventory</span>
              </button>
            </Link>
          </li>
          <li className="mb-1">
            <Link href="/reports" onClick={() => setCurrentPage("Reports")}>
              <button 
                className={`flex items-center w-full p-2 text-left rounded ${isActive("/reports") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
              >
                <i className="fas fa-chart-bar w-5"></i>
                <span className="ml-2">Reports</span>
              </button>
            </Link>
          </li>
          <li className="mb-1">
            <Link href="/settings" onClick={() => setCurrentPage("Settings")}>
              <button 
                className={`flex items-center w-full p-2 text-left rounded ${isActive("/settings") ? "bg-primary hover:bg-blue-700" : "hover:bg-slate-700"} transition-colors`}
              >
                <i className="fas fa-cog w-5"></i>
                <span className="ml-2">Settings</span>
              </button>
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
