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
  <div className="p-6 space-y-6 animate-fade-in-up">
    {/* Stat cards skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card-floating p-5 h-[120px]">
          <div className="flex items-start justify-between mb-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-5 w-12 rounded-lg" />
          </div>
          <Skeleton className="h-3 w-20 rounded-lg mb-2" />
          <Skeleton className="h-6 w-14 rounded-lg" />
        </div>
      ))}
    </div>

    {/* Content area skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 card-floating p-5 space-y-4">
        <Skeleton className="h-5 w-40 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      <div className="lg:col-span-2 card-floating p-5 space-y-4">
        <Skeleton className="h-5 w-32 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
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
import PageTransition from "@/components/layout/PageTransition";
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
    return (
      <div className="flex items-center justify-center h-screen bg-mesh-gradient">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20 animate-float">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <div className="w-5 h-5 border-2 border-teal-400/30 border-t-teal-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Show warehouse staff access to dashboard, orders, products, inventory, and production
  if (user?.role === 'warehouse') {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/orders" component={Orders} />
          <Route path="/orders/:id" component={Orders} />
          <Route path="/order-picking" component={OrderPicking} />
          <Route path="/order-picking/:id" component={OrderPicking} />
          <Route path="/product-barcode/:id" component={ProductBarcode} />
          <Route path="/unshipped-items" component={UnshippedItems} />
          <Route path="/orders/unshipped-items" component={UnshippedItems} />
          <Route path="/products" component={ProductsShopify} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/inventory-predictions" component={InventoryPredictions} />
          <Route path="/production" component={Production} />
          <Route>
            {/* Default to dashboard for warehouse staff */}
            <Dashboard />
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
    return (
      <div className="flex items-center justify-center h-screen bg-mesh-gradient">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20 animate-float">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <div className="w-5 h-5 border-2 border-teal-400/30 border-t-teal-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Handle special routes that don't need authentication
  if (location === '/login') {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen bg-mesh-gradient"><div className="w-5 h-5 border-2 border-teal-400/30 border-t-teal-500 rounded-full animate-spin" /></div>}>
        <Login />
      </Suspense>
    );
  }
  
  // Print template and other printing pages don't need authentication
  if (location === '/print-template') {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen bg-mesh-gradient"><div className="w-5 h-5 border-2 border-teal-400/30 border-t-teal-500 rounded-full animate-spin" /></div>}>
        <PrintTemplate />
      </Suspense>
    );
  }
  
  if (location.startsWith('/shipping-label/')) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen bg-mesh-gradient"><div className="w-5 h-5 border-2 border-teal-400/30 border-t-teal-500 rounded-full animate-spin" /></div>}>
        <ShippingLabel />
      </Suspense>
    );
  }
  
  // Multi-label print view doesn't need authentication
  const printLabelsMatch = location.match(/\/print-labels\/(\d+)\/(\d+)/);
  if (printLabelsMatch) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen bg-mesh-gradient"><div className="w-5 h-5 border-2 border-teal-400/30 border-t-teal-500 rounded-full animate-spin" /></div>}>
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
    <div className="flex h-screen overflow-hidden bg-mesh-gradient bg-dot-pattern">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden md:ml-0">
        <Header />
        <main className="flex-1 overflow-auto p-4 md:p-6 scrollbar-thin">
          <PageTransition>
            <Router />
          </PageTransition>
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