import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useSidebar } from "@context/SidebarContext";
import { useAuth } from "@context/AuthContext";
import { useToast } from "@hooks/use-toast";
import { exportData } from "@lib/utils";
import { 
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage 
} from "@components/ui/form";
import { Input } from "@components/ui/input";
import { Button } from "@components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, 
  DropdownMenuSeparator, DropdownMenuTrigger 
} from "@components/ui/dropdown-menu";
import { Textarea } from "@components/ui/textarea";
import {
  ArrowDown, ArrowUp, Box, ChevronDown, ClipboardList, Download, Edit, 
  Loader2, PackageCheck, PlusCircle, QrCode, Search, SlidersHorizontal, Trash2, X
} from "lucide-react";
import { BarcodeScanner } from "@components/barcode/BarcodeScanner";
import { BarcodeGenerator } from "@components/barcode/BarcodeGenerator";

// Interface for a Product
interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
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
  name: z.string().min(2, "Name must be at least 2 characters"),
  sku: z.string().min(2, "SKU must be at least 2 characters"),
  barcode: z.string().optional(),
  description: z.string().optional(),
  minStockLevel: z.coerce.number().min(0, "Min stock level cannot be negative"),
  currentStock: z.coerce.number().min(0, "Current stock cannot be negative"),
  location: z.string().optional(),
  unitsPerBox: z.coerce.number().min(1, "Units per box must be at least 1").optional(),
  imagePath: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  // Removed categoryId field
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export default function Products() {
  const { t } = useTranslation();
  const { setSidebarOpen } = useSidebar();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      description: "",
      minStockLevel: 5,
      currentStock: 0,
      location: "",
      unitsPerBox: 1,
      imagePath: "",
      tags: [],
    },
  });

  // State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all_tags");
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Query: Get all products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['/api/products'],
    select: (data) => data as Product[]
  });

  // Filter products based on search, stock filter, and tags
  const filteredProducts = products.filter((product) => {
    // Filter by search query
    if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !product.sku.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !(product.barcode && product.barcode.toLowerCase().includes(searchQuery.toLowerCase()))) {
      return false;
    }

    // Filter by stock level
    if (stockFilter === "in" && product.currentStock <= product.minStockLevel) {
      return false;
    }
    if (stockFilter === "low" && (product.currentStock === 0 || product.currentStock > product.minStockLevel)) {
      return false;
    }
    if (stockFilter === "out" && product.currentStock > 0) {
      return false;
    }

    // Filter by tag
    if (tagFilter && tagFilter !== "all_tags" && (!product.tags || !product.tags.includes(tagFilter))) {
      return false;
    }

    return true;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let valA = a[sortField as keyof Product];
    let valB = b[sortField as keyof Product];
    
    if (typeof valA === "string" && typeof valB === "string") {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }
    
    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      // Add default categoryId=1 for compatibility
      const productData = { ...values, categoryId: 1 };
      
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        
        const response = await apiRequest('/api/upload/product-image', {
          method: 'POST',
          body: formData,
        });
        
        productData.imagePath = response.path;
      }
      
      return apiRequest('/api/products', {
        method: 'POST',
        body: JSON.stringify(productData),
      });
    },
    onSuccess: () => {
      toast({
        title: t('products.productCreated'),
        description: t('products.productCreatedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIsDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error creating product:", error);
      toast({
        title: t('products.errorCreating'),
        description: t('products.errorCreatingDescription'),
        variant: "destructive",
      });
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: ProductFormValues }) => {
      // Add default categoryId=1 for compatibility
      const productData = { ...values, categoryId: 1 };
      
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        
        const response = await apiRequest('/api/upload/product-image', {
          method: 'POST',
          body: formData,
        });
        
        productData.imagePath = response.path;
      }
      
      return apiRequest(`/api/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(productData),
      });
    },
    onSuccess: () => {
      toast({
        title: t('products.productUpdated'),
        description: t('products.productUpdatedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIsDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error updating product:", error);
      toast({
        title: t('products.errorUpdating'),
        description: t('products.errorUpdatingDescription'),
        variant: "destructive",
      });
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: (productId: number) => 
      apiRequest(`/api/products/${productId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({
        title: t('products.productDeleted'),
        description: t('products.productDeletedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    },
    onError: (error) => {
      console.error("Error deleting product:", error);
      toast({
        title: t('products.errorDeleting'),
        description: t('products.errorDeletingDescription'),
        variant: "destructive",
      });
    }
  });

  // Form submission handler
  const onSubmit = (values: ProductFormValues) => {
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, values });
    } else {
      createProductMutation.mutate(values);
    }
  };

  // Edit product handler
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setImagePreview(null);
    setImageFile(null);
    
    // Set form values
    form.reset({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || "",
      description: product.description || "",
      minStockLevel: product.minStockLevel,
      currentStock: product.currentStock,
      location: product.location || "",
      unitsPerBox: product.unitsPerBox || 1,
      imagePath: product.imagePath || "",
      tags: product.tags || [],
    });
    
    setIsDialogOpen(true);
  };

  // View product handler
  const handleViewProduct = (product: Product) => {
    setViewingProduct(product);
    setIsDetailsDialogOpen(true);
  };

  // Delete product handler
  const handleDeleteProduct = (productId: number) => {
    if (confirm(t('products.confirmDelete'))) {
      deleteProductMutation.mutate(productId);
    }
  };

  // Image change handler
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Data export handler
  const handleExportData = (format: string) => {
    const productsForExport = products.map((product: Product) => {
      return {
        Name: product.name,
        SKU: product.sku,
        Barcode: product.barcode || "N/A",
        "Min Stock": product.minStockLevel,
        "Current Stock": product.currentStock,
        Location: product.location || "N/A",
        "Units/Box": product.unitsPerBox || "N/A",
      };
    });
    exportData(productsForExport, format, "Products_Export");
  };
  
  // Barcode scanning handler
  const handleBarcodeScanned = (barcode: string) => {
    form.setValue("barcode", barcode);
    toast({
      title: "Barcode Scanned",
      description: `Successfully scanned barcode: ${barcode}`,
    });
  };
  
  // New product handler
  const handleNewProduct = () => {
    setEditingProduct(null);
    
    // Reset form with default values
    form.reset({
      name: "",
      sku: "",
      barcode: "",
      description: "",
      minStockLevel: 5,
      currentStock: 0,
      location: "",
      unitsPerBox: 1,
      imagePath: "",
      tags: [],
    });
    setIsDialogOpen(true);
  };
  
  // Utility to get stock status CSS class
  const getStockStatusClass = (currentStock: number, minStockLevel: number) => {
    if (currentStock === 0) return "text-red-600";
    if (currentStock <= minStockLevel) return "text-amber-600";
    return "text-green-600";
  };

  // Get all unique tags from products
  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    products.forEach(product => {
      if (product.tags && product.tags.length > 0) {
        product.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [products]);
  
  // Sorting handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle sort direction if clicking the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new sort field and default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="w-full">
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h1 className="font-semibold text-2xl">{t('products.title')}</h1>
              <p className="text-slate-500 mt-1">{t('products.subtitle')}</p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleNewProduct}
                className="flex items-center gap-1"
              >
                <PlusCircle className="h-4 w-4" />
                {t('products.addProduct')}
              </Button>
            </div>
          </div>
          <div className="p-4 border-b border-slate-200">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="flex flex-col md:flex-row gap-2 flex-1">
                <div className="relative w-full md:w-64">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-4 w-4 text-slate-400" />
                  </span>
                  <Input
                    placeholder={t('products.searchPlaceholder')}
                    className="pl-10 pr-10"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 h-full"
                      onClick={() => setSearchQuery('')}
                    >
                      <X className="h-4 w-4 text-slate-400" />
                    </Button>
                  )}
                </div>

                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder={t('products.allStockStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('products.allStockStatus')}</SelectItem>
                    <SelectItem value="in">{t('products.inStock')}</SelectItem>
                    <SelectItem value="low">{t('products.lowStock')}</SelectItem>
                    <SelectItem value="out">{t('products.outOfStock')}</SelectItem>
                  </SelectContent>
                </Select>

                {allTags.length > 0 && (
                  <Select 
                    value={tagFilter || "all_tags"} 
                    onValueChange={(value) => setTagFilter(value)}
                  >
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder={t('products.filterByTag')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_tags">{t('products.allTags')}</SelectItem>
                      {allTags.map(tag => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex flex-col md:flex-row gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-1">
                      <SlidersHorizontal className="h-4 w-4" />
                      {t('products.actions')}
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{t('products.exportOptions')}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleExportData('csv')}>
                      <Download className="h-4 w-4 mr-2" />
                      {t('products.exportCSV')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportData('excel')}>
                      <Download className="h-4 w-4 mr-2" />
                      {t('products.exportExcel')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportData('pdf')}>
                      <Download className="h-4 w-4 mr-2" />
                      {t('products.exportPDF')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <PackageCheck className="h-4 w-4 mr-2" />
                      {t('products.bulkUpdateStock')}
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <ClipboardList className="h-4 w-4 mr-2" />
                      {t('products.printInventoryList')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" className="flex items-center gap-1">
                  <QrCode className="h-4 w-4" />
                  {t('products.scanBarcode')}
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="flex justify-center items-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2">{t('products.loading')}</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center p-8 border rounded-lg bg-slate-50">
                <Box className="h-12 w-12 mx-auto text-slate-400" />
                <h3 className="mt-4 text-lg font-medium">{t('products.noProductsFound')}</h3>
                <p className="mt-2 text-slate-500">
                  {searchQuery || stockFilter !== "all" || tagFilter !== "all_tags" ? (
                    t('products.tryClearingFilters')
                  ) : (
                    t('products.createFirstProduct')
                  )}
                </p>
                {!searchQuery && stockFilter === "all" && tagFilter === "all_tags" && (
                  <Button 
                    variant="default" 
                    className="mt-4" 
                    onClick={handleNewProduct}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    {t('products.addProduct')}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th 
                          className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort("name")}
                        >
                          <div className="flex items-center">
                            {t('products.productName')}
                            {sortField === "name" && (
                              sortDirection === "asc" ? 
                                <ArrowUp className="h-3 w-3 ml-1" /> : 
                                <ArrowDown className="h-3 w-3 ml-1" />
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort("sku")}
                        >
                          <div className="flex items-center">
                            {t('products.sku')}
                            {sortField === "sku" && (
                              sortDirection === "asc" ? 
                                <ArrowUp className="h-3 w-3 ml-1" /> : 
                                <ArrowDown className="h-3 w-3 ml-1" />
                            )}
                          </div>
                        </th>

                        <th 
                          className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort("currentStock")}
                        >
                          <div className="flex items-center">
                            {t('products.stock')}
                            {sortField === "currentStock" && (
                              sortDirection === "asc" ? 
                                <ArrowUp className="h-3 w-3 ml-1" /> : 
                                <ArrowDown className="h-3 w-3 ml-1" />
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {t('products.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {filteredProducts.map((product: Product) => {
                        return (
                          <tr 
                            key={product.id} 
                            className="hover:bg-slate-50 cursor-pointer"
                            onClick={() => handleViewProduct(product)}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 bg-slate-100 rounded-md flex items-center justify-center">
                                  {product.imagePath ? (
                                    <img 
                                      src={product.imagePath} 
                                      alt={product.name} 
                                      className="h-10 w-10 rounded-md object-cover"
                                    />
                                  ) : (
                                    <Box className="h-5 w-5 text-slate-400" />
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-slate-900">{product.name}</div>
                                  {product.barcode && (
                                    <div className="text-xs text-slate-500">{product.barcode}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-500">
                              <div>
                                {product.sku}
                                {product.tags && product.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {product.tags.map((tag, index) => (
                                      <Badge 
                                        key={index} 
                                        variant="outline" 
                                        className="text-xs bg-slate-50 cursor-pointer hover:bg-slate-100"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTagFilter(tag);
                                        }}
                                      >
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStockStatusClass(product.currentStock, product.minStockLevel)} bg-opacity-10`}>
                                {product.currentStock}
                              </span>
                              <span className="text-xs text-slate-500 ml-1">/ {product.minStockLevel}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditProduct(product);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProduct(product.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Product Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[720px] p-0 overflow-hidden">
          <div className="flex h-full">
            <div className="w-1/3 bg-slate-50 p-6 border-r border-slate-200">
              <div className="sticky top-0">
                <h3 className="font-medium text-lg mb-4">{t('products.productImage')}</h3>
                <p className="text-sm text-slate-500 mb-4">
                  {t('products.imageDescription')}
                </p>
                <FormField
                  control={form.control}
                  name="imagePath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block mb-2">{t('products.uploadImage')}</FormLabel>
                      <div className="mb-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                          id="image-upload"
                        />
                        <label
                          htmlFor="image-upload"
                          className="cursor-pointer bg-white border border-slate-200 rounded-md p-8 flex items-center justify-center flex-col"
                        >
                          {imagePreview || (editingProduct && editingProduct.imagePath) ? (
                            <img
                              src={imagePreview || editingProduct?.imagePath}
                              alt="Preview"
                              className="max-h-32 object-contain mb-2"
                            />
                          ) : (
                            <Box className="h-12 w-12 text-slate-300 mb-2" />
                          )}
                          <span className="text-sm text-center text-slate-500">
                            {t('products.dragOrClickToUpload')}
                          </span>
                        </label>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        {t('products.recommendedImageSize')}
                      </p>
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="flex-1">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-xl">{editingProduct ? t('products.editProduct') : t('products.addNewProduct')}</DialogTitle>
                <DialogDescription>{t('products.fillDetails')}</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
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
                          <FormLabel>{t('products.sku')}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="barcode"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>{t('products.barcode')}</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <BarcodeScanner 
                              onBarcodeScanned={handleBarcodeScanned}
                              buttonVariant="outline"
                              buttonSize="icon"
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* Additional barcode or scanning options could go here */}
                    <div className="flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-sm text-slate-500">
                          {t('products.scanBarcode')}
                        </p>
                        <BarcodeGenerator
                          value={form.getValues("barcode") || form.getValues("sku")}
                          buttonVariant="ghost"
                          buttonSize="sm"
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('products.description')}</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="currentStock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.currentStock')}</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="minStockLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.minStockLevel')}</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormDescription>
                            {t('products.minStockDescription')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.storageLocation')}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormDescription>
                            {t('products.locationDescription')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="unitsPerBox"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.unitsPerBox')}</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
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
                  <DialogFooter className="pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                    >
                      {t('products.cancel')}
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createProductMutation.isPending || updateProductMutation.isPending}
                    >
                      {createProductMutation.isPending || updateProductMutation.isPending 
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('products.saving')}</>
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
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-auto">
          {viewingProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">{viewingProduct.name}</DialogTitle>
                <DialogDescription>
                  <span className="font-medium">{t('products.sku')}:</span> {viewingProduct.sku}
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="details">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="details">{t('products.productDetails')}</TabsTrigger>
                  <TabsTrigger value="barcode">{t('products.barcode')}</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('products.productInformation')}</CardTitle>
                      <CardDescription>{t('products.detailedInformation')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <div className="rounded border border-slate-200 overflow-hidden">
                            {viewingProduct.imagePath ? (
                              <img 
                                src={viewingProduct.imagePath} 
                                alt={viewingProduct.name} 
                                className="w-full h-48 object-contain bg-white p-4"
                              />
                            ) : (
                              <div className="w-full h-48 bg-slate-100 flex items-center justify-center">
                                <Box className="h-12 w-12 text-slate-300" />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-sm font-medium text-slate-500">{t('products.barcode')}</h3>
                            <p className="mt-1">{viewingProduct.barcode || t('products.notAvailable')}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-slate-500">{t('products.stockInformation')}</h3>
                            <div className="mt-1 flex items-center">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStockStatusClass(viewingProduct.currentStock, viewingProduct.minStockLevel)} bg-opacity-10`}>
                                {viewingProduct.currentStock}
                              </span>
                              <span className="text-xs text-slate-500 ml-1">/ {viewingProduct.minStockLevel}</span>
                            </div>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-slate-500">{t('products.location')}</h3>
                            <p className="mt-1">{viewingProduct.location || t('products.notAvailable')}</p>
                          </div>
                          {viewingProduct.unitsPerBox && (
                            <div>
                              <h3 className="text-sm font-medium text-slate-500">{t('products.unitsPerBox')}</h3>
                              <p className="mt-1">{viewingProduct.unitsPerBox}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-slate-500">{t('products.description')}</h3>
                        <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                          {viewingProduct.description || t('products.noDescription')}
                        </p>
                      </div>
                      {viewingProduct.tags && viewingProduct.tags.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-slate-500">Tags</h3>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {viewingProduct.tags.map((tag, index) => (
                              <Badge key={index} variant="outline" className="bg-slate-100">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-between border-t pt-5">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsDetailsDialogOpen(false)}
                      >
                        {t('products.close')}
                      </Button>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setIsDetailsDialogOpen(false);
                            handleEditProduct(viewingProduct);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          {t('products.edit')}
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={() => {
                            setIsDetailsDialogOpen(false);
                            handleDeleteProduct(viewingProduct.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('products.delete')}
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                </TabsContent>
                <TabsContent value="barcode">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('products.barcodeInformation')}</CardTitle>
                      <CardDescription>{t('products.scanOrPrintBarcode')}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center p-8">
                      <div className="text-center">
                        <BarcodeGenerator
                          value={viewingProduct.barcode || viewingProduct.sku}
                          displayValue={true}
                          size="lg"
                          className="mb-4"
                        />
                        <p className="text-sm text-slate-500 mb-2">{viewingProduct.barcode || viewingProduct.sku}</p>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          {t('products.downloadBarcode')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}