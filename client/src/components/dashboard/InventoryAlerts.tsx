import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, ArrowUpDown, Eye, ArrowUpRight, AlertTriangle } from "lucide-react";
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
  const [, navigate] = useLocation();

  const { data: lowStockProducts, isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products/low-stock'],
    select: (data: any) => {
      if (data && typeof data === 'object' && 'data' in data) {
        return Array.isArray(data.data) ? data.data : [];
      }
      return Array.isArray(data) ? data : [];
    }
  });

  const sortedProducts = useMemo(() => {
    if (!lowStockProducts) return [];
    return [...lowStockProducts].sort((a, b) => {
      if (sortBy === 'stock') {
        const aRatio = a.currentStock / a.minStockLevel;
        const bRatio = b.currentStock / b.minStockLevel;
        return aRatio - bRatio;
      } else {
        return a.name.localeCompare(b.name);
      }
    });
  }, [lowStockProducts, sortBy]);

  const renderProductRow = (product: Product) => {
    const ratio = product.currentStock / product.minStockLevel;
    const isCritical = product.currentStock === 0 || ratio < 0.5;

    return (
      <div
        key={product.id}
        className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-50/80 transition-colors group cursor-pointer"
        onClick={() => navigate(`/products?view=${product.id}`)}
      >
        <div className="min-w-0 flex-1 mr-3">
          <div className="text-sm font-medium text-slate-900 truncate">{product.name}</div>
          <div className="text-xs text-slate-400 truncate">{product.sku}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`text-right px-2.5 py-1 rounded-lg text-xs font-semibold ${
            isCritical
              ? 'bg-rose-50 text-rose-600 border border-rose-200/60'
              : 'bg-amber-50 text-amber-600 border border-amber-200/60'
          }`}>
            {product.currentStock} / {product.minStockLevel}
          </div>
          <Eye size={14} className="text-slate-300 group-hover:text-teal-500 transition-colors" />
        </div>
      </div>
    );
  };

  return (
    <div className="card-floating overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.15s', animationFillMode: 'backwards' }}>
      <div className="p-5 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <h2 className="font-semibold text-base text-slate-900">{t('inventory.alerts')}</h2>
          {lowStockProducts && lowStockProducts.length > 0 && (
            <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-xs font-bold rounded-full border border-rose-200/60">
              {lowStockProducts.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lowStockProducts && lowStockProducts.length > 0 && (
            <div className="flex text-xs text-slate-400 items-center gap-1">
              <button
                onClick={() => setSortBy('stock')}
                className={`px-2 py-1 rounded-lg transition-colors ${sortBy === 'stock' ? 'bg-teal-50 text-teal-600 font-medium' : 'hover:bg-slate-50'}`}
              >
                {t('inventory.criticalFirst')}
              </button>
              <button
                onClick={() => setSortBy('name')}
                className={`px-2 py-1 rounded-lg transition-colors ${sortBy === 'name' ? 'bg-teal-50 text-teal-600 font-medium' : 'hover:bg-slate-50'}`}
              >
                {t('products.name')}
              </button>
            </div>
          )}
          <Link href="/products?stock=low" className="text-teal-500 hover:text-teal-600 text-sm font-medium flex items-center gap-1 transition-colors">
            {t('inventory.viewAllLowStockItems')}
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      <div className="px-3 pb-2 max-h-[400px] overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-3">
                <div className="flex-1">
                  <div className="shimmer h-4 rounded-lg w-32 mb-1.5" />
                  <div className="shimmer h-3 rounded-lg w-20" />
                </div>
                <div className="shimmer h-6 rounded-lg w-16" />
              </div>
            ))}
          </div>
        ) : !lowStockProducts || lowStockProducts.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={20} className="text-emerald-500" />
            </div>
            <p className="text-sm text-slate-400">{t('inventory.noLowStockItems')}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sortedProducts.map(renderProductRow)}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-slate-400 text-xs">
          {isLoading
            ? t('common.loading')
            : lowStockProducts?.length
              ? t('inventory.lowStockItemsCount', { count: lowStockProducts.length })
              : t('inventory.noLowStockItems')
          }
        </span>
        <div className="flex gap-2">
          <Link href="/products" className="inline-flex items-center gap-1.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white py-1.5 px-3 text-xs font-medium rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all shadow-sm shadow-teal-500/20">
            <Plus size={13} /> {t('products.addProduct')}
          </Link>
          <Link href="/products?import=true" className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 py-1.5 px-3 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors">
            <Upload size={13} /> {t('inventory.import')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default InventoryAlerts;
