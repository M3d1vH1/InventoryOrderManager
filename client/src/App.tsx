import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { Sidebar, Header } from '@/components/layout';
import Login from '@/pages/auth/login';
import Dashboard from '@/pages/dashboard';
import Products from '@/pages/products';
import Orders from '@/pages/orders';
import Customers from '@/pages/customers';
import Settings from '@/pages/settings';
import { ProtectedRoute } from '@/components/protected-route';
import { useTranslation } from 'react-i18next';
import './i18n'; // Import i18n setup explicitly

const queryClient = new QueryClient();

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
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products"
                  element={
                    <ProtectedRoute>
                      <Products />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders"
                  element={
                    <ProtectedRoute>
                      <Orders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customers"
                  element={
                    <ProtectedRoute>
                      <Customers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
              </Route>
            </Routes>
          </Router>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;