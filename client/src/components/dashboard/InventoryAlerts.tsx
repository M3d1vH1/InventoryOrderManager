import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, ArrowUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";

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
  
  const { data: lowStockProducts, isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products/low-stock'],
  });

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
        <div className="py-4 text-center">
          <span className="text-slate-500">{t('inventory.loadingInventory')}</span>
        </div>
      );
    }

    if (!lowStockProducts || lowStockProducts.length === 0) {
      return (
        <div className="py-4 text-center">
          <i className="fas fa-check-circle text-green-500 text-3xl mb-2"></i>
          <p className="text-green-600">{t('inventory.noLowStockItems')}</p>
        </div>
      );
    }

    return (
      <div className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedProducts.map((product) => {
            const textColor = product.currentStock === 0 ? 'text-red-600' : 
                              product.currentStock < product.minStockLevel / 2 ? 'text-red-600' : 
                              'text-amber-600';
            const bgColor = product.currentStock === 0 ? 'bg-red-50' : 
                            product.currentStock < product.minStockLevel / 2 ? 'bg-red-50' : 
                            'bg-amber-50';
            
            return (
              <div key={product.id} className="flex items-center justify-between border rounded-md px-3 py-2 hover:bg-slate-50">
                <div className="flex-1 mr-3">
                  <div className="font-medium text-sm truncate" title={product.name}>
                    {product.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {product.sku}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className={`text-sm font-semibold ${textColor} ${bgColor} px-2 py-1 rounded-md mr-3`}>
                    {product.currentStock} / {product.minStockLevel}
                  </div>
                  <Link href={`/products/${product.id}`}>
                    <button className="text-primary hover:text-blue-700 p-1">
                      <i className="fas fa-arrow-right"></i>
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <h2 className="font-semibold text-lg">{t('inventory.alerts')}</h2>
            {lowStockProducts && lowStockProducts.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                {lowStockProducts.length}
              </span>
            )}
          </div>
          <Link href="/products?stock=low" className="text-primary hover:text-blue-700 text-sm font-medium">
            {t('inventory.viewAllLowStockItems')}
          </Link>
        </div>
        {lowStockProducts && lowStockProducts.length > 0 && (
          <div className="flex text-xs text-slate-500">
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
      </div>
      <div>
        {renderLowStockItems()}
      </div>
      <div className="px-4 py-3 border-t border-slate-200">
        <div className="grid grid-cols-2 gap-2">
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
