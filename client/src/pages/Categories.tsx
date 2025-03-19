import React, { useEffect } from "react";
import { useTranslation } from 'react-i18next';
import CategoryManager from "@/components/products/CategoryManager";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";

const Categories = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  
  // Only admin users can access this page
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== 'admin') {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">{t('categories.title')}</h1>
        <p className="text-slate-500 mt-1">{t('categories.description')}</p>
      </div>
      
      <CategoryManager />
    </div>
  );
};

export default Categories;