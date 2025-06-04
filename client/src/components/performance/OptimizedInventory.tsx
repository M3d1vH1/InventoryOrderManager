import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BarcodeScanner } from "@/components/barcode";
import OptimizedProductRow from "./OptimizedProductRow";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchIcon, Tag } from "lucide-react";

interface Product {
  id: number;
  name: string;
  sku: string;
  description?: string;
  minStockLevel: number;
  currentStock: number;
  location?: string;
  tags?: string[];
}

// Memoized statistics card component
const StatCard = React.memo<{
  icon: string;
  title: string;
  value: number;
  bgColor: string;
  iconColor: string;
}>(({ icon, title, value, bgColor, iconColor }) => (
  <div className="bg-white rounded-lg shadow p-4 flex items-center">
    <div className={`rounded-full ${bgColor} p-3 mr-4`}>
      <i className={`${icon} ${iconColor} text-xl`}></i>
    </div>
    <div>
      <h3 className="text-sm text-slate-500 font-medium">{title}</h3>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  </div>
));

StatCard.displayName = "StatCard";

// Memoized low stock item component
const LowStockItem = React.memo<{
  product: Product;
  onTagClick: (tag: string) => void;
  onRestock: (productId: number, stock: number) => void;
  isPending: boolean;
}>(({ product, onTagClick, onRestock, isPending }) => {
  const borderColor = product.currentStock === 0 ? 'border-red-500 bg-red-50' : 'border-amber-500 bg-amber-50';
  const textColor = product.currentStock === 0 ? 'text-red-600' : 'text-amber-600';

  const handleRestock = useCallback(() => {
    onRestock(product.id, product.minStockLevel * 2);
  }, [product.id, product.minStockLevel, onRestock]);

  const memoizedTags = useMemo(() => {
    if (!product.tags || product.tags.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {product.tags.map(tag => (
          <Badge 
            key={tag} 
            variant="outline" 
            className="cursor-pointer text-xs"
            onClick={() => onTagClick(tag)}
          >
            {tag}
          </Badge>
        ))}
      </div>
    );
  }, [product.tags, onTagClick]);

  return (
    <div className={`border-l-4 ${borderColor} p-3 rounded-r`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium">{product.name}</h3>
          <p className="text-sm text-slate-600">
            Stock: <span className={`font-medium ${textColor}`}>{product.currentStock}</span> (Min: {product.minStockLevel})
          </p>
          <p className="text-xs text-slate-500 mt-1">SKU: {product.sku}</p>
          {memoizedTags}
        </div>
        <Button 
          variant="outline"
          size="sm"
          onClick={handleRestock}
          disabled={isPending}
        >
          Restock
        </Button>
      </div>
    </div>
  );
});

LowStockItem.displayName = "LowStockItem";

const OptimizedInventory = () => {
  const { setCurrentPage } = useSidebar();
  const { toast } = useToast();
  const [searchText, setSearchText] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("all_tags");
  const [highlightedProductId, setHighlightedProductId] = useState<number | null>(null);
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);
  
  useEffect(() => {
    setCurrentPage("Inventory");
  }, [setCurrentPage]);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });
  
  // Memoized unique tags calculation
  const allTags = useMemo(() => {
    if (!products) return [];
    const tagSet = new Set<string>();
    products.forEach(product => {
      if (product.tags && product.tags.length > 0) {
        product.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [products]);
  
  // Memoized statistics calculations
  const statistics = useMemo(() => {
    if (!products) return { total: 0, inStock: 0, lowStock: 0, outOfStock: 0 };
    
    return {
      total: products.length,
      inStock: products.filter(p => p.currentStock > p.minStockLevel).length,
      lowStock: products.filter(p => p.currentStock > 0 && p.currentStock <= p.minStockLevel).length,
      outOfStock: products.filter(p => p.currentStock === 0).length
    };
  }, [products]);

  // Memoized low stock products
  const lowStockProducts = useMemo(() => {
    return products?.filter(product => product.currentStock <= product.minStockLevel) || [];
  }, [products]);

  // Memoized filtered products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    return products.filter(product => {
      const matchesSearch = searchText.trim() === "" || 
        product.name.toLowerCase().includes(searchText.toLowerCase()) || 
        product.sku.toLowerCase().includes(searchText.toLowerCase()) ||
        (product.location && product.location.toLowerCase().includes(searchText.toLowerCase()));
      
      const matchesTag = tagFilter === "all_tags" || 
        (product.tags && product.tags.some(tag => tag === tagFilter));
      
      return matchesSearch && matchesTag;
    });
  }, [products, searchText, tagFilter]);

  // Stable event handlers using useCallback
  const handleBarcodeScanned = useCallback((barcode: string) => {
    setSearchText(barcode);
    
    const foundProduct = products?.find(p => p.sku === barcode);
    if (foundProduct) {
      setHighlightedProductId(foundProduct.id);
      toast({
        title: "Product Found",
        description: `Found ${foundProduct.name} (SKU: ${foundProduct.sku})`,
      });
      
      setTimeout(() => {
        highlightedRowRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 100);
    } else {
      toast({
        title: "Product Not Found",
        description: `No product found with barcode/SKU: ${barcode}`,
        variant: "destructive",
      });
    }
  }, [products, toast]);

  const handleTagClick = useCallback((tag: string) => {
    setTagFilter(tag);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchText("");
  }, []);

  const handleClearTagFilter = useCallback(() => {
    setTagFilter("all_tags");
  }, []);

  const updateStockMutation = useMutation({
    mutationFn: async ({ id, stock }: { id: number; stock: number }) => {
      return apiRequest(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStock: stock })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Stock updated",
        description: "Inventory has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update stock",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleStockChange = useCallback((id: number, currentStock: number) => {
    updateStockMutation.mutate({ id, stock: currentStock });
  }, [updateStockMutation]);

  return (
    <div>
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="fas fa-box"
          title="Total Products"
          value={statistics.total}
          bgColor="bg-blue-100"
          iconColor="text-primary"
        />
        <StatCard
          icon="fas fa-check-circle"
          title="In Stock"
          value={statistics.inStock}
          bgColor="bg-green-100"
          iconColor="text-green-500"
        />
        <StatCard
          icon="fas fa-exclamation-circle"
          title="Low Stock"
          value={statistics.lowStock}
          bgColor="bg-amber-100"
          iconColor="text-amber-500"
        />
        <StatCard
          icon="fas fa-times-circle"
          title="Out of Stock"
          value={statistics.outOfStock}
          bgColor="bg-red-100"
          iconColor="text-red-500"
        />
      </div>

      {/* Low Stock Alert */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-lg">Low Stock Alert</h2>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="py-4 text-center">
              <span className="text-slate-500">Loading inventory data...</span>
            </div>
          ) : lowStockProducts.length === 0 ? (
            <div className="py-4 text-center">
              <i className="fas fa-check-circle text-green-500 text-3xl mb-2"></i>
              <p className="text-green-600">No low stock items. All inventory levels are healthy.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lowStockProducts.map(product => (
                <LowStockItem
                  key={product.id}
                  product={product}
                  onTagClick={handleTagClick}
                  onRestock={handleStockChange}
                  isPending={updateStockMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inventory Management */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-lg">Inventory Management</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                type="text"
                placeholder="Search products or SKU..."
                className="pl-8 w-[250px]"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-900"
                >
                  <i className="fas fa-times-circle"></i>
                </button>
              )}
            </div>
            {allTags.length > 0 && (
              <div className="flex items-center">
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="w-[150px]">
                    <div className="flex items-center">
                      <Tag className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filter by tag" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_tags">All Tags</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tagFilter !== "all_tags" && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-1" 
                    onClick={handleClearTagFilter}
                  >
                    <i className="fas fa-times-circle"></i>
                  </Button>
                )}
              </div>
            )}
            <BarcodeScanner
              onBarcodeScanned={handleBarcodeScanned}
              buttonText="Scan"
              buttonSize="sm"
              buttonVariant="outline"
              modalTitle="Scan Product Barcode"
            />
          </div>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Min Stock</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading inventory data...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No products found matching your search criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map(product => (
                    <OptimizedProductRow
                      key={product.id}
                      product={product}
                      isHighlighted={highlightedProductId === product.id}
                      highlightedRowRef={highlightedProductId === product.id ? highlightedRowRef : undefined}
                      onStockChange={handleStockChange}
                      onTagClick={handleTagClick}
                      isPending={updateStockMutation.isPending}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizedInventory;