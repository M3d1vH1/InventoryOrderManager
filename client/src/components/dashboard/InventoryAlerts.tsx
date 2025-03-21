import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, ArrowUpDown, Eye, Edit, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";
import i18n from "@/i18n";

interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  description?: string;
  minStockLevel: number;
  currentStock: number;
}

const InventoryAlerts = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<'name' | 'stock'>('stock');
  const [, navigate] = useLocation();
  
  const { data: lowStockProducts, isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products/low-stock'],
  });

  const toggleLanguage = () => {
    const currentLang = i18n.language;
    const newLang = currentLang === 'en' ? 'el' : 'en';
    i18n.changeLanguage(newLang);
    toast({
      title: t('settings.languageChanged'),
      description: newLang === 'en' ? 'English' : 'Ελληνικά',
      duration: 3000,
    });
  };

  // Sort products by severity (stock level) or name
  const sortedProducts = useMemo(() => {
    if (!lowStockProducts) return [];
    
    return [...lowStockProducts].sort((a, b) => {
      if (sortBy === 'stock') {
        // Sort by stock level (most critical first)
        const aRatio = a.currentStock / a.minStockLevel;
        const bRatio = b.currentStock / b.minStockLevel;
        return aRatio - bRatio;
      } else {
        // Sort by name
        return a.name.localeCompare(b.name);
      }
    });
  }, [lowStockProducts, sortBy]);

  const renderLowStockItems = () => {
    if (isLoading) {
      return (
        <table className="min-w-full">
          <thead className="bg-slate-50 text-slate-500 text-sm">
            <tr>
              <th className="py-3 px-4 text-left font-medium">{t('products.name')}</th>
              <th className="py-3 px-4 text-left font-medium">{t('products.sku')}</th>
              <th className="py-3 px-4 text-left font-medium">{t('products.category')}</th>
              <th className="py-3 px-4 text-center font-medium">{t('inventory.stock')}</th>
              <th className="py-3 px-4 text-left font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {Array(4).fill(0).map((_, index) => (
              <tr key={index} className="animate-pulse">
                <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded"></div></td>
                <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded"></div></td>
                <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded"></div></td>
                <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-16 mx-auto"></div></td>
                <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-12"></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (!lowStockProducts || lowStockProducts.length === 0) {
      return (
        <table className="min-w-full">
          <thead className="bg-slate-50 text-slate-500 text-sm">
            <tr>
              <th className="py-3 px-4 text-left font-medium">{t('products.name')}</th>
              <th className="py-3 px-4 text-left font-medium">{t('products.sku')}</th>
              <th className="py-3 px-4 text-left font-medium">{t('products.category')}</th>
              <th className="py-3 px-4 text-center font-medium">{t('inventory.stock')}</th>
              <th className="py-3 px-4 text-left font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="py-6 text-center text-green-600">
                <i className="fas fa-check-circle text-green-500 text-xl mb-2"></i> {t('inventory.noLowStockItems')}
              </td>
            </tr>
          </tbody>
        </table>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="md:pr-2">
          <table className="w-full divide-y divide-slate-200 border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="py-2 px-2 text-left font-medium">{t('products.name')}</th>
                <th className="py-2 px-2 text-center font-medium w-20">{t('inventory.stock')}</th>
                <th className="py-2 px-1 text-center font-medium w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedProducts.slice(0, Math.ceil(sortedProducts.length / 2)).map((product) => {
                const textColor = product.currentStock === 0 ? 'text-red-600' : 
                                  product.currentStock < product.minStockLevel / 2 ? 'text-red-600' : 
                                  'text-amber-600';
                const bgColor = product.currentStock === 0 ? 'bg-red-50' : 
                                product.currentStock < product.minStockLevel / 2 ? 'bg-red-50' : 
                                'bg-amber-50';
                
                return (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 whitespace-nowrap text-sm">
                      <div className="font-medium text-slate-900 truncate max-w-full" title={product.name}>
                        {product.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {product.sku}
                      </div>
                    </td>
                    <td className={`py-1.5 px-2 whitespace-nowrap text-sm text-center ${bgColor}`}>
                      <span className={`font-semibold ${textColor}`}>{product.currentStock}</span>
                      <span className="text-slate-500"> / {product.minStockLevel}</span>
                    </td>
                    <td className="py-1.5 px-1 whitespace-nowrap text-center">
                      <button
                        onClick={() => navigate(`/products?view=${product.id}`)}
                        className="text-slate-600 hover:text-primary"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="md:pl-2 md:border-l md:border-slate-200">
          <table className="w-full divide-y divide-slate-200 border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="py-2 px-2 text-left font-medium">{t('products.name')}</th>
                <th className="py-2 px-2 text-center font-medium w-20">{t('inventory.stock')}</th>
                <th className="py-2 px-1 text-center font-medium w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedProducts.slice(Math.ceil(sortedProducts.length / 2)).map((product) => {
                const textColor = product.currentStock === 0 ? 'text-red-600' : 
                                  product.currentStock < product.minStockLevel / 2 ? 'text-red-600' : 
                                  'text-amber-600';
                const bgColor = product.currentStock === 0 ? 'bg-red-50' : 
                                product.currentStock < product.minStockLevel / 2 ? 'bg-red-50' : 
                                'bg-amber-50';
                
                return (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 whitespace-nowrap text-sm">
                      <div className="font-medium text-slate-900 truncate max-w-full" title={product.name}>
                        {product.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {product.sku}
                      </div>
                    </td>
                    <td className={`py-1.5 px-2 whitespace-nowrap text-sm text-center ${bgColor}`}>
                      <span className={`font-semibold ${textColor}`}>{product.currentStock}</span>
                      <span className="text-slate-500"> / {product.minStockLevel}</span>
                    </td>
                    <td className="py-1.5 px-1 whitespace-nowrap text-center">
                      <button
                        onClick={() => navigate(`/products?view=${product.id}`)}
                        className="text-slate-600 hover:text-primary"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="lg:col-span-2 bg-white rounded-lg shadow">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <div className="flex items-center">
          <h2 className="font-semibold text-lg">{t('inventory.alerts')}</h2>
          {lowStockProducts && lowStockProducts.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
              {lowStockProducts.length}
            </span>
          )}
          <button 
            onClick={toggleLanguage}
            className="ml-3 p-1.5 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center"
            title={t('settings.changeLanguage')}
            style={{ width: '28px', height: '28px' }}
          >
            <Globe className="h-4 w-4 text-blue-600" />
          </button>
        </div>
        <div className="flex items-center space-x-4">
          {lowStockProducts && lowStockProducts.length > 0 && (
            <div className="flex text-xs text-slate-500 items-center">
              <span className="mr-2">{t('common.sortBy')}:</span>
              <button 
                onClick={() => setSortBy('stock')}
                className={`mr-2 flex items-center ${sortBy === 'stock' ? 'text-primary font-medium' : ''}`}
              >
                {t('inventory.criticalFirst')}
                {sortBy === 'stock' && <ArrowUpDown className="h-3 w-3 ml-1" />}
              </button>
              <button 
                onClick={() => setSortBy('name')}
                className={`flex items-center ${sortBy === 'name' ? 'text-primary font-medium' : ''}`}
              >
                {t('products.name')}
                {sortBy === 'name' && <ArrowUpDown className="h-3 w-3 ml-1" />}
              </button>
            </div>
          )}
          <Link href="/products?stock=low" className="text-primary hover:text-blue-700 text-sm font-medium">
            {t('inventory.viewAllLowStockItems')}
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        {renderLowStockItems()}
      </div>
      <div className="p-4 border-t border-slate-200 flex items-center justify-between">
        <span className="text-slate-600 text-sm">
          {isLoading 
            ? t('common.loading')
            : lowStockProducts?.length 
              ? t('inventory.lowStockItemsCount', { count: lowStockProducts.length })
              : t('inventory.noLowStockItems')
          }
        </span>
        <div className="grid grid-cols-2 gap-2 w-64">
          <Link href="/products" className="bg-primary text-white py-1.5 text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center w-full">
            <Plus className="h-3.5 w-3.5 mr-1" /> {t('products.addProduct')}
          </Link>
          <Link href="/products?import=true" className="bg-slate-200 text-slate-800 py-1.5 text-sm rounded-md hover:bg-slate-300 transition-colors flex items-center justify-center">
            <Upload className="h-3.5 w-3.5 mr-1" /> {t('inventory.import')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default InventoryAlerts;
