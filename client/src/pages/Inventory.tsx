import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BarcodeScanner } from "@/components/barcode";

import {
  Table,
  TableBody,
  TableCell,
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
  // category field removed as part of simplification
  description?: string;
  minStockLevel: number;
  currentStock: number;
  location?: string;
  tags?: string[];
}

const Inventory = () => {
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
  
  // Memoized filtered products calculation
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

  // Memoized low stock products
  const lowStockProducts = useMemo(() => {
    return products?.filter(product => product.currentStock <= product.minStockLevel) || [];
  }, [products]);

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

  const handleTagClick = useCallback((tag: string) => {
    setTagFilter(tag);
  }, []);

  const getStockStatusClass = (currentStock: number, minStockLevel: number) => {
    if (currentStock === 0) return "text-red-600";
    if (currentStock <= minStockLevel) return "text-amber-600";
    return "text-green-600";
  };

  const getStockStatus = (currentStock: number, minStockLevel: number) => {
    if (currentStock === 0) return "Out of Stock";
    if (currentStock <= minStockLevel) return "Low Stock";
    return "In Stock";
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 flex items-center">
          <div className="rounded-full bg-blue-100 p-3 mr-4">
            <i className="fas fa-box text-primary text-xl"></i>
          </div>
          <div>
            <h3 className="text-sm text-slate-500 font-medium">Total Products</h3>
            <p className="text-2xl font-semibold">{statistics.total}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex items-center">
          <div className="rounded-full bg-green-100 p-3 mr-4">
            <i className="fas fa-check-circle text-green-500 text-xl"></i>
          </div>
          <div>
            <h3 className="text-sm text-slate-500 font-medium">In Stock</h3>
            <p className="text-2xl font-semibold">{statistics.inStock}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex items-center">
          <div className="rounded-full bg-amber-100 p-3 mr-4">
            <i className="fas fa-exclamation-circle text-amber-500 text-xl"></i>
          </div>
          <div>
            <h3 className="text-sm text-slate-500 font-medium">Low Stock</h3>
            <p className="text-2xl font-semibold">{statistics.lowStock}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex items-center">
          <div className="rounded-full bg-red-100 p-3 mr-4">
            <i className="fas fa-times-circle text-red-500 text-xl"></i>
          </div>
          <div>
            <h3 className="text-sm text-slate-500 font-medium">Out of Stock</h3>
            <p className="text-2xl font-semibold">{statistics.outOfStock}</p>
          </div>
        </div>
      </div>

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
              {lowStockProducts.map((product) => {
                const borderColor = product.currentStock === 0 ? 'border-red-500 bg-red-50' : 'border-amber-500 bg-amber-50';
                const textColor = product.currentStock === 0 ? 'text-red-600' : 'text-amber-600';

                return (
                  <div key={product.id} className={`border-l-4 ${borderColor} p-3 rounded-r`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{product.name}</h3>
                        <p className="text-sm text-slate-600">
                          Stock: <span className={`font-medium ${textColor}`}>{product.currentStock}</span> (Min: {product.minStockLevel})
                        </p>
                        <p className="text-xs text-slate-500 mt-1">SKU: {product.sku}</p>
                        {product.tags && product.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {product.tags.map((tag: string) => (
                              <Badge 
                                key={tag} 
                                variant="outline" 
                                className="cursor-pointer text-xs"
                                onClick={() => handleTagClick(tag)}
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => handleStockChange(product.id, product.minStockLevel * 2)}
                        disabled={updateStockMutation.isPending}
                      >
                        Restock
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
                  onClick={() => setSearchText("")}
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
                    onClick={() => setTagFilter("all_tags")}
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
                ) : filteredProducts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No products found matching your search criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts?.map(product => {
                    const isHighlighted = highlightedProductId === product.id;
                    return (
                    <TableRow 
                      key={product.id} 
                      ref={isHighlighted ? highlightedRowRef : undefined}
                      className={isHighlighted ? 'bg-blue-50 animate-pulse' : ''}
                    >
                      <TableCell>
                        <div>
                          <div>{product.name}</div>
                          {product.tags && product.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {product.tags.map((tag: string) => (
                                <Badge 
                                  key={tag} 
                                  variant="outline" 
                                  className="cursor-pointer"
                                  onClick={() => handleTagClick(tag)}
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>{product.location || "-"}</TableCell>
                      <TableCell>{product.minStockLevel}</TableCell>
                      <TableCell>
                        <span className={`font-medium ${getStockStatusClass(product.currentStock, product.minStockLevel)}`}>
                          {product.currentStock}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.currentStock === 0 ? 'bg-red-100 text-red-800' :
                          product.currentStock <= product.minStockLevel ? 'bg-amber-100 text-amber-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {getStockStatus(product.currentStock, product.minStockLevel)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            min="0" 
                            className="w-20" 
                            defaultValue={product.currentStock}
                            onBlur={(e) => {
                              const newValue = parseInt(e.target.value);
                              if (newValue !== product.currentStock) {
                                handleStockChange(product.id, newValue);
                              }
                            }}
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleStockChange(product.id, product.currentStock + 10)}
                          >
                            +10
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
