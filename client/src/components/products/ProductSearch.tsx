import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Box, QrCode, MapPin } from "lucide-react";

interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  minStockLevel: number;
  barcode?: string;
  location?: string;
  imagePath?: string;
  unitsPerBox?: number;
}

interface ProductSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
}

const ProductSearch = ({ isOpen, onClose, onSelectProduct }: ProductSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("all");
  const [stockStatus, setStockStatus] = useState("all");
  const modalRef = useRef<HTMLDivElement>(null);
  
  const { data: products, isLoading, refetch } = useQuery<Product[]>({
    queryKey: ['/api/products/search', searchTerm, category, stockStatus],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (searchTerm) searchParams.append('query', searchTerm);
      if (category && category !== 'all') searchParams.append('category', category);
      if (stockStatus && stockStatus !== 'all') searchParams.append('stockStatus', stockStatus);
      
      const response = await fetch(`/api/products/search?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to search products');
      return response.json();
    },
    enabled: isOpen,
  });

  // Function to handle click outside the modal
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
      onClose();
    }
  }, [onClose]);

  // Function to handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Add event listeners when modal is open
  useEffect(() => {
    if (isOpen) {
      refetch();
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      
      // Set focus on search input when modal opens
      const searchInput = document.querySelector('.product-search-input input') as HTMLInputElement;
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
      }
    }
    
    // Cleanup event listeners
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, refetch, handleClickOutside, handleKeyDown]);

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
      <div ref={modalRef} className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[95vh] flex flex-col">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-xl">Search Products</h2>
          <button 
            onClick={onClose} 
            className="flex items-center justify-center p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 min-h-[44px] min-w-[44px]"
            aria-label="Close"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <i className="fas fa-search text-slate-400 text-lg"></i>
              </span>
              <Input
                placeholder="Search by product name or SKU"
                className="pl-10 h-12 text-base product-search-input"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value.length === 0) {
                    setTimeout(() => refetch(), 100);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                  if (e.key === 'Escape') onClose();
                }}
              />
            </div>
            <Button 
              onClick={handleSearch} 
              className="ml-3 h-12 px-5 text-base"
            >
              <i className="fas fa-search mr-2"></i> Search
            </Button>
          </div>
          <div className="flex flex-wrap items-center mt-4 gap-3">
            <div className="flex items-center">
              <span className="text-base font-medium text-slate-600 mr-3">Category:</span>
              <Select 
                value={category} 
                onValueChange={(value) => {
                  setCategory(value);
                  setTimeout(() => refetch(), 100);
                }}
              >
                <SelectTrigger className="w-48 h-12 text-base">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="h-10 text-base">All Categories</SelectItem>
                  <SelectItem value="default" className="h-10 text-base">Default Category</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center">
              <span className="text-base font-medium text-slate-600 mr-3">Stock:</span>
              <Select 
                value={stockStatus} 
                onValueChange={(value) => {
                  setStockStatus(value);
                  setTimeout(() => refetch(), 100);
                }}
              >
                <SelectTrigger className="w-48 h-12 text-base">
                  <SelectValue placeholder="All Stock Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="h-10 text-base">All Stock Status</SelectItem>
                  <SelectItem value="in-stock" className="h-10 text-base">In Stock</SelectItem>
                  <SelectItem value="low-stock" className="h-10 text-base">Low Stock</SelectItem>
                  <SelectItem value="out-stock" className="h-10 text-base">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-10 text-center">
              <div className="inline-flex flex-col items-center justify-center">
                <i className="fas fa-spinner fa-spin text-4xl text-slate-400 mb-4"></i>
                <span className="text-slate-500 text-lg">Loading products...</span>
              </div>
            </div>
          ) : products?.length === 0 ? (
            <div className="py-10 text-center">
              <div className="inline-flex flex-col items-center justify-center">
                <i className="fas fa-search text-4xl text-slate-300 mb-4"></i>
                <span className="text-slate-500 text-lg">No products found matching your criteria</span>
                <p className="text-slate-400 mt-2">Try adjusting your search terms or filters</p>
              </div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500 uppercase tracking-wider">SKU</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500 uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products?.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-4 py-5 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-12 w-12 flex-shrink-0 rounded bg-slate-100 flex items-center justify-center">
                          {product.imagePath ? (
                            <img 
                              src={product.imagePath} 
                              alt={product.name} 
                              className="h-12 w-12 object-cover rounded"
                            />
                          ) : (
                            <Box className="h-6 w-6 text-slate-400" />
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-base font-medium text-slate-900">{product.name}</div>
                          {product.barcode && (
                            <div className="text-sm text-slate-500">
                              <QrCode className="h-4 w-4 inline-block mr-1" />
                              {product.barcode}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5 whitespace-nowrap text-base text-slate-500">
                      {product.sku}
                    </td>
                    <td className="px-4 py-5 whitespace-nowrap text-base text-slate-500">
                      {product.category}
                    </td>
                    <td className="px-4 py-5 whitespace-nowrap">
                      <div className={`text-base font-medium ${getStockStatusClass(product.currentStock, product.minStockLevel)}`}>
                        {product.currentStock} 
                        <span className="text-slate-400 ml-1">/ {product.minStockLevel} min</span>
                      </div>
                      {product.location && (
                        <div className="text-sm text-slate-500">
                          <MapPin className="h-4 w-4 inline-block mr-1" />
                          {product.location}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-5 whitespace-nowrap text-right">
                      <Button
                        onClick={() => onSelectProduct(product)}
                        className="h-10 min-w-[120px] text-base"
                        disabled={product.currentStock === 0}
                      >
                        {product.currentStock === 0 ? 
                          <i className="fas fa-ban mr-2"></i> : 
                          <i className="fas fa-plus mr-2"></i>
                        }
                        {product.currentStock === 0 ? "Out of Stock" : "Select"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-5 border-t border-slate-200 flex flex-wrap justify-between items-center gap-4">
          <span className="text-base text-slate-600">
            {isLoading ? (
              <div className="flex items-center">
                <i className="fas fa-spinner fa-spin mr-2"></i> Loading products...
              </div>
            ) : products ? (
              `Showing ${products.length} products`
            ) : (
              "No products found"
            )}
          </span>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline"
              className="h-10 px-4"
              onClick={onClose}
            >
              <i className="fas fa-times mr-2"></i> Close
            </Button>
            <button 
              className="flex items-center justify-center h-10 px-4 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-base" 
              disabled
            >
              <i className="fas fa-chevron-left mr-2"></i> Previous
            </button>
            <button 
              className="flex items-center justify-center h-10 px-4 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-base" 
              disabled
            >
              Next <i className="fas fa-chevron-right ml-2"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductSearch;