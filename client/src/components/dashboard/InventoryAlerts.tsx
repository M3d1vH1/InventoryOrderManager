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
      <div className="overflow-hidden p-2">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('products.details')}</th>
              <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-24">{t('inventory.stock')}</th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-10"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {sortedProducts.map((product) => {
              const textColor = product.currentStock === 0 ? 'text-red-600' : 
                                product.currentStock < product.minStockLevel / 2 ? 'text-red-600' : 
                                'text-amber-600';
              const bgColor = product.currentStock === 0 ? 'bg-red-50' : 
                               product.currentStock < product.minStockLevel / 2 ? 'bg-red-50' : 
                               'bg-amber-50';
              
              return (
                <tr key={product.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                    <div className="font-medium text-slate-900 truncate max-w-[200px]" title={product.name}>
                      {product.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {product.sku}
                    </div>
                  </td>
                  <td className={`px-3 py-2 whitespace-nowrap text-sm text-center ${bgColor}`}>
                    <span className={`font-semibold ${textColor}`}>{product.currentStock}</span>
                    <span className="text-slate-500"> / {product.minStockLevel}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-right">
                    <Link href={`/products/${product.id}`}>
                      <button className="text-primary hover:text-blue-700">
                        <i className="fas fa-arrow-right"></i>
                      </button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
