import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Orders from "@/pages/Orders";
import ProductsShopify from "@/pages/ProductsShopify";
import Inventory from "@/pages/Inventory";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import OrderPicking from "@/pages/OrderPicking";
import ProductBarcode from "@/pages/ProductBarcode";
import Customers from "@/pages/Customers";
import Categories from "@/pages/Categories";
import Login from "@/pages/Login";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { SidebarProvider } from "@/context/SidebarContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { useTranslation } from 'react-i18next';

function AuthenticatedRouter() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // If still loading auth state, show nothing (could add a loading spinner)
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // Show warehouse staff only order picking
  if (user?.role === 'warehouse') {
    return (
      <Switch>
        <Route path="/order-picking" component={OrderPicking} />
        <Route path="/order-picking/:id" component={OrderPicking} />
        <Route path="/product-barcode/:id" component={ProductBarcode} />
        <Route>
          {/* Redirect to order picking for warehouse staff if on any other route */}
          {location !== '/order-picking' && (window.location.href = '/order-picking')}
          <OrderPicking />
        </Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/orders" component={Orders} />
      <Route path="/orders/:id" component={Orders} />
      <Route path="/orders/:id/edit" component={Orders} />
      <Route path="/products" component={ProductsShopify} />
      <Route path="/categories" component={Categories} />
      <Route path="/customers" component={Customers} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/reports" component={Reports} />
      <Route path="/settings" component={Settings} />
      <Route path="/order-picking" component={OrderPicking} />
      <Route path="/order-picking/:id" component={OrderPicking} />
      <Route path="/product-barcode/:id" component={ProductBarcode} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // If loading auth state, show minimal loading indicator
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // Handle login route separately
  if (location === '/login') {
    return <Login />;
  }

  // If not authenticated and not on login page, redirect to login
  if (!isAuthenticated) {
    // Redirect to login page
    window.location.href = '/login';
    return null;
  }

  // Show authenticated routes
  return <AuthenticatedRouter />;
}

function Layout() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // If on login page or loading, don't show the layout
  if (location === '/login' || isLoading || !isAuthenticated) {
    return <Router />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 bg-slate-50">
          <Router />
        </main>
      </div>
    </div>
  );
}

function App() {
  const { t } = useTranslation(); // Added useTranslation hook
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <SidebarProvider>
            <Layout />
            <Toaster />
          </SidebarProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;