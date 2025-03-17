import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Orders from "@/pages/Orders";
import Products from "@/pages/Products";
import Inventory from "@/pages/Inventory";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import OrderPicking from "@/pages/OrderPicking";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { SidebarProvider } from "@/context/SidebarContext";
import { useTranslation } from 'react-i18next';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/orders" component={Orders} />
      <Route path="/products" component={Products} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/reports" component={Reports} />
      <Route path="/settings" component={Settings} />
      <Route path="/order-picking" component={OrderPicking} />
      <Route path="/order-picking/:id" component={OrderPicking} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <Layout>
          <Router />
        </Layout>
        <Toaster />
      </SidebarProvider>
    </QueryClientProvider>
  );
}

export default App;