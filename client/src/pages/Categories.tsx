import React, { useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import CategoryManager from "@/components/products/CategoryManager";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";

const Categories = () => {
  const { t } = useTranslation();
  const { setCurrentPage } = useSidebar();
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    setCurrentPage("Categories");
    
    // Redirect non-admin users
    if (user && user.role !== 'admin') {
      setLocation('/products');
    }
  }, [setCurrentPage, user, setLocation]);

  if (!isAuthenticated || (user && user.role !== 'admin')) {
    return null; // Or return an "Access Denied" message
  }

  return (
    <div className="container mx-auto py-6">
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle>{t('categories.title')}</CardTitle>
          <CardDescription>{t('categories.description') || 'Manage product categories and their properties'}</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryManager />
        </CardContent>
      </Card>
    </div>
  );
};

export default Categories;