import React, { useEffect, useState } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { BarcodeGenerator } from "@/components/barcode";
import { InventoryChangeHistory } from "@/components/inventory/InventoryChangeHistory";
import { 
  MapPin, 
  Package, 
  Info, 
  Edit, 
  Trash2, 
  Eye, 
  Box, 
  Layers,
  Upload,
  Image,
  X,
  Plus,
  Tag,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  LayoutGrid,
  Table,
  List
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  // category field removed as part of simplification
  description?: string;
  minStockLevel: number;
  currentStock: number;
  location?: string;
  unitsPerBox?: number;
  imagePath?: string;
  tags?: string[];
}

// Simplified form schema without categories
const productFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  sku: z.string().min(1, { message: "SKU is required" }),
  barcode: z.string().optional(),
  description: z.string().optional(),
  minStockLevel: z.coerce.number().min(0, { message: "Minimum stock level must be 0 or greater" }),
  currentStock: z.coerce.number().min(0, { message: "Current stock must be 0 or greater" }),
  location: z.string().optional(),
  unitsPerBox: z.coerce.number().min(0).optional(),
  imagePath: z.string().optional(),
  tags: z.array(z.string()).optional().default([])
});

type ProductFormValues = z.infer<typeof productFormSchema>;

const Products = () => {
  const { setCurrentPage } = useSidebar();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  // Category filter removed as part of simplification
  const [stockFilter, setStockFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all_tags");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // State for product details view
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("info");

  // State for view mode
  const [viewMode, setViewMode] = useState<"grid" | "table" | "list">("grid");

  // State to track file uploads
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage("Products");
    
    // Check URL parameters for filters
    const params = new URLSearchParams(window.location.search);
    const stockParam = params.get("stock");
    if (stockParam && ["in", "low", "out"].includes(stockParam)) {
      setStockFilter(stockParam);
    }
  }, [setCurrentPage]);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      minStockLevel: 10,
      currentStock: 0,
      barcode: "",
      location: "",
      unitsPerBox: 0,
      imagePath: "",
      tags: []
    }
  });

  useEffect(() => {
    if (editingProduct) {
      form.reset({
        name: editingProduct.name,
        sku: editingProduct.sku,
        barcode: editingProduct.barcode || "",
        description: editingProduct.description || "",
        minStockLevel: editingProduct.minStockLevel,
        currentStock: editingProduct.currentStock,
        location: editingProduct.location || "",
        unitsPerBox: editingProduct.unitsPerBox || 0,
        imagePath: editingProduct.imagePath || "",
        tags: editingProduct.tags || []
      });
    } else {
      form.reset({
        name: "",
        sku: "",
        barcode: "",
        description: "",
        minStockLevel: 10,
        currentStock: 0,
        location: "",
        unitsPerBox: 0,
        imagePath: "",
        tags: []
      });
    }
  }, [editingProduct, form]);

  const createProductMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      // Ensure tags is always an array to prevent "value.map is not a function" error
      const productData = {
        ...values,
        tags: Array.isArray(values.tags) ? values.tags : []
      };
      
      // If there's an image file, use FormData to handle multipart/form-data
      if (imageFile) {
        const formData = new FormData();
        
        // Add file to formData
        formData.append('image', imageFile);
        
        // Add other form values
        Object.entries(productData).forEach(([key, value]) => {
          if (key !== 'imagePath' && value !== undefined && value !== null) {
            if (key === 'tags') {
              // Handle arrays specially
              if (Array.isArray(value)) {
                if (value.length === 0) {
                  formData.append('tags', '[]');
                } else {
                  // Send each tag as a separate item in the FormData
                  value.forEach(tag => {
                    formData.append('tags[]', tag);
                  });
                  
                  // Also include JSON as fallback
                  formData.append('tagsJson', JSON.stringify(value));
                }
              } else {
                formData.append('tags', '[]');
              }
            } else {
              formData.append(key, value.toString());
            }
          }
        });
        
        // Use fetch directly as apiRequest doesn't support FormData
        const response = await fetch('/api/products', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create product');
        }
        
        return await response.json();
      } else {
        // No file upload, use regular API request
        return apiRequest({
          url: '/api/products', 
          method: 'POST', 
          body: JSON.stringify(productData),
          headers: { 'Content-Type': 'application/json' }
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Product created",
        description: "The product has been created successfully.",
      });
      setIsDialogOpen(false);
      // Clear the file state and preview only after successful creation
      setImageFile(null);
      setImagePreview(null);
      // Clear form only after successful save
      form.reset({
        name: "",
        sku: "",
        barcode: "",
        description: "",
        minStockLevel: 10,
        currentStock: 0,
        location: "",
        unitsPerBox: 0,
        imagePath: "",
        tags: []
      });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to create product",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: ProductFormValues }) => {
      // Ensure tags is always an array to prevent "value.map is not a function" error
      const productData = {
        ...values,
        tags: Array.isArray(values.tags) ? values.tags : []
      };
      
      // If there's an image file, use FormData to handle multipart/form-data
      if (imageFile) {
        const formData = new FormData();
        
        // Add file to formData
        formData.append('image', imageFile);
        
        // Add other form values
        Object.entries(productData).forEach(([key, value]) => {
          if (key !== 'imagePath' && value !== undefined && value !== null) {
            if (key === 'tags') {
              // Handle arrays specially
              if (Array.isArray(value)) {
                if (value.length === 0) {
                  formData.append('tags', '[]');
                } else {
                  // Send each tag as a separate item in the FormData
                  value.forEach(tag => {
                    formData.append('tags[]', tag);
                  });
                  
                  // Also include JSON as fallback
                  formData.append('tagsJson', JSON.stringify(value));
                }
              } else {
                formData.append('tags', '[]');
              }
            } else {
              formData.append(key, value.toString());
            }
          }
        });
        
        // Use fetch directly as apiRequest doesn't support FormData
        const response = await fetch(`/api/products/${id}`, {
          method: 'PATCH',
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update product');
        }
        
        return await response.json();
      } else {
        // No file upload, use regular API request
        return apiRequest({
          url: `/api/products/${id}`,
          method: 'PATCH',
          body: JSON.stringify(productData),
          headers: { 'Content-Type': 'application/json' }
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Product updated",
        description: "The product has been updated successfully.",
      });
      setIsDialogOpen(false);
      // Only reset these values after a successful update
      setEditingProduct(null);
      setImageFile(null);
      setImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to update product",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest({
        url: `/api/products/${id}`,
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: "Product deleted",
        description: "The product has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete product",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (values: ProductFormValues) => {
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, values });
    } else {
      createProductMutation.mutate(values);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleDeleteProduct = (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProductMutation.mutate(id);
      
      // Close details dialog if deleting the product being viewed
      if (viewingProduct && viewingProduct.id === id) {
        setIsDetailsDialogOpen(false);
      }
    }
  };
  
  const handleViewProduct = (product: Product) => {
    setViewingProduct(product);
    setIsDetailsDialogOpen(true);
    setSelectedTab("info");
  };

  // Get all unique tags across all products
  const allTags = React.useMemo(() => {
    if (!products) return [];
    const tagSet = new Set<string>();
    products.forEach(product => {
      if (product.tags && product.tags.length > 0) {
        product.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [products]);

  const filteredProducts = products?.filter(product => {
    const matchesSearch = searchTerm === "" || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Category filter removed as part of simplification
    
    let matchesStock = true;
    if (stockFilter !== "all") {
      if (stockFilter === "low") {
        matchesStock = product.currentStock > 0 && product.currentStock <= product.minStockLevel;
      } else if (stockFilter === "out") {
        matchesStock = product.currentStock === 0;
      } else if (stockFilter === "in") {
        matchesStock = product.currentStock > product.minStockLevel;
      }
    }

    // Tag filter
    const matchesTag = tagFilter === "all_tags" || 
      (product.tags && product.tags.some(tag => tag.toLowerCase().includes(tagFilter.toLowerCase())));
    
    return matchesSearch && matchesStock && matchesTag;
  });

  const getStockStatusClass = (currentStock: number, minStockLevel: number) => {
    if (currentStock === 0) return "text-red-600";
    if (currentStock <= minStockLevel) return "text-amber-600";
    return "text-green-600";
  };

  return (
    <div>
      {/* Shopify-like header */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h1 className="font-semibold text-2xl">{t('products.title')}</h1>
            <p className="text-slate-500 mt-1">{t('products.manage')}</p>
          </div>
          <div className="flex gap-2">
            {/* Categories management button removed as part of simplification */}
            <Button 
              onClick={() => {
                setEditingProduct(null);
                setIsDialogOpen(true);
              }}
              className="bg-green-600 hover:bg-green-700 py-2 px-4 h-auto"
            >
              <Plus className="mr-2 h-4 w-4" /> {t('products.addProduct')}
            </Button>
          </div>
        </div>

        {/* Search and filters - Shopify-style */}
        <div className="p-5 bg-slate-50 border-b border-slate-200">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex flex-col md:flex-row gap-3 flex-1">
              <div className="relative w-full md:w-64 flex-grow">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <i className="fas fa-search text-slate-400"></i>
                </span>
                <Input
                  placeholder={t('products.searchProducts')}
                  className="pl-10 h-10 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                {/* Category filter dropdown removed as part of simplification */}
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-full md:w-48 h-10 bg-white">
                    <SelectValue placeholder={t('products.filterByStock')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('products.stockFilterAll')}</SelectItem>
                    <SelectItem value="in">{t('products.stockFilterIn')}</SelectItem>
                    <SelectItem value="low">{t('products.stockFilterLow')}</SelectItem>
                    <SelectItem value="out">{t('products.stockFilterOut')}</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Tag Filter */}
                {allTags.length > 0 && (
                  <Select 
                    value={tagFilter || "all_tags"} 
                    onValueChange={(value) => setTagFilter(value)}
                  >
                    <SelectTrigger className="w-full md:w-48 h-10 bg-white">
                      <SelectValue placeholder={t('products.filterByTag')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_tags">{t('products.tagFilterAll')}</SelectItem>
                      {allTags.map(tag => (
                        <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            
            {/* View toggle */}
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 bg-white">
                    {viewMode === "grid" && <LayoutGrid className="mr-2 h-4 w-4" />}
                    {viewMode === "table" && <Table className="mr-2 h-4 w-4" />}
                    {viewMode === "list" && <List className="mr-2 h-4 w-4" />}
                    <span>
                      {viewMode === "grid" && t('products.gridView')}
                      {viewMode === "table" && t('products.tableView')}
                      {viewMode === "list" && t('products.listView')}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setViewMode("grid")}>
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    <span>{t('products.gridView')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode("table")}>
                    <Table className="mr-2 h-4 w-4" />
                    <span>{t('products.tableView')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode("list")}>
                    <List className="mr-2 h-4 w-4" />
                    <span>{t('products.listView')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Products grid (Shopify style) */}
        <div className="p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center">
                <i className="fas fa-spinner fa-spin text-2xl text-slate-400 mb-2"></i>
                <p className="text-slate-600">{t('products.loading')}</p>
              </div>
            </div>
          ) : filteredProducts?.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center">
                <Package size={48} className="mx-auto text-slate-300 mb-3" />
                <h3 className="text-lg font-medium mb-1">{t('products.noProductsFound')}</h3>
                <p className="text-slate-500">
                  {searchTerm || stockFilter !== "all" || tagFilter !== "all_tags" 
                    ? t('products.tryClearingFilters') 
                    : t('products.getStartedCreating')}
                </p>
                {(searchTerm || stockFilter !== "all" || tagFilter !== "all_tags") && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      setSearchTerm("");
                      setStockFilter("all");
                      setTagFilter("all_tags");
                    }}
                  >
                    {t('products.clearAllFilters')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Product display section */}
              {viewMode === "grid" ? (
                // Grid View
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts && filteredProducts.map((product) => (
                    <div 
                      key={product.id} 
                      className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer group"
                      onClick={() => handleViewProduct(product)}
                    >
                      <div className="aspect-[3/2] bg-slate-50 relative flex items-center justify-center overflow-hidden">
                        {product.imagePath ? (
                          <img 
                            src={product.imagePath.startsWith('http') ? 
                                product.imagePath : 
                                product.imagePath.startsWith('/') ?
                                product.imagePath :
                                `/${product.imagePath}`}
                            alt={product.name}
                            className="w-4/5 h-4/5 object-contain transform group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-image.svg';
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-300 w-full h-full">
                            <Package size={48} />
                            <span className="mt-2 text-sm text-slate-400">{t('products.noImage')}</span>
                          </div>
                        )}
                        
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button 
                            className="p-2 bg-white rounded-full shadow hover:shadow-md mb-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditProduct(product);
                            }}
                            title={t('products.editProduct')}
                          >
                            <Edit size={14} className="text-slate-600" />
                          </button>
                        </div>
                        
                        <div className="absolute top-2 left-2">
                          <span className={`text-sm px-2 py-1 rounded-full font-medium ${
                            product.currentStock === 0 
                              ? 'bg-red-100 text-red-700 border border-red-200' 
                              : product.currentStock <= product.minStockLevel
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-green-100 text-green-700 border border-green-200'
                          }`}>
                            {product.currentStock === 0 
                              ? t('inventory.outOfStock')
                              : product.currentStock <= product.minStockLevel
                                ? t('inventory.lowStock')
                                : t('inventory.inStock')
                            }
                          </span>
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <h3 className="font-medium text-lg text-slate-900 truncate mb-1">{product.name}</h3>
                        <p className="text-sm text-slate-500 mb-3">{t('products.columns.sku')}: {product.sku}</p>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-slate-50 rounded-md p-2 flex flex-col items-center">
                            <span className="text-xs text-slate-500 mb-1">{t('products.columns.currentStock')}</span>
                            <span className={`font-semibold ${
                              product.currentStock === 0 
                                ? 'text-red-600' 
                                : product.currentStock <= product.minStockLevel
                                  ? 'text-amber-600'
                                  : 'text-green-600'
                            }`}>
                              {product.currentStock}
                            </span>
                          </div>
                          
                          <div className="bg-slate-50 rounded-md p-2 flex flex-col items-center">
                            <span className="text-xs text-slate-500 mb-1">{t('products.columns.unitsPerBox')}</span>
                            <span className="font-semibold text-slate-700">{product.unitsPerBox || '-'}</span>
                          </div>
                        </div>
                        
                        {product.location && (
                          <div className="flex items-center mb-3 text-sm">
                            <MapPin className="h-4 w-4 text-slate-400 mr-1 flex-shrink-0" />
                            <span className="text-slate-600 truncate">{product.location}</span>
                          </div>
                        )}
                        
                        <div className="pt-3 border-t border-slate-100">
                          <div className="flex flex-wrap gap-1 mb-1">
                            {product.tags && product.tags.length > 0 ? (
                              <>
                                <Tag className="h-3 w-3 text-slate-400 mr-1" />
                                {product.tags.slice(0, 2).map((tag, index) => (
                                  <Badge key={index} variant="outline" className="text-xs bg-slate-50">
                                    {tag}
                                  </Badge>
                                ))}
                                {product.tags.length > 2 && (
                                  <span className="text-xs text-slate-500">+{product.tags.length - 2}</span>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-slate-400 flex items-center">
                                <Tag className="h-3 w-3 mr-1" />
                                {t('products.noTags')}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex justify-end mt-2">
                            {user?.role === 'admin' && (
                              <button 
                                className="text-red-500 hover:text-red-600 text-xs flex items-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProduct(product.id);
                                }}
                                title={t('products.deleteProduct')}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                {t('common.delete')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : viewMode === "table" ? (
                // Table View
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-semibold">{t('products.columns.product')}</th>
                        <th className="text-left py-3 px-4 font-semibold">{t('products.columns.sku')}</th>
                        <th className="text-center py-3 px-4 font-semibold">{t('products.columns.stock')}</th>
                        <th className="text-center py-3 px-4 font-semibold">{t('products.columns.unitsPerBox')}</th>
                        <th className="text-left py-3 px-4 font-semibold">{t('products.columns.location')}</th>
                        <th className="text-right py-3 px-4 font-semibold">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredProducts && filteredProducts.map((product) => (
                        <tr 
                          key={product.id} 
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => handleViewProduct(product)}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-slate-100 border border-slate-200">
                                {product.imagePath ? (
                                  <img 
                                    src={product.imagePath.startsWith('http') ? 
                                        product.imagePath : 
                                        product.imagePath.startsWith('/') ?
                                        product.imagePath :
                                        `/${product.imagePath}`}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = '/placeholder-image.svg';
                                    }}
                                  />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-slate-300">
                                    <Package size={20} />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-800 truncate max-w-[200px]">{product.name}</p>
                                {product.tags && product.tags.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Tag className="h-3 w-3 text-slate-400" />
                                    {product.tags.slice(0, 1).map((tag, index) => (
                                      <Badge key={index} variant="outline" className="text-xs px-1.5 py-0 bg-slate-50 border-slate-200">
                                        {tag}
                                      </Badge>
                                    ))}
                                    {product.tags.length > 1 && (
                                      <span className="text-xs text-slate-500">+{product.tags.length - 1}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-slate-700 font-mono text-sm">{product.sku}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`inline-flex items-center justify-center font-medium px-3 py-1 rounded-full text-sm ${
                                product.currentStock === 0 
                                  ? 'bg-red-100 text-red-700 border border-red-200' 
                                  : product.currentStock <= product.minStockLevel
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                    : 'bg-green-100 text-green-700 border border-green-200'
                              }`}>
                                {product.currentStock}
                              </span>
                              <span className="text-xs text-slate-500 mt-1">
                                {product.currentStock === 0 
                                  ? t('inventory.outOfStock')
                                  : product.currentStock <= product.minStockLevel
                                    ? t('inventory.lowStock')
                                    : t('inventory.inStock')
                                }
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center text-slate-700 font-medium">{product.unitsPerBox || '-'}</td>
                          <td className="py-4 px-4">
                            {product.location ? (
                              <div className="flex items-center text-slate-700">
                                <MapPin size={14} className="mr-1 text-slate-400 flex-shrink-0" />
                                <span className="truncate max-w-[150px]">{product.location}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm italic">{t('products.noLocation')}</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditProduct(product);
                                }}
                                title={t('products.editProduct')}
                              >
                                <Edit size={14} className="text-slate-600" />
                              </Button>
                              
                              {user?.role === 'admin' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteProduct(product.id);
                                  }}
                                  title={t('products.deleteProduct')}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                // List View
                <div className="space-y-4">
                  {filteredProducts && filteredProducts.map((product) => (
                    <div 
                      key={product.id} 
                      className="bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow transition-all duration-200 cursor-pointer group overflow-hidden"
                      onClick={() => handleViewProduct(product)}
                    >
                      <div className="p-5 flex flex-col md:flex-row gap-5">
                        {/* Product image */}
                        <div className="w-full md:w-28 md:h-28 aspect-square flex-shrink-0 rounded-lg overflow-hidden bg-slate-50 border border-slate-100 relative">
                          {product.imagePath ? (
                            <img 
                              src={product.imagePath.startsWith('http') ? 
                                  product.imagePath : 
                                  product.imagePath.startsWith('/') ?
                                  product.imagePath :
                                  `/${product.imagePath}`}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder-image.svg';
                              }}
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-slate-300">
                              <Package size={32} />
                            </div>
                          )}
                          
                          <div className="absolute top-2 left-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              product.currentStock === 0 
                                ? 'bg-red-100 text-red-700 border border-red-200' 
                                : product.currentStock <= product.minStockLevel
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-green-100 text-green-700 border border-green-200'
                            }`}>
                              {product.currentStock === 0 
                                ? t('inventory.outOfStock')
                                : product.currentStock <= product.minStockLevel
                                  ? t('inventory.lowStock')
                                  : t('inventory.inStock')
                              }
                            </span>
                          </div>
                        </div>
                        
                        {/* Product details - main section */}
                        <div className="flex-grow flex flex-col gap-3">
                          <div>
                            <div className="flex justify-between items-start">
                              <h3 className="font-medium text-xl text-slate-900 group-hover:text-primary transition-colors duration-200">
                                {product.name}
                              </h3>
                              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditProduct(product);
                                  }}
                                  title={t('products.editProduct')}
                                >
                                  <Edit size={14} className="text-slate-600" />
                                </Button>
                                
                                {user?.role === 'admin' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteProduct(product.id);
                                    }}
                                    title={t('products.deleteProduct')}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center flex-wrap gap-3 mt-1.5">
                              <div className="flex items-center text-sm text-slate-500">
                                <Box className="h-3.5 w-3.5 mr-1 text-slate-400" />
                                <span className="font-mono">{product.sku}</span>
                              </div>
                              
                              {product.location && (
                                <div className="flex items-center text-sm text-slate-500">
                                  <MapPin className="h-3.5 w-3.5 mr-1 text-slate-400" />
                                  <span>{product.location}</span>
                                </div>
                              )}
                              
                              {product.barcode && (
                                <div className="flex items-center text-sm text-slate-500">
                                  <BarcodeGenerator value={product.barcode} width={12} height={12} className="mr-1" />
                                  <span className="font-mono text-xs">{product.barcode}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Tags */}
                          {product.tags && product.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              <Tag className="h-3.5 w-3.5 text-slate-400 mr-0.5" />
                              {product.tags.map((tag, index) => (
                                <Badge 
                                  key={index} 
                                  variant="outline" 
                                  className="text-xs bg-slate-50 border-slate-200"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Right side stats */}
                        <div className="flex flex-row md:flex-col items-center gap-4 md:w-[120px] md:border-l md:border-slate-100 md:pl-4">
                          <div className="bg-slate-50 rounded-lg p-3 w-full text-center">
                            <div className="text-xs text-slate-500 mb-1">{t('products.columns.currentStock')}</div>
                            <div className={`font-bold text-xl ${
                              product.currentStock === 0 
                                ? 'text-red-600' 
                                : product.currentStock <= product.minStockLevel
                                  ? 'text-amber-600'
                                  : 'text-green-600'
                            }`}>
                              {product.currentStock}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">{t('common.units')}</div>
                          </div>
                          
                          <div className="flex flex-col items-center text-center">
                            <div className="text-xs text-slate-500 mb-1">{t('products.columns.unitsPerBox')}</div>
                            <div className="font-medium text-slate-700">
                              {product.unitsPerBox || '-'}
                            </div>
                          </div>
                          
                          {/* minStockLevel section removed as it was replaced by unitsPerBox */}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Pagination */}
              <div className="mt-6 border-t border-slate-200 pt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                  <span className="text-sm text-slate-600">
                    {t('products.showingProducts', { showing: filteredProducts ? filteredProducts.length : 0, total: products?.length || 0 })}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-9"
                    disabled={true}
                  >
                    <ChevronDown className="h-4 w-4 mr-1 rotate-90" />
                    {t('common.previous')}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9" 
                    disabled={true}
                  >
                    {t('common.next')}
                    <ChevronDown className="h-4 w-4 ml-1 -rotate-90" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Product Dialog */}
      <Dialog 
        open={isDialogOpen} 
        onOpenChange={(open) => {
          // Only update dialog state, don't reset form values
          setIsDialogOpen(open);
          
          // Only clear image preview and file if dialog is closed without saving
          // and it's a new product (not editing an existing one)
          if (!open && !editingProduct) {
            setImageFile(null);
            setImagePreview(null);
          }
        }}>
        <DialogContent className="sm:max-w-[720px] p-0 overflow-hidden">
          <div className="flex h-full">
            {/* Left sidebar with image upload */}
            <div className="w-1/3 bg-slate-50 p-6 border-r border-slate-200">
              <div className="sticky top-0">
                <h3 className="font-medium text-lg mb-4">Product Image</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Upload a high-quality image that clearly shows your product. Images help customers make purchase decisions.
                </p>
                
                <Form {...form}>
                  <FormField
                    control={form.control}
                    name="imagePath"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <div className="flex flex-col items-center justify-center">
                          {/* Image Preview */}
                          <div className="w-full flex justify-center mb-3">
                            {imagePreview ? (
                              <div className="relative w-full h-40 border rounded-md overflow-hidden">
                                <img 
                                  src={imagePreview} 
                                  alt="Product preview" 
                                  className="w-full h-full object-contain"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setImageFile(null);
                                    setImagePreview(null);
                                    field.onChange("");
                                  }}
                                  className="absolute top-1 right-1 bg-white p-1 rounded-full shadow-md"
                                  title="Remove Image"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (imageFile || editingProduct?.imagePath) && !imagePreview ? (
                              <div className="relative w-full h-40 border rounded-md overflow-hidden">
                                <img 
                                  src={
                                    imageFile 
                                      ? URL.createObjectURL(imageFile) 
                                      : editingProduct?.imagePath
                                        ? (editingProduct.imagePath.startsWith('http') 
                                          ? editingProduct.imagePath 
                                          : editingProduct.imagePath.startsWith('/') 
                                            ? editingProduct.imagePath
                                            : `/${editingProduct.imagePath}`)
                                        : ''
                                  }
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/placeholder-image.svg';
                                  }}
                                  alt="Product preview" 
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setImageFile(null);
                                    field.onChange("");
                                  }}
                                  className="absolute top-1 right-1 bg-white p-1 rounded-full shadow-md"
                                  title="Remove Image"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : null}
                            {!imageFile && !imagePreview && !editingProduct?.imagePath && (
                              <div className="w-full h-40 border-2 border-dashed rounded-md flex flex-col items-center justify-center text-gray-400">
                                <Image size={40} />
                                <span className="mt-2 text-sm">No image</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Upload Button */}
                          <label htmlFor="product-image" className="cursor-pointer w-full">
                            <div className="flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-md w-full">
                              <Upload size={16} />
                              <span>{(imageFile || editingProduct?.imagePath) ? "Change Image" : "Upload Image"}</span>
                            </div>
                            <input 
                              id="product-image"
                              type="file" 
                              accept="image/*"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  const file = e.target.files[0];
                                  
                                  // Check file size (max 2MB)
                                  const maxSizeInBytes = 2 * 1024 * 1024; // 2MB
                                  if (file.size > maxSizeInBytes) {
                                    toast({
                                      title: "Image too large",
                                      description: "Maximum file size is 2MB",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  
                                  // Clear the input file first to prevent duplicate images
                                  setImagePreview(null);
                                  setImageFile(null);
                                  
                                  // Skip dimension checking as it's causing errors in some environments
                                  try {
                                    // Simply set the image file and create preview
                                    setImageFile(file);
                                    
                                    // Create a preview
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setImagePreview(reader.result as string);
                                      // Make sure to set the field value to the filename string
                                      field.onChange(file.name || "");
                                    };
                                    reader.onerror = () => {
                                      toast({
                                        title: "Invalid image",
                                        description: "The selected file could not be loaded as an image",
                                        variant: "destructive",
                                      });
                                      setImageFile(null);
                                      setImagePreview(null);
                                      field.onChange("");
                                    };
                                    reader.readAsDataURL(file);
                                  } catch (error) {
                                    console.error("Error processing image:", error);
                                    toast({
                                      title: "Invalid image",
                                      description: "The selected file could not be processed",
                                      variant: "destructive",
                                    });
                                    setImageFile(null);
                                    setImagePreview(null);
                                    field.onChange("");
                                  }
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          <FormMessage />
                          
                          {/* Image requirements notice */}
                          <div className="mt-3 p-3 bg-slate-50 rounded-md border border-slate-200">
                            <h4 className="text-xs font-medium text-slate-700 mb-1">
                              <Info className="inline-block h-3 w-3 mr-1" /> Image Requirements
                            </h4>
                            <ul className="text-xs text-slate-600 space-y-1 pl-4 list-disc">
                              <li><span className="font-semibold">Size:</span> Max: 2MB</li>
                              <li>
                                <span className="font-semibold">Dimensions:</span> Min: 200x200px, Max: 1200x1200px
                              </li>
                              <li><span className="font-semibold">Format:</span> JPG, PNG, GIF</li>
                            </ul>
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                </Form>
              </div>
            </div>
            
            {/* Main content area */}
            <div className="w-2/3 max-h-[80vh] overflow-y-auto">
              <DialogHeader className="p-6 pb-2">
                <DialogTitle className="text-xl">{editingProduct ? t('products.editProduct') : t('products.addNewProduct')}</DialogTitle>
                <DialogDescription>{t('products.fillProductDetails')}</DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 pt-2 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.productName')}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.columns.sku')}</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              disabled={!!editingProduct && user?.role !== "admin"} 
                            />
                          </FormControl>
                          <FormMessage />
                          {!!editingProduct && user?.role === "admin" && (
                            <FormDescription className="text-amber-500">
                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                              Warning: Changing SKU may affect other systems that reference this product
                            </FormDescription>
                          )}
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Category field removed */}
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('products.description')}</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="barcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.columns.barcode')}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.columns.location')}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder={t('products.locationPlaceholder')} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="minStockLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.columns.minStock')}</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="currentStock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.columns.currentStock')}</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="unitsPerBox"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.columns.unitsPerBox')}</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="w-full">
                    <FormField
                      control={form.control}
                      name="tags"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.columns.tags')}</FormLabel>
                          <FormDescription>
                            {t('products.enterTags')}
                          </FormDescription>
                          <FormControl>
                            <Input 
                              placeholder={t('products.tagsPlaceholder')}
                              value={field.value?.join(', ') || ''}
                              onChange={(e) => {
                                const tagsInput = e.target.value;
                                // Split by comma and trim each tag
                                const tagsArray = tagsInput
                                  .split(',')
                                  .map(tag => tag.trim())
                                  .filter(tag => tag.length > 0);
                                field.onChange(tagsArray);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button 
                      type="submit"
                      disabled={createProductMutation.isPending || updateProductMutation.isPending}
                    >
                      {(createProductMutation.isPending || updateProductMutation.isPending) 
                        ? t('common.saving') 
                        : editingProduct ? t('products.updateProduct') : t('products.addProduct')
                      }
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-auto p-0">
          {viewingProduct && (
            <>
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex-grow">
                  <DialogTitle className="text-2xl font-bold text-slate-900">{viewingProduct.name}</DialogTitle>
                  <DialogDescription className="text-slate-600 flex items-center gap-2 mt-1">
                    <span>{t('products.columns.sku')}: {viewingProduct.sku}</span>
                    {viewingProduct.currentStock <= viewingProduct.minStockLevel && (
                      <Badge variant={viewingProduct.currentStock === 0 ? "destructive" : "outline"} 
                        className={viewingProduct.currentStock === 0 ? "" : "bg-amber-50 text-amber-700 border-amber-200"}>
                        {viewingProduct.currentStock === 0 
                          ? t('inventory.outOfStock')
                          : t('inventory.lowStock')
                        }
                      </Badge>
                    )}
                  </DialogDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsDetailsDialogOpen(false);
                      handleEditProduct(viewingProduct);
                    }}
                    className="flex items-center gap-1"
                  >
                    <Edit className="h-4 w-4" />
                    {t('products.editProduct')}
                  </Button>
                  <Button
                    size="sm" 
                    variant="ghost"
                    onClick={() => setIsDetailsDialogOpen(false)}
                    className="flex items-center gap-1"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <Tabs value={selectedTab} onValueChange={setSelectedTab} className="px-6 pt-4">
                <TabsList className="grid w-full grid-cols-4 rounded-md bg-slate-100">
                  <TabsTrigger value="info" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Info className="mr-2 h-4 w-4" />
                    {t('products.tabs.information')}
                  </TabsTrigger>
                  <TabsTrigger value="tags" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Tag className="mr-2 h-4 w-4" />
                    {t('products.tabs.tags')}
                  </TabsTrigger>
                  <TabsTrigger value="inventory" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Box className="mr-2 h-4 w-4" />
                    {t('products.tabs.inventory')}
                  </TabsTrigger>
                  <TabsTrigger value="inventoryChanges" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2 h-4 w-4"
                    >
                      <path d="M3 3v18h18" />
                      <path d="m19 9-5 5-4-4-3 3" />
                    </svg>
                    {t('inventory.changesTab')}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="info" className="mt-4 pb-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    {viewingProduct.imagePath && (
                      <div className="md:w-1/3">
                        <div className="bg-slate-50 border border-slate-100 rounded-xl overflow-hidden">
                          <div className="relative aspect-square">
                            <img 
                              src={viewingProduct.imagePath.startsWith('http') ? 
                                   viewingProduct.imagePath : 
                                   viewingProduct.imagePath.startsWith('/') ?
                                   viewingProduct.imagePath :
                                   `/${viewingProduct.imagePath}`}
                              alt={viewingProduct.name}
                              className="object-cover w-full h-full"
                              onError={(e) => {
                                console.error("Error loading product detail image:", viewingProduct.imagePath);
                                (e.target as HTMLImageElement).src = '/placeholder-image.svg';
                              }}
                            />
                          </div>
                        </div>
                        
                        {viewingProduct.unitsPerBox !== undefined && viewingProduct.unitsPerBox > 0 && (
                          <div className="mt-4 bg-slate-50 rounded-lg p-4 border border-slate-100">
                            <div className="flex items-center">
                              <Layers className="mr-2 h-5 w-5 text-slate-500" />
                              <div>
                                <h3 className="text-sm font-medium text-slate-700">{t('products.columns.unitsPerBox')}</h3>
                                <p className="text-2xl font-semibold text-slate-900">{viewingProduct.unitsPerBox}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className={viewingProduct.imagePath ? "md:w-2/3" : "w-full"}>
                      <Card className="border-none shadow-none rounded-none">
                        <CardHeader className="p-0 pb-3">
                          <CardTitle className="text-xl text-slate-900 font-semibold">{t('products.productDetails')}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 space-y-6">
                          {/* Product details section */}
                          {viewingProduct.description && (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                              <h3 className="text-sm font-medium text-slate-700 mb-2">{t('products.description')}</h3>
                              <p className="text-slate-700 whitespace-pre-line">{viewingProduct.description}</p>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {viewingProduct.location && (
                              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-start">
                                <MapPin className="mr-3 h-5 w-5 text-slate-400 mt-0.5" />
                                <div>
                                  <h3 className="text-sm font-medium text-slate-700 mb-1">{t('products.columns.location')}</h3>
                                  <p className="text-slate-800">{viewingProduct.location}</p>
                                </div>
                              </div>
                            )}
                            
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                              <h3 className="text-sm font-medium text-slate-700 mb-2">{t('products.columns.tags')}</h3>
                              <div>
                                {viewingProduct.tags && viewingProduct.tags.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {viewingProduct.tags.map((tag, index) => (
                                      <Badge 
                                        key={index} 
                                        variant="outline" 
                                        className="px-3 py-1 text-sm bg-white border-slate-200"
                                      >
                                        <Tag className="h-3 w-3 mr-1 text-slate-500" />
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-slate-500 italic">{t('products.noTags')}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="tags" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('products.productTags')}</CardTitle>
                      <CardDescription>{t('products.viewAndManageTags')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {viewingProduct.tags && viewingProduct.tags.length > 0 ? (
                        <div className="space-y-6">
                          <div className="flex flex-wrap gap-2">
                            {viewingProduct.tags.map((tag, index) => (
                              <Badge 
                                key={index} 
                                variant="outline" 
                                className="px-3 py-1 text-sm bg-slate-50 border border-slate-200"
                              >
                                <span className="flex items-center">
                                  <Tag className="h-3 w-3 mr-1" />
                                  {tag}
                                </span>
                              </Badge>
                            ))}
                          </div>
                          <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                            <h3 className="text-sm font-medium text-slate-700 mb-2">{t('products.aboutTags')}</h3>
                            <p className="text-sm text-slate-600">
                              {t('products.tagsDescription')}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-10">
                          <Tag className="h-12 w-12 text-slate-300 mb-2" />
                          <p className="text-slate-500">{t('products.noTagsAdded')}</p>
                          <Button 
                            className="mt-4"
                            variant="outline"
                            onClick={() => {
                              setIsDetailsDialogOpen(false);
                              handleEditProduct(viewingProduct);
                            }}
                          >
                            <Tag className="h-4 w-4 mr-2" />
                            {t('products.addTags')}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-center border-t pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setIsDetailsDialogOpen(false);
                          handleEditProduct(viewingProduct);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        {t('products.editTags')}
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
                
                <TabsContent value="inventory" className="mt-4 pb-6">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-5 border border-slate-100 rounded-lg flex flex-col items-center justify-center">
                        <h3 className="text-sm font-medium text-slate-500 mb-2">{t('products.columns.currentStock')}</h3>
                        <p className={`text-3xl font-bold ${
                          viewingProduct.currentStock === 0 
                            ? 'text-red-600' 
                            : viewingProduct.currentStock <= viewingProduct.minStockLevel
                              ? 'text-amber-600'
                              : 'text-green-600'
                        }`}>
                          {viewingProduct.currentStock}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">{t('common.units')}</p>
                      </div>
                      
                      <div className="bg-slate-50 p-5 border border-slate-100 rounded-lg flex flex-col items-center justify-center">
                        <h3 className="text-sm font-medium text-slate-500 mb-2">{t('products.columns.minStock')}</h3>
                        <p className="text-3xl font-bold text-slate-700">{viewingProduct.minStockLevel}</p>
                        <p className="text-sm text-slate-500 mt-1">{t('common.units')}</p>
                      </div>
                      
                      {viewingProduct.unitsPerBox && viewingProduct.unitsPerBox > 0 && (
                        <div className="bg-slate-50 p-5 border border-slate-100 rounded-lg flex flex-col items-center justify-center">
                          <h3 className="text-sm font-medium text-slate-500 mb-2">{t('products.boxCount')}</h3>
                          <div className="text-center">
                            <p className="text-3xl font-bold text-slate-700">
                              {Math.floor(viewingProduct.currentStock / viewingProduct.unitsPerBox)}
                            </p>
                            <p className="text-sm text-slate-500 mt-1">{t('common.boxes')}</p>
                            {viewingProduct.currentStock % viewingProduct.unitsPerBox > 0 && (
                              <p className="text-sm font-medium text-slate-600 mt-2">
                                + {viewingProduct.currentStock % viewingProduct.unitsPerBox} {t('common.units')}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className={`p-6 rounded-lg border ${
                      viewingProduct.currentStock === 0
                        ? "bg-red-50 border-red-200"
                        : viewingProduct.currentStock <= viewingProduct.minStockLevel
                          ? "bg-amber-50 border-amber-200"
                          : "bg-green-50 border-green-200"
                    }`}>
                      <div className="flex items-start">
                        <div className={`p-3 rounded-full mr-4 ${
                          viewingProduct.currentStock === 0
                            ? "bg-red-100"
                            : viewingProduct.currentStock <= viewingProduct.minStockLevel
                              ? "bg-amber-100"
                              : "bg-green-100"
                        }`}>
                          {viewingProduct.currentStock === 0 ? (
                            <AlertTriangle className={`h-6 w-6 text-red-600`} />
                          ) : viewingProduct.currentStock <= viewingProduct.minStockLevel ? (
                            <AlertCircle className={`h-6 w-6 text-amber-600`} />
                          ) : (
                            <CheckCircle className={`h-6 w-6 text-green-600`} />
                          )}
                        </div>
                        <div>
                          <h3 className={`text-lg font-semibold mb-1 ${
                            viewingProduct.currentStock === 0
                              ? "text-red-700"
                              : viewingProduct.currentStock <= viewingProduct.minStockLevel
                                ? "text-amber-700"
                                : "text-green-700"
                          }`}>
                            {viewingProduct.currentStock === 0
                              ? t('inventory.outOfStock')
                              : viewingProduct.currentStock <= viewingProduct.minStockLevel
                                ? t('inventory.lowStock')
                                : t('inventory.inStock')
                            }
                          </h3>
                          <p className={`${
                            viewingProduct.currentStock === 0
                              ? "text-red-600"
                              : viewingProduct.currentStock <= viewingProduct.minStockLevel
                                ? "text-amber-600"
                                : "text-green-600"
                          }`}>
                            {viewingProduct.currentStock === 0
                              ? t('inventory.restockNeeded')
                              : viewingProduct.currentStock <= viewingProduct.minStockLevel
                                ? t('inventory.moreUnitsNeeded', { count: viewingProduct.minStockLevel - viewingProduct.currentStock })
                                : t('inventory.unitsAboveMinimum', { count: viewingProduct.currentStock - viewingProduct.minStockLevel })
                            }
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex justify-end">
                        <Button 
                          variant={viewingProduct.currentStock === 0 ? "default" : "outline"}
                          className={viewingProduct.currentStock === 0 ? "bg-red-600 hover:bg-red-700" : ""}
                          onClick={() => {
                            setIsDetailsDialogOpen(false);
                            handleEditProduct(viewingProduct);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          {viewingProduct.currentStock === 0
                            ? t('inventory.restockNow')
                            : t('inventory.updateStock')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="inventoryChanges" className="mt-4">
                  {viewingProduct && viewingProduct.id && (
                    <InventoryChangeHistory productId={viewingProduct.id} />
                  )}
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-between mt-6">
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDetailsDialogOpen(false)}
                  >
                    {t('common.close')}
                  </Button>
                  
                  {user?.role === 'admin' && (
                    <Button
                      variant="outline"
                      className="text-red-500 border-red-300 hover:bg-red-50 hover:text-red-600"
                      onClick={() => {
                        setIsDetailsDialogOpen(false);
                        handleDeleteProduct(viewingProduct.id);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('common.delete')}
                    </Button>
                  )}
                </div>
                
                <Button
                  onClick={() => {
                    setIsDetailsDialogOpen(false);
                    handleEditProduct(viewingProduct);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  {t('products.editProduct')}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;