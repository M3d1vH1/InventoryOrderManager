import React, { useEffect, useState } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BarcodeGenerator } from "@/components/barcode";
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
            <h1 className="font-semibold text-2xl">Products</h1>
            <p className="text-slate-500 mt-1">Manage your inventory and track stock levels</p>
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
              <Plus className="mr-2 h-4 w-4" /> Add product
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
                  placeholder="Search products..."
                  className="pl-10 h-10 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                {/* Category filter dropdown removed as part of simplification */}
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-full md:w-48 h-10 bg-white">
                    <SelectValue placeholder="Filter by stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stock Levels</SelectItem>
                    <SelectItem value="in">In Stock</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="out">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Tag Filter */}
                {allTags.length > 0 && (
                  <Select 
                    value={tagFilter || "all_tags"} 
                    onValueChange={(value) => setTagFilter(value)}
                  >
                    <SelectTrigger className="w-full md:w-48 h-10 bg-white">
                      <SelectValue placeholder="Filter by tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_tags">All Tags</SelectItem>
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
                      {viewMode === "grid" && "Grid View"}
                      {viewMode === "table" && "Table View"}
                      {viewMode === "list" && "List View"}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setViewMode("grid")}>
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    <span>Grid View</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode("table")}>
                    <Table className="mr-2 h-4 w-4" />
                    <span>Table View</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode("list")}>
                    <List className="mr-2 h-4 w-4" />
                    <span>List View</span>
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
                <p className="text-slate-600">Loading products...</p>
              </div>
            </div>
          ) : filteredProducts?.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center">
                <Package size={48} className="mx-auto text-slate-300 mb-3" />
                <h3 className="text-lg font-medium mb-1">No products found</h3>
                <p className="text-slate-500">
                  {searchTerm || stockFilter !== "all" || tagFilter !== "all_tags" 
                    ? "Try clearing your filters or creating a new product." 
                    : "Get started by creating your first product."}
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
                    Clear all filters
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Product display section */}
              {viewMode === "grid" ? (
                // Grid View
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredProducts && filteredProducts.map((product) => (
                    <div 
                      key={product.id} 
                      className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 cursor-pointer"
                      onClick={() => handleViewProduct(product)}
                    >
                      <div className="aspect-video bg-slate-100 relative flex items-center justify-center overflow-hidden">
                        {product.imagePath ? (
                          <img 
                            src={product.imagePath.startsWith('/') ? product.imagePath : `/${product.imagePath}`}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-image.svg';
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <Image size={40} />
                            <span className="mt-2 text-sm">No image</span>
                          </div>
                        )}
                        
                        <div className="absolute top-2 right-2">
                          <button 
                            className="p-2 bg-white rounded-full shadow-sm hover:shadow-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditProduct(product);
                            }}
                            title="Edit Product"
                          >
                            <Edit size={14} className="text-slate-600" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-lg text-slate-900 truncate">{product.name}</h3>
                          <span className={`font-medium text-sm px-2 py-1 rounded-full flex items-center ${
                            product.currentStock === 0 
                              ? 'bg-red-100 text-red-800' 
                              : product.currentStock <= product.minStockLevel
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-green-100 text-green-800'
                          }`}>
                            {product.currentStock === 0 
                              ? 'Out of stock' 
                              : product.currentStock <= product.minStockLevel
                                ? 'Low stock'
                                : 'In stock'
                            }
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                          <div>
                            <p className="text-slate-500">SKU</p>
                            <p className="text-slate-700 font-medium">{product.sku}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Units/Box</p>
                            <p className="text-slate-700 font-medium">{product.unitsPerBox || 'Not specified'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Min Stock</p>
                            <p className="text-slate-700 font-medium">{product.minStockLevel}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Current Stock</p>
                            <p className={`font-medium ${getStockStatusClass(product.currentStock, product.minStockLevel)}`}>
                              {product.currentStock}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                          <div className="flex items-center">
                            <i className="fas fa-tags mr-1 text-slate-500"></i>
                            {product.tags && product.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {product.tags.slice(0, 2).map((tag, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {product.tags.length > 2 && (
                                  <span className="text-xs text-slate-500">+{product.tags.length - 2} more</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">No tags</span>
                            )}
                          </div>
                          
                          <button 
                            className="text-red-500 hover:text-red-600 text-sm flex items-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProduct(product.id);
                            }}
                            title="Delete Product"
                          >
                            <i className="fas fa-trash mr-1"></i> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : viewMode === "table" ? (
                // Table View
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 text-sm">
                        <th className="text-left py-3 px-4 font-medium">Product</th>
                        <th className="text-left py-3 px-4 font-medium">SKU</th>
                        <th className="text-left py-3 px-4 font-medium">Stock</th>
                        <th className="text-left py-3 px-4 font-medium">Min Stock</th>
                        <th className="text-left py-3 px-4 font-medium">Location</th>
                        <th className="text-right py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts && filteredProducts.map((product) => (
                        <tr 
                          key={product.id} 
                          className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer"
                          onClick={() => handleViewProduct(product)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 flex-shrink-0 rounded-md overflow-hidden bg-slate-100">
                                {product.imagePath ? (
                                  <img 
                                    src={product.imagePath.startsWith('/') ? product.imagePath : `/${product.imagePath}`}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = '/placeholder-image.svg';
                                    }}
                                  />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-slate-400">
                                    <Image size={16} />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-slate-800">{product.name}</p>
                                {product.tags && product.tags.length > 0 && (
                                  <div className="flex gap-1 mt-1">
                                    {product.tags.slice(0, 1).map((tag, index) => (
                                      <Badge key={index} variant="outline" className="text-xs px-1 py-0">
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
                          <td className="py-3 px-4 text-slate-700">{product.sku}</td>
                          <td className="py-3 px-4">
                            <span className={`font-medium text-xs px-2 py-1 rounded-full ${
                              product.currentStock === 0 
                                ? 'bg-red-100 text-red-800' 
                                : product.currentStock <= product.minStockLevel
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-green-100 text-green-800'
                            }`}>
                              {product.currentStock}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700">{product.minStockLevel}</td>
                          <td className="py-3 px-4 text-slate-700">{product.location || "—"}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                className="p-1 hover:bg-slate-200 rounded"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditProduct(product);
                                }}
                                title="Edit Product"
                              >
                                <Edit size={16} className="text-slate-600" />
                              </button>
                              <button 
                                className="p-1 hover:bg-slate-200 rounded text-red-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProduct(product.id);
                                }}
                                title="Delete Product"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                // List View
                <div className="space-y-3">
                  {filteredProducts && filteredProducts.map((product) => (
                    <div 
                      key={product.id} 
                      className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200 cursor-pointer flex flex-col md:flex-row gap-4"
                      onClick={() => handleViewProduct(product)}
                    >
                      {/* Product image */}
                      <div className="w-full md:w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-slate-100">
                        {product.imagePath ? (
                          <img 
                            src={product.imagePath.startsWith('/') ? product.imagePath : `/${product.imagePath}`}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-image.svg';
                            }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-slate-400">
                            <Image size={24} />
                          </div>
                        )}
                      </div>
                      
                      {/* Product details */}
                      <div className="flex-grow flex flex-col md:flex-row gap-4">
                        <div className="flex-grow">
                          <h3 className="font-medium text-lg text-slate-900">{product.name}</h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-slate-500">SKU: <span className="font-medium text-slate-700">{product.sku}</span></span>
                            {product.location && (
                              <span className="text-sm text-slate-500 flex items-center">
                                <MapPin size={12} className="mr-1" /> 
                                {product.location}
                              </span>
                            )}
                          </div>
                          
                          {product.tags && product.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {product.tags.map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 md:justify-end">
                          <div className="text-center">
                            <div className="text-xs text-slate-500 mb-1">Current Stock</div>
                            <div className={`font-medium text-sm px-2 py-1 rounded-full ${
                              product.currentStock === 0 
                                ? 'bg-red-100 text-red-800' 
                                : product.currentStock <= product.minStockLevel
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-green-100 text-green-800'
                            }`}>
                              {product.currentStock}
                            </div>
                          </div>
                          
                          <div className="text-center">
                            <div className="text-xs text-slate-500 mb-1">Min Level</div>
                            <div className="font-medium text-sm bg-slate-100 px-2 py-1 rounded-full text-slate-800">
                              {product.minStockLevel}
                            </div>
                          </div>
                          
                          <div className="flex gap-1">
                            <button 
                              className="p-2 hover:bg-slate-100 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditProduct(product);
                              }}
                              title="Edit Product"
                            >
                              <Edit size={16} className="text-slate-600" />
                            </button>
                            <button 
                              className="p-2 hover:bg-slate-100 rounded-full text-red-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProduct(product.id);
                              }}
                              title="Delete Product"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Pagination */}
              <div className="mt-6 border-t border-slate-200 pt-5 text-sm flex items-center justify-between">
                <span className="text-slate-600">
                  Showing {filteredProducts ? filteredProducts.length : 0} of {products?.length || 0} products
                </span>
                <div className="flex items-center space-x-2">
                  <button className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled>
                    <i className="fas fa-chevron-left mr-1"></i> Previous
                  </button>
                  <button className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled>
                    Next <i className="fas fa-chevron-right ml-1"></i>
                  </button>
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
                <DialogTitle className="text-xl">{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
                <DialogDescription>Fill in the product details below.</DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 pt-2 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Name</FormLabel>
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
                          <FormLabel>SKU</FormLabel>
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
                        <FormLabel>Description</FormLabel>
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
                          <FormLabel>Barcode</FormLabel>
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
                          <FormLabel>Storage Location</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Aisle 5, Bin B3" />
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
                          <FormLabel>Minimum Stock Level</FormLabel>
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
                          <FormLabel>Current Stock</FormLabel>
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
                          <FormLabel>Units Per Box</FormLabel>
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
                          <FormLabel>Tags</FormLabel>
                          <FormDescription>
                            Enter comma-separated tags to categorize this product
                          </FormDescription>
                          <FormControl>
                            <Input 
                              placeholder="e.g. fragile, electronics, discount"
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
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={createProductMutation.isPending || updateProductMutation.isPending}
                    >
                      {(createProductMutation.isPending || updateProductMutation.isPending) 
                        ? "Saving..." 
                        : editingProduct ? "Update Product" : "Add Product"
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
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-auto">
          {viewingProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">{viewingProduct.name}</DialogTitle>
                <DialogDescription>SKU: {viewingProduct.sku}</DialogDescription>
              </DialogHeader>
              
              <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="info">
                    <Info className="mr-2 h-4 w-4" />
                    Information
                  </TabsTrigger>
                  <TabsTrigger value="tags">
                    <Tag className="mr-2 h-4 w-4" />
                    Tags
                  </TabsTrigger>
                  <TabsTrigger value="inventory">
                    <Box className="mr-2 h-4 w-4" />
                    Inventory
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="info" className="mt-4">
                  <div className="flex flex-col md:flex-row gap-6">
                    {viewingProduct.imagePath && (
                      <div className="md:w-1/3">
                        <Card>
                          <CardContent className="p-4">
                            <div className="relative aspect-square rounded-md overflow-hidden">
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
                          </CardContent>
                        </Card>
                      </div>
                    )}
                    
                    <div className={viewingProduct.imagePath ? "md:w-2/3" : "w-full"}>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-xl">Product Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Category field removed */}
                            {viewingProduct.location && (
                              <div>
                                <h3 className="text-sm font-medium text-slate-500 flex items-center">
                                  <MapPin className="mr-1 h-4 w-4" />
                                  Location
                                </h3>
                                <p>{viewingProduct.location}</p>
                              </div>
                            )}
                            <div>
                              <h3 className="text-sm font-medium text-slate-500">Tags</h3>
                              <div className="mt-1">
                                {viewingProduct.tags && viewingProduct.tags.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {viewingProduct.tags.map((tag, index) => (
                                      <Badge 
                                        key={index} 
                                        variant="outline" 
                                        className="text-xs bg-slate-50"
                                      >
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <p>No tags</p>
                                )}
                              </div>
                            </div>
                            {viewingProduct.unitsPerBox !== undefined && viewingProduct.unitsPerBox > 0 && (
                              <div>
                                <h3 className="text-sm font-medium text-slate-500 flex items-center">
                                  <Layers className="mr-1 h-4 w-4" />
                                  Units Per Box
                                </h3>
                                <p>{viewingProduct.unitsPerBox}</p>
                              </div>
                            )}
                          </div>
                          
                          {viewingProduct.description && (
                            <div>
                              <h3 className="text-sm font-medium text-slate-500">Description</h3>
                              <p className="text-slate-700 whitespace-pre-line">{viewingProduct.description}</p>
                            </div>
                          )}
                          

                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="tags" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Product Tags</CardTitle>
                      <CardDescription>View and manage product categorization tags</CardDescription>
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
                            <h3 className="text-sm font-medium text-slate-700 mb-2">About Product Tags</h3>
                            <p className="text-sm text-slate-600">
                              Tags help categorize products and make them easier to find. They are also used for filtering and organizing inventory reports.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-10">
                          <Tag className="h-12 w-12 text-slate-300 mb-2" />
                          <p className="text-slate-500">No tags have been added to this product.</p>
                          <Button 
                            className="mt-4"
                            variant="outline"
                            onClick={() => {
                              setIsDetailsDialogOpen(false);
                              handleEditProduct(viewingProduct);
                            }}
                          >
                            <Tag className="h-4 w-4 mr-2" />
                            Add Tags
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
                        Edit Tags
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
                
                <TabsContent value="inventory" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Inventory Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-sm font-medium text-slate-500">Current Stock</h3>
                            <p className={`text-xl font-semibold ${getStockStatusClass(viewingProduct.currentStock, viewingProduct.minStockLevel)}`}>
                              {viewingProduct.currentStock} units
                            </p>
                          </div>
                          
                          <div>
                            <h3 className="text-sm font-medium text-slate-500">Minimum Stock Level</h3>
                            <p className="text-xl font-semibold">{viewingProduct.minStockLevel} units</p>
                          </div>
                          
                          {viewingProduct.unitsPerBox && viewingProduct.unitsPerBox > 0 && (
                            <div>
                              <h3 className="text-sm font-medium text-slate-500">Box Count</h3>
                              <p className="text-xl font-semibold">
                                {Math.floor(viewingProduct.currentStock / viewingProduct.unitsPerBox)}
                                <span className="text-sm font-normal text-slate-500"> boxes</span>
                                {viewingProduct.currentStock % viewingProduct.unitsPerBox > 0 && (
                                  <span className="text-sm font-normal text-slate-500">
                                    {" + "}{viewingProduct.currentStock % viewingProduct.unitsPerBox} units
                                  </span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <div className="h-32 flex flex-col justify-center">
                            <div className={`p-4 rounded-lg flex flex-col items-center justify-center ${
                              viewingProduct.currentStock === 0
                                ? "bg-red-50 border border-red-100"
                                : viewingProduct.currentStock <= viewingProduct.minStockLevel
                                  ? "bg-amber-50 border border-amber-100"
                                  : "bg-green-50 border border-green-100"
                            }`}>
                              <span className={`text-lg font-medium ${
                                viewingProduct.currentStock === 0
                                  ? "text-red-700"
                                  : viewingProduct.currentStock <= viewingProduct.minStockLevel
                                    ? "text-amber-700"
                                    : "text-green-700"
                              }`}>
                                {viewingProduct.currentStock === 0
                                  ? "Out of Stock"
                                  : viewingProduct.currentStock <= viewingProduct.minStockLevel
                                    ? "Low Stock"
                                    : "In Stock"
                                }
                              </span>
                              <p className={`text-sm mt-1 ${
                                viewingProduct.currentStock === 0
                                  ? "text-red-600"
                                  : viewingProduct.currentStock <= viewingProduct.minStockLevel
                                    ? "text-amber-600"
                                    : "text-green-600"
                              }`}>
                                {viewingProduct.currentStock === 0
                                  ? "Restock needed immediately"
                                  : viewingProduct.currentStock <= viewingProduct.minStockLevel
                                    ? `${viewingProduct.minStockLevel - viewingProduct.currentStock} more units needed to reach minimum stock level`
                                    : `${viewingProduct.currentStock - viewingProduct.minStockLevel} units above minimum stock level`
                                }
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <Button 
                              variant="outline" 
                              className="mr-2"
                              onClick={() => {
                                setIsDetailsDialogOpen(false);
                                handleEditProduct(viewingProduct);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Update Stock
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-between mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDetailsDialogOpen(false)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setIsDetailsDialogOpen(false);
                    handleEditProduct(viewingProduct);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Product
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