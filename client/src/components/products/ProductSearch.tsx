import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  minStockLevel: number;
}

interface ProductSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
}

const ProductSearch = ({ isOpen, onClose, onSelectProduct }: ProductSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("");
  const [stockStatus, setStockStatus] = useState("");

  const { data: products, isLoading, refetch } = useQuery<Product[]>({
    queryKey: ['/api/products', searchTerm, category, stockStatus],
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  const handleSearch = () => {
    refetch();
  };

  const getStockStatusClass = (currentStock: number, minStockLevel: number) => {
    if (currentStock === 0) return "text-red-600";
    if (currentStock <= minStockLevel) return "text-amber-600";
    return "text-green-600";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-lg">Search Products</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <i className="fas fa-search text-slate-400"></i>
              </span>
              <Input
                placeholder="Search by product name or SKU"
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} className="ml-2">
              Search
            </Button>
          </div>
          <div className="flex items-center mt-2 text-sm">
            <span className="text-slate-600 mr-2">Filter by:</span>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-auto">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="widgets">Widgets</SelectItem>
                <SelectItem value="connectors">Connectors</SelectItem>
                <SelectItem value="brackets">Brackets</SelectItem>
                <SelectItem value="mounts">Mounts</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stockStatus} onValueChange={setStockStatus} className="ml-2">
              <SelectTrigger className="w-auto">
                <SelectValue placeholder="All Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Stock Status</SelectItem>
                <SelectItem value="in-stock">In Stock</SelectItem>
                <SelectItem value="low-stock">Low Stock</SelectItem>
                <SelectItem value="out-stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-4 text-center">
              <span className="text-slate-500">Loading products...</span>
            </div>
          ) : products?.length === 0 ? (
            <div className="py-4 text-center">
              <span className="text-slate-500">No products found matching your criteria</span>
            </div>
          ) : (
            <table className="min-w-full">
              <thead className="bg-slate-50 text-slate-500 text-sm">
                <tr>
                  <th className="py-2 px-3 text-left font-medium">Product</th>
                  <th className="py-2 px-3 text-left font-medium">SKU</th>
                  <th className="py-2 px-3 text-left font-medium">Category</th>
                  <th className="py-2 px-3 text-left font-medium">Stock</th>
                  <th className="py-2 px-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products?.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3">{product.name}</td>
                    <td className="py-2 px-3">{product.sku}</td>
                    <td className="py-2 px-3">{product.category}</td>
                    <td className="py-2 px-3">
                      <span className={`font-medium ${getStockStatusClass(product.currentStock, product.minStockLevel)}`}>
                        {product.currentStock}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <Button
                        onClick={() => onSelectProduct(product)}
                        size="sm"
                        disabled={product.currentStock === 0}
                      >
                        Select
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-between items-center">
          <span className="text-sm text-slate-600">
            {isLoading ? "Loading..." : products ? `Showing ${products.length} products` : "No products found"}
          </span>
          <div className="flex items-center space-x-1">
            <button 
              className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50" 
              disabled
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            <button 
              className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50" 
              disabled
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductSearch;
