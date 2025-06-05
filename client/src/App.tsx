import React, { Suspense } from "react";
import "@/lib/icons";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import "@/lib/icons";
import { Toaster } from "@/components/ui/toaster";
import { DevAutoLogin } from "@/components/DevAutoLogin";
import { Skeleton } from "@/components/ui/skeleton";

// Loading component for Suspense fallbacks
const PageLoadingFallback = () => (
  <div className="p-6 space-y-6">
    {/* Page header skeleton */}
    <div className="space-y-2">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
    
    {/* Content area skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
    
    {/* Additional content skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  </div>
);

// Lazy load all page components
const NotFound = React.lazy(() => import("@/pages/not-found"));
const Dashboard = React.lazy(() => import("@/pages/Dashboard"));
const Orders = React.lazy(() => import("@/pages/Orders"));
const ProductsShopify = React.lazy(() => import("@/pages/ProductsShopify"));
const Inventory = React.lazy(() => import("@/pages/Inventory"));
const Reports = React.lazy(() => import("@/pages/Reports"));
const Settings = React.lazy(() => import("@/pages/Settings"));
const OrderPicking = React.lazy(() => import("@/pages/OrderPicking"));
const ProductBarcode = React.lazy(() => import("@/pages/ProductBarcode"));
const Customers = React.lazy(() => import("@/pages/Customers"));
const Categories = React.lazy(() => import("@/pages/Categories"));
const UnshippedItems = React.lazy(() => import("@/pages/UnshippedItems"));
const OrderQuality = React.lazy(() => import("@/pages/OrderQuality"));
const CallLogs = React.lazy(() => import("@/pages/CallLogs"));
const SimpleCalendar = React.lazy(() => import("@/pages/SimpleCalendar"));
const InventoryPredictions = React.lazy(() => import("@/pages/InventoryPredictions"));
const Production = React.lazy(() => import("@/pages/Production"));
const SupplierPayments = React.lazy(() => import("@/pages/SupplierPayments"));
const CalendarTest = React.lazy(() => import("@/pages/CalendarTest"));
const PrinterTest = React.lazy(() => import("@/pages/printerTest"));
const PrintTemplate = React.lazy(() => import("@/pages/PrintTemplate"));
const MultiLabelPrintView = React.lazy(() => import("@/pages/MultiLabelPrintView"));
const ShippingLabel = React.lazy(() => import("@/pages/ShippingLabel"));
const LoggingTest = React.lazy(() => import("@/pages/LoggingTest"));
const Login = React.lazy(() => import("@/pages/Login"));
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { SidebarProvider } from "@/context/SidebarContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { UserProvider } from "@/context/UserContext";
import { useTranslation } from 'react-i18next';
import "@/lib/icons";
import './i18n'; // Import i18n setup explicitly

function AuthenticatedRouter() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // If still loading auth state, show nothing (could add a loading spinner)
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // Show warehouse staff access to order picking, inventory, and production
  if (user?.role === 'warehouse') {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <Switch>
          <Route path="/order-picking" component={OrderPicking} />
          <Route path="/order-picking/:id" component={OrderPicking} />
          <Route path="/product-barcode/:id" component={ProductBarcode} />
          <Route path="/unshipped-items" component={UnshippedItems} />
          <Route path="/orders/unshipped-items" component={UnshippedItems} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/inventory-predictions" component={InventoryPredictions} />
          <Route path="/production" component={Production} />
          <Route>
            {/* Redirect to order picking for warehouse staff if on any other route */}
            {location !== '/order-picking' && 
             location !== '/unshipped-items' &&
             location !== '/orders/unshipped-items' &&
             location !== '/inventory' &&
             location !== '/inventory-predictions' &&
             location !== '/production' && 
             (window.location.href = '/order-picking')}
            <OrderPicking />
          </Route>
        </Switch>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/orders/unshipped-items" component={UnshippedItems} />
        <Route path="/orders/:id/edit" component={Orders} />
        <Route path="/orders/:id" component={Orders} />
        <Route path="/orders" component={Orders} />
        <Route path="/order-quality" component={OrderQuality} />
        <Route path="/order-errors" component={OrderQuality} />
        <Route path="/products" component={ProductsShopify} />
        <Route path="/categories" component={Categories} />
        <Route path="/customers" component={Customers} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/unshipped-items" component={UnshippedItems} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />
        <Route path="/settings/logging-test" component={LoggingTest} />
        <Route path="/order-picking" component={OrderPicking} />
        <Route path="/order-picking/:id" component={OrderPicking} />
        <Route path="/product-barcode/:id" component={ProductBarcode} />
        <Route path="/call-logs" component={CallLogs} />
        <Route path="/call-logs/:id" component={CallLogs} />
        <Route path="/calendar" component={SimpleCalendar} />
        <Route path="/calendar-test" component={CalendarTest} />
        <Route path="/inventory-predictions" component={InventoryPredictions} />
        <Route path="/production" component={Production} />
        <Route path="/supplier-payments" component={SupplierPayments} />
        <Route path="/printer-test" component={PrinterTest} />
        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // If loading auth state, show minimal loading indicator
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // Handle special routes that don't need authentication
  if (location === '/login') {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <Login />
      </Suspense>
    );
  }
  
  // Print template and other printing pages don't need authentication
  if (location === '/print-template') {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <PrintTemplate />
      </Suspense>
    );
  }
  
  if (location.startsWith('/shipping-label/')) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <ShippingLabel />
      </Suspense>
    );
  }
  
  // Multi-label print view doesn't need authentication
  const printLabelsMatch = location.match(/\/print-labels\/(\d+)\/(\d+)/);
  if (printLabelsMatch) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <MultiLabelPrintView />
      </Suspense>
    );
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

  // Special pages that don't need authentication or layout
  if (location === '/login' || location === '/print-template' || isLoading || !isAuthenticated) {
    return <Router />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden md:ml-0">
        <Header />
        <main className="flex-1 overflow-auto p-4 bg-slate-50">
          <Router />
        </main>
      </div>
    </div>
  );
}

function App() {
  const { t, i18n } = useTranslation();
  
  // Ensure Greek language is set
  React.useEffect(() => {
    // Force language to Greek on component mount
    if (i18n.language !== 'el') {
      i18n.changeLanguage('el');
    }
    
    // Set document title in Greek
    document.title = t('app.title');
    
    // Only log in development
    if (import.meta.env.DEV) {
      console.log('App language set to:', i18n.language);
      console.log('App title:', document.title);
    }
    
    // Force Greek language on all routes
    const handleRouteChange = () => {
      if (i18n.language !== 'el') {
        i18n.changeLanguage('el');
      }
    };
    
    // Listen for route changes
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [i18n, t]);
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserProvider>
          <NotificationProvider>
            <SidebarProvider>
              <Layout />
              <Toaster />
              {/* Add our development auto-login component */}
              {import.meta.env.DEV && <DevAutoLogin />}
            </SidebarProvider>
          </NotificationProvider>
        </UserProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;