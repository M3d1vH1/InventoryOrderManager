import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  
  const { data: lowStockProducts, isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products/low-and-out-of-stock'],
  });

  const restockMutation = useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest<Product>(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStock: 30 }) // Set a default restock amount
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products/low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products/low-and-out-of-stock'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: t('inventory.productRestocked'),
        description: t('inventory.inventoryUpdated'),
      });
    },
    onError: (error) => {
      toast({
        title: t('inventory.failedToRestock'),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleRestock = (productId: number) => {
    restockMutation.mutate(productId);
  };

  const renderLowStockItems = () => {
    if (isLoading) {
      return Array(3).fill(0).map((_, index) => (
        <div key={index} className="border-l-4 border-slate-300 bg-slate-50 p-3 rounded-r animate-pulse">
          <div className="flex justify-between items-start">
            <div className="w-full">
              <div className="h-5 bg-slate-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            </div>
            <div className="h-8 bg-slate-200 rounded w-20"></div>
          </div>
        </div>
      ));
    }

    if (!lowStockProducts || lowStockProducts.length === 0) {
      return (
        <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded-r">
          <p className="text-green-800">{t('inventory.noLowStockItems')}</p>
        </div>
      );
    }

    return lowStockProducts.map((product) => {
      const borderColor = product.currentStock === 0 ? 'border-red-500 bg-red-50' : 
                          product.currentStock < product.minStockLevel / 2 ? 'border-red-500 bg-red-50' : 
                          'border-amber-500 bg-amber-50';
      const textColor = product.currentStock === 0 ? 'text-red-600' : 
                        product.currentStock < product.minStockLevel / 2 ? 'text-red-600' : 
                        'text-amber-600';

      return (
        <div key={product.id} className={`border-l-4 ${borderColor} p-3 rounded-r`}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-medium">{product.name}</h3>
              <p className="text-sm text-slate-600">
                {t('inventory.stock')}: <span className={`font-medium ${textColor}`}>{product.currentStock}</span> ({t('inventory.min')}: {product.minStockLevel})
              </p>
            </div>
            <button 
              onClick={() => handleRestock(product.id)}
              className="bg-white text-slate-600 hover:text-primary border border-slate-300 rounded-md px-2 py-1 text-sm"
              disabled={restockMutation.isPending}
            >
              {restockMutation.isPending ? t('inventory.restocking') : t('inventory.restock')}
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <h2 className="font-semibold text-lg">{t('inventory.alerts')}</h2>
        <Link href="/products?stock=all-alerts" className="text-primary hover:text-blue-700 text-sm font-medium">
          {t('inventory.viewAllStockAlerts')}
        </Link>
      </div>
      <div className="p-4 space-y-4">
        {renderLowStockItems()}
      </div>
      <div className="p-4 border-t border-slate-200">
        <h3 className="font-medium text-sm mb-3">{t('inventory.quickActions')}</h3>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/products" className="bg-primary text-white py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center w-full">
            <Plus className="h-4 w-4 mr-2" /> {t('products.addProduct')}
          </Link>
          <button className="bg-slate-200 text-slate-800 py-2 rounded-md hover:bg-slate-300 transition-colors flex items-center justify-center">
            <Upload className="h-4 w-4 mr-2" /> {t('inventory.import')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryAlerts;
