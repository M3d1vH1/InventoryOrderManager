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
  Loader2, MapPin, Package, PackageCheck, PlusCircle, QrCode, Search, SlidersHorizontal, Trash2, X,
  Info as InfoIcon, Tag, Plus, Image, Eye, Layers
} from "lucide-react";
import { BarcodeScanner } from "@components/barcode/BarcodeScanner";
import { BarcodeGenerator } from "@components/barcode/BarcodeGenerator";

// Switch between normal and Shopify style
const SHOPIFY_STYLE = false; // Set to true for Shopify style, false for normal style

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
  sku: z.string().min(1, "SKU is required"),
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
  const { setSidebarOpen, setCurrentPage } = useSidebar();
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
  const [selectedTab, setSelectedTab] = useState("info");

  // Set current page for sidebar
  useEffect(() => {
    setCurrentPage && setCurrentPage("Products");
    
    // Check URL parameters for filters (Shopify style)
    if (SHOPIFY_STYLE) {
      const params = new URLSearchParams(window.location.search);
      const stockParam = params.get("stock");
      if (stockParam && ["in", "low", "out"].includes(stockParam)) {
        setStockFilter(stockParam);
      }
    }
  }, [setCurrentPage]);

  // Query: Get all products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['/api/products'],
    select: (data) => data as Product[]
  });

  // Reset form when editing product changes
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
        unitsPerBox: editingProduct.unitsPerBox || 1,
        imagePath: editingProduct.imagePath || "",
        tags: editingProduct.tags || [],
      });
    }
  }, [editingProduct, form]);

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
      
      // If there's an image file, don't send it via JSON
      // The server expects multipart form data for file uploads
      if (imageFile) {
        const formData = new FormData();
        
        // Add all product data fields to the form
        Object.entries(productData).forEach(([key, value]) => {
          if (key !== 'imagePath' && value !== undefined) {
            if (key === 'tags') {
              // For tags, we need special handling since it's an array
              if (Array.isArray(value)) {
                // Empty array check
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
                // In case it's somehow not an array, send empty array
                formData.append('tags', '[]');
              }
            } else if (Array.isArray(value)) {
              // Handle other arrays
              formData.append(key, JSON.stringify(value));
            } else {
              formData.append(key, String(value));
            }
          }
        });
        
        // Add the image file
        formData.append('image', imageFile);
        
        return apiRequest('/api/products', {
          method: 'POST',
          body: formData,
          // Don't set Content-Type header, browser will set it with boundary
        });
      }
      
      // If no image file, proceed with JSON
      return apiRequest('/api/products', {
        method: 'POST',
        body: JSON.stringify(productData),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      toast({
        title: t('products.productCreated'),
        description: t('products.productCreatedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIsDialogOpen(false);
      // Reset form to default values only after successful creation
      form.reset({
        name: '',
        sku: '',
        barcode: '',
        description: '',
        minStockLevel: 5,
        currentStock: 0,
        location: '',
        unitsPerBox: 1,
        imagePath: '',
        tags: [],
      });
      // Reset image state only after successful save
      setImagePreview(null);
      setImageFile(null);
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
      
      // If there's an image file, don't send it via JSON
      // The server expects multipart form data for file uploads
      if (imageFile) {
        const formData = new FormData();
        
        // Add all product data fields to the form
        Object.entries(productData).forEach(([key, value]) => {
          if (key !== 'imagePath' && value !== undefined) {
            if (key === 'tags') {
              // For tags, we need special handling since it's an array
              if (Array.isArray(value)) {
                // Empty array check
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
                // In case it's somehow not an array, send empty array
                formData.append('tags', '[]');
              }
            } else if (Array.isArray(value)) {
              // Handle other arrays
              formData.append(key, JSON.stringify(value));
            } else {
              formData.append(key, String(value));
            }
          }
        });
        
        // Add the image file
        formData.append('image', imageFile);
        
        return apiRequest(`/api/products/${id}`, {
          method: 'PATCH',
          body: formData,
          // Don't set Content-Type header, browser will set it with boundary
        });
      }
      
      // If no image file, proceed with JSON
      return apiRequest(`/api/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(productData),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      toast({
        title: t('products.productUpdated'),
        description: t('products.productUpdatedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      // Reset image state only after successful update
      setImagePreview(null);
      setImageFile(null);
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
      
      // Close details dialog if deleting the product being viewed
      if (viewingProduct && viewingProduct.id === viewingProduct.id) {
        setIsDetailsDialogOpen(false);
      }
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
    setSelectedTab("info");
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
      // Check file size (max 2MB)
      const maxSizeInBytes = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSizeInBytes) {
        toast({
          title: t('products.imageTooLarge'),
          description: t('products.imageSizeLimit', { size: '2MB' }),
          variant: "destructive",
        });
        return;
      }

      // Check file dimensions by loading it into an Image object
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        // Release object URL after dimensions are checked
        URL.revokeObjectURL(objectUrl);
        
        // Check dimensions
        const minWidth = 200;
        const minHeight = 200;
        const maxWidth = 1200;
        const maxHeight = 1200;
        
        if (img.width < minWidth || img.height < minHeight) {
          toast({
            title: t('products.imageTooSmall'),
            description: t('products.minImageDimensions', { width: minWidth, height: minHeight }),
            variant: "destructive",
          });
          return;
        }
        
        if (img.width > maxWidth || img.height > maxHeight) {
          toast({
            title: t('products.imageTooLarge'),
            description: t('products.maxImageDimensions', { width: maxWidth, height: maxHeight }),
            variant: "destructive",
          });
          return;
        }
        
        // If all checks pass, set the image file
        setImageFile(file);
        
        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        toast({
          title: t('products.invalidImage'),
          description: t('products.imageLoadError'),
          variant: "destructive",
        });
      };
      
      img.src = objectUrl;
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
  };

  // Get unique tags for tag filter
  const uniqueTags = products
    .reduce((tags: string[], product) => {
      if (product.tags && Array.isArray(product.tags)) {
        product.tags.forEach(tag => {
          if (!tags.includes(tag)) {
            tags.push(tag);
          }
        });
      }
      return tags;
    }, [])
    .sort();
  
  // Toggle sort direction handler
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === "asc" ? "desc" : "asc");
  };
  
  // Product count message
  const productCountMessage = filteredProducts.length === 1 
    ? t('products.singleProductCount') 
    : t('products.multipleProductCount', { count: filteredProducts.length });
  
  const getStockStatusClass = (currentStock: number, minStockLevel: number) => {
    if (currentStock === 0) return "text-red-600";
    if (currentStock <= minStockLevel) return "text-amber-600";
    return "text-green-600";
  };

  // Render standard UI
  if (!SHOPIFY_STYLE) {
    return (
      <div className="container mx-auto px-4 py-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('products.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('products.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
            <Button 
              variant="outline"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden"
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              {t('products.menu')}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  {t('products.export')}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>{t('products.exportFormat')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExportData('csv')}>
                  {t('products.exportCSV')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportData('excel')}>
                  {t('products.exportExcel')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportData('pdf')}>
                  {t('products.exportPDF')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button 
              variant="default" 
              onClick={() => { 
                setEditingProduct(null); 
                // Reset form to default values when creating a new product
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
                setImagePreview(null);
                setImageFile(null);
                setIsDialogOpen(true);
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('products.addProduct')}
            </Button>
          </div>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6">
          {/* Filter sidebar for larger screens */}
          <aside className="hidden md:block space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>{t('products.filters')}</CardTitle>
                <CardDescription>
                  {productCountMessage}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search box */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {t('products.search')}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      placeholder={t('products.searchPlaceholder')}
                      className="pl-8 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button 
                        className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                        onClick={() => setSearchQuery("")}
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Stock filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">
                    {t('products.stockFilter')}
                  </label>
                  <Select value={stockFilter} onValueChange={setStockFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('products.stockFilterAll')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('products.stockFilterAll')}</SelectItem>
                      <SelectItem value="in">{t('products.stockFilterIn')}</SelectItem>
                      <SelectItem value="low">{t('products.stockFilterLow')}</SelectItem>
                      <SelectItem value="out">{t('products.stockFilterOut')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Tag filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">
                    {t('products.tagFilter')}
                  </label>
                  <Select value={tagFilter} onValueChange={setTagFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('products.tagFilterAll')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_tags">{t('products.tagFilterAll')}</SelectItem>
                      {uniqueTags.map(tag => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Sort options */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">
                    {t('products.sortBy')}
                  </label>
                  <div className="flex items-center gap-2">
                    <Select value={sortField} onValueChange={setSortField}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t('products.sortByName')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">{t('products.sortByName')}</SelectItem>
                        <SelectItem value="sku">{t('products.sortBySku')}</SelectItem>
                        <SelectItem value="currentStock">{t('products.sortByStock')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={toggleSortDirection}
                      aria-label={sortDirection === "asc" ? "Sort ascending" : "Sort descending"}
                    >
                      {sortDirection === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>{t('products.quickActions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.location.href = "/barcode"}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  {t('products.printBarcodes')}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.location.href = "/order-picking"}
                >
                  <PackageCheck className="mr-2 h-4 w-4" />
                  {t('products.orderPicking')}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.location.href = "/inventory"}
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  {t('products.inventory')}
                </Button>
              </CardContent>
            </Card>
          </aside>
          
          {/* Product listing */}
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">{t('products.loading')}</span>
              </div>
            ) : sortedProducts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64 p-6">
                  <Box className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('products.noProducts')}</h3>
                  <p className="text-center text-muted-foreground max-w-md mb-4">
                    {t('products.noProductsDescription')}
                  </p>
                  <Button 
                    onClick={() => { 
                      setEditingProduct(null); 
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
                      setImagePreview(null);
                      setImageFile(null);
                      setIsDialogOpen(true);
                    }}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t('products.addFirstProduct')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Tabs defaultValue="grid" className="w-full">
                <div className="flex items-center justify-between mb-4">
                  <TabsList>
                    <TabsTrigger value="grid">{t('products.gridView')}</TabsTrigger>
                    <TabsTrigger value="table">{t('products.tableView')}</TabsTrigger>
                  </TabsList>
                  <p className="text-sm text-muted-foreground">
                    {productCountMessage}
                  </p>
                </div>
                
                <TabsContent value="grid" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sortedProducts.map((product) => (
                      <Card key={product.id} className="overflow-hidden">
                        <div className="aspect-square relative bg-muted/50">
                          {product.imagePath ? (
                            <img
                              src={product.imagePath}
                              alt={product.name}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Box className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                          
                          <div className="absolute top-2 right-2 flex gap-1">
                            <Button 
                              variant="outline" 
                              size="icon"
                              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                              onClick={() => handleViewProduct(product)}
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                            {user?.role === "admin" && (
                              <Button 
                                variant="outline" 
                                size="icon"
                                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                                onClick={() => handleEditProduct(product)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-lg line-clamp-2 mb-1">{product.name}</h3>
                          <p className="text-sm text-muted-foreground mb-2">SKU: {product.sku}</p>
                          
                          <div className="flex justify-between items-center">
                            <div>
                              <Badge 
                                variant={product.currentStock === 0 
                                  ? "destructive" 
                                  : (product.currentStock <= product.minStockLevel ? "warning" : "success")}
                                className="capitalize"
                              >
                                {product.currentStock === 0
                                  ? t('products.outOfStock')
                                  : (product.currentStock <= product.minStockLevel
                                    ? t('products.lowStock')
                                    : t('products.inStock')
                                  )
                                }
                              </Badge>
                            </div>
                            <span className="text-sm font-medium">
                              {product.currentStock} {t('products.units')}
                            </span>
                          </div>
                          
                          {/* Show tags */}
                          {product.tags && product.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {product.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="flex items-center">
                                  <Tag className="mr-1 h-3 w-3" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="table">
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-3 font-medium">{t('products.name')}</th>
                          <th className="text-left p-3 font-medium">{t('products.sku')}</th>
                          <th className="text-left p-3 font-medium">{t('products.stock')}</th>
                          <th className="text-left p-3 font-medium">{t('products.tags')}</th>
                          <th className="text-left p-3 font-medium">{t('products.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedProducts.map((product) => (
                          <tr key={product.id} className="border-t">
                            <td className="p-3">
                              <div className="font-medium">{product.name}</div>
                            </td>
                            <td className="p-3 text-muted-foreground">{product.sku}</td>
                            <td className="p-3">
                              <Badge 
                                variant={product.currentStock === 0 
                                  ? "destructive" 
                                  : (product.currentStock <= product.minStockLevel ? "warning" : "success")}
                                className="capitalize"
                              >
                                {product.currentStock}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {product.tags?.map(tag => (
                                  <Badge key={tag} variant="outline" className="flex items-center">
                                    <Tag className="mr-1 h-3 w-3" />
                                    {tag}
                                  </Badge>
                                )) || "-"}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleViewProduct(product)}
                                >
                                  <Search className="h-4 w-4" />
                                </Button>
                                {user?.role === "admin" && (
                                  <>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => handleEditProduct(product)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => handleDeleteProduct(product.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
        
        {/* Product Form Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? t('products.editProduct') : t('products.addProduct')}
              </DialogTitle>
              <DialogDescription>
                {editingProduct 
                  ? t('products.editProductDescription') 
                  : t('products.addProductDescription')}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('products.name')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('products.namePlaceholder')} {...field} />
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
                          <Input placeholder={t('products.skuPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="barcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          {t('products.barcode')}
                          <BarcodeScanner
                            onScan={handleBarcodeScanned}
                            trigger={
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 ml-2"
                              >
                                <QrCode className="h-4 w-4" />
                              </Button>
                            }
                          />
                        </FormLabel>
                        <FormControl>
                          <Input placeholder={t('products.barcodePlaceholder')} {...field} />
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
                        <FormLabel>{t('products.location')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('products.locationPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="currentStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('products.currentStock')}</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
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
                          <Input type="number" min={0} {...field} />
                        </FormControl>
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
                          <Input type="number" min={1} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('products.description')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t('products.descriptionPlaceholder')}
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        {t('products.tags')}
                        <div className="ml-2 inline-flex">
                          <InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
                          <span className="sr-only">{t('products.tagsHelp')}</span>
                        </div>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={t('products.tagsPlaceholder')}
                          value={field.value?.join(', ') || ''}
                          onChange={(e) => {
                            // Split by comma and trim whitespace
                            const tags = e.target.value
                              .split(',')
                              .map(tag => tag.trim())
                              .filter(tag => tag !== '');
                            field.onChange(tags);
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('products.tagsHelp')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div>
                  <FormLabel>{t('products.image')}</FormLabel>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-md p-4 text-center">
                      <div className="space-y-2">
                        <label 
                          htmlFor="image-upload" 
                          className="cursor-pointer inline-flex items-center justify-center px-4 py-2 border border-dashed border-input rounded-md text-sm font-medium bg-background hover:bg-accent"
                        >
                          {t('products.selectImage')}
                          <input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageChange}
                          />
                        </label>
                        <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                          <InfoIcon className="h-3 w-3" />
                          {t('products.imageRequirements')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="border rounded-md aspect-square flex items-center justify-center overflow-hidden bg-muted/50">
                      {imagePreview ? (
                        <div className="relative w-full h-full">
                          <img 
                            src={imagePreview} 
                            alt="Preview" 
                            className="object-contain w-full h-full"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur-sm"
                            onClick={() => {
                              setImagePreview(null);
                              setImageFile(null);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : form.getValues('imagePath') ? (
                        <div className="relative w-full h-full">
                          <img 
                            src={form.getValues('imagePath')} 
                            alt="Current" 
                            className="object-contain w-full h-full"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm p-2 text-xs text-center">
                            {t('products.currentImage')}
                          </div>
                        </div>
                      ) : (
                        <Box className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createProductMutation.isPending || updateProductMutation.isPending}
                  >
                    {(createProductMutation.isPending || updateProductMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingProduct ? t('products.saveChanges') : t('products.createProduct')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        {/* Product Details Dialog */}
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          {viewingProduct && (
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {viewingProduct.name}
                </DialogTitle>
                <DialogDescription>
                  {t('products.productDetails')}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="aspect-square relative rounded-md overflow-hidden bg-muted/50">
                  {viewingProduct.imagePath ? (
                    <img
                      src={viewingProduct.imagePath}
                      alt={viewingProduct.name}
                      className="object-contain w-full h-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Box className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Tags overlay */}
                  {viewingProduct.tags && viewingProduct.tags.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-background/80 backdrop-blur-sm flex flex-wrap gap-1">
                      {viewingProduct.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="flex items-center">
                          <Tag className="mr-1 h-3 w-3" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      {t('products.sku')}
                    </h4>
                    <p>{viewingProduct.sku}</p>
                  </div>
                  
                  {viewingProduct.barcode && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        {t('products.barcode')}
                      </h4>
                      <div className="flex items-center gap-2">
                        <p>{viewingProduct.barcode}</p>
                        <BarcodeGenerator
                          data={viewingProduct.barcode}
                          trigger={
                            <Button variant="outline" size="sm">
                              <QrCode className="mr-2 h-4 w-4" />
                              {t('products.generateBarcode')}
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        {t('products.currentStock')}
                      </h4>
                      <Badge 
                        variant={viewingProduct.currentStock === 0 
                          ? "destructive" 
                          : (viewingProduct.currentStock <= viewingProduct.minStockLevel ? "warning" : "success")}
                        className="text-sm"
                      >
                        {viewingProduct.currentStock} {t('products.units')}
                      </Badge>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        {t('products.minStockLevel')}
                      </h4>
                      <p>{viewingProduct.minStockLevel} {t('products.units')}</p>
                    </div>
                  </div>
                  
                  {viewingProduct.unitsPerBox && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        {t('products.unitsPerBox')}
                      </h4>
                      <p>{viewingProduct.unitsPerBox} {t('products.units')}</p>
                    </div>
                  )}
                  
                  {viewingProduct.location && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        {t('products.location')}
                      </h4>
                      <p>{viewingProduct.location}</p>
                    </div>
                  )}
                  
                  {viewingProduct.description && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        {t('products.description')}
                      </h4>
                      <p className="text-sm">{viewingProduct.description}</p>
                    </div>
                  )}
                </div>
              </div>
              
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDetailsDialogOpen(false)}
                >
                  {t('common.close')}
                </Button>
                {user?.role === "admin" && (
                  <>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setIsDetailsDialogOpen(false);
                        handleEditProduct(viewingProduct);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      {t('products.editProduct')}
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => {
                        setIsDetailsDialogOpen(false);
                        handleDeleteProduct(viewingProduct.id);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('products.deleteProduct')}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </div>
    );
  }
  
  // Render Shopify UI
  return (
    <div>
      {/* Shopify-like header */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h1 className="font-semibold text-2xl">{t('products.title')}</h1>
            <p className="text-slate-500 mt-1">{t('products.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => {
                setEditingProduct(null);
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
                setImagePreview(null);
                setImageFile(null);
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
                  <Search className="h-4 w-4 text-slate-400" />
                </span>
                <Input
                  placeholder={t('products.searchPlaceholder')}
                  className="pl-10 h-10 bg-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-full md:w-48 h-10 bg-white">
                    <SelectValue placeholder={t('products.stockFilterAll')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('products.stockFilterAll')}</SelectItem>
                    <SelectItem value="in">{t('products.stockFilterIn')}</SelectItem>
                    <SelectItem value="low">{t('products.stockFilterLow')}</SelectItem>
                    <SelectItem value="out">{t('products.stockFilterOut')}</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Tag Filter */}
                {uniqueTags.length > 0 && (
                  <Select 
                    value={tagFilter} 
                    onValueChange={(value) => setTagFilter(value)}
                  >
                    <SelectTrigger className="w-full md:w-48 h-10 bg-white">
                      <SelectValue placeholder={t('products.tagFilterAll')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_tags">{t('products.tagFilterAll')}</SelectItem>
                      {uniqueTags.map(tag => (
                        <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              {/* Export button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 bg-white">
                    <Download className="mr-2 h-4 w-4" />
                    {t('products.export')}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>{t('products.exportFormat')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExportData('csv')}>
                    {t('products.exportCSV')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportData('excel')}>
                    {t('products.exportExcel')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportData('pdf')}>
                    {t('products.exportPDF')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* Active filters display */}
          {(searchQuery || stockFilter !== "all" || tagFilter !== "all_tags") && (
            <div className="mt-4 flex gap-2 flex-wrap">
              <p className="text-sm font-medium text-slate-500 flex items-center">
                {t('products.activeFilters')}:
              </p>
              
              {searchQuery && (
                <Badge variant="outline" className="flex gap-1 items-center py-1 px-3 h-7">
                  <span>{t('products.search')}: {searchQuery}</span>
                  <button 
                    className="ml-1"
                    onClick={() => setSearchQuery("")}
                    aria-label={t('products.removeFilter')}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {stockFilter !== "all" && (
                <Badge variant="outline" className="flex gap-1 items-center py-1 px-3 h-7">
                  <span>
                    {stockFilter === "in" 
                      ? t('products.stockFilterIn') 
                      : stockFilter === "low" 
                        ? t('products.stockFilterLow') 
                        : t('products.stockFilterOut')}
                  </span>
                  <button 
                    className="ml-1"
                    onClick={() => setStockFilter("all")}
                    aria-label={t('products.removeFilter')}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {tagFilter !== "all_tags" && (
                <Badge variant="outline" className="flex gap-1 items-center py-1 px-3 h-7">
                  <span>{t('products.tag')}: {tagFilter}</span>
                  <button 
                    className="ml-1"
                    onClick={() => setTagFilter("all_tags")}
                    aria-label={t('products.removeFilter')}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {(searchQuery || stockFilter !== "all" || tagFilter !== "all_tags") && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-sm font-medium"
                  onClick={() => {
                    setSearchQuery("");
                    setStockFilter("all");
                    setTagFilter("all_tags");
                  }}
                >
                  {t('products.clearFilters')}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Products grid (Shopify style) */}
        <div className="p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center">
                <Loader2 className="h-10 w-10 text-slate-400 mb-2 mx-auto animate-spin" />
                <p className="text-slate-600">{t('products.loading')}</p>
              </div>
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center">
                <Package size={48} className="mx-auto text-slate-300 mb-3" />
                <h3 className="text-lg font-medium mb-1">{t('products.noProducts')}</h3>
                <p className="text-slate-500 mb-4 max-w-md mx-auto">
                  {searchQuery || stockFilter !== "all" || tagFilter !== "all_tags"
                    ? t('products.noProductsMatchingFilters')
                    : t('products.noProductsDescription')
                  }
                </p>
                {searchQuery || stockFilter !== "all" || tagFilter !== "all_tags" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setStockFilter("all");
                      setTagFilter("all_tags");
                    }}
                  >
                    {t('products.clearFilters')}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setEditingProduct(null);
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
                      setImagePreview(null);
                      setImageFile(null);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t('products.addFirstProduct')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-slate-500">
                  {t('products.multipleProductCount', { count: sortedProducts.length })}
                </p>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">{t('products.sortBy')}:</span>
                  <Select value={sortField} onValueChange={setSortField}>
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue placeholder={t('products.sortByName')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">{t('products.sortByName')}</SelectItem>
                      <SelectItem value="sku">{t('products.sortBySku')}</SelectItem>
                      <SelectItem value="currentStock">{t('products.sortByStock')}</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="h-8 w-8"
                    onClick={toggleSortDirection}
                  >
                    {sortDirection === "asc" ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="bg-white rounded-md border border-slate-200">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-3 px-4 text-left font-medium text-slate-700">{t('products.name')}</th>
                      <th className="py-3 px-4 text-left font-medium text-slate-700">{t('products.sku')}</th>
                      <th className="py-3 px-4 text-left font-medium text-slate-700">{t('products.stock')}</th>
                      <th className="py-3 px-4 text-left font-medium text-slate-700 hidden md:table-cell">{t('products.tags')}</th>
                      <th className="py-3 px-4 text-right font-medium text-slate-700">{t('products.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProducts.map((product, index) => (
                      <tr 
                        key={product.id}
                        className={`hover:bg-slate-50 ${index !== sortedProducts.length - 1 ? 'border-b border-slate-200' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0 mr-3 bg-slate-100 rounded overflow-hidden">
                              {product.imagePath ? (
                                <img 
                                  src={product.imagePath} 
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full w-full">
                                  <Box className="h-5 w-5 text-slate-400" />
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{product.name}</div>
                              <div className="text-xs text-slate-500 hidden sm:block">
                                {product.description && product.description.length > 50
                                  ? `${product.description.substring(0, 50)}...`
                                  : product.description}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{product.sku}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            product.currentStock === 0
                              ? 'bg-red-100 text-red-800'
                              : product.currentStock <= product.minStockLevel
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-green-100 text-green-800'
                          }`}>
                            {product.currentStock}
                          </span>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {product.tags && product.tags.length > 0 ? (
                              <>
                                {product.tags.slice(0, 2).map((tag, index) => (
                                  <Badge key={index} variant="outline" className="flex items-center h-5">
                                    <Tag className="mr-1 h-3 w-3" />
                                    {tag}
                                  </Badge>
                                ))}
                                {product.tags.length > 2 && (
                                  <Badge variant="outline" className="h-5">
                                    +{product.tags.length - 2}
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleViewProduct(product)}
                            >
                              <Eye className="h-4 w-4 text-slate-700" />
                            </Button>
                            {user?.role === "admin" && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleEditProduct(product)}
                                >
                                  <Edit className="h-4 w-4 text-slate-700" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleDeleteProduct(product.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Product Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? t('products.editProduct') : t('products.addProduct')}
            </DialogTitle>
            <DialogDescription>
              {editingProduct 
                ? t('products.editProductDescription') 
                : t('products.addProductDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('products.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('products.namePlaceholder')} {...field} />
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
                        <Input placeholder={t('products.skuPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        {t('products.barcode')}
                        <BarcodeScanner
                          onScan={handleBarcodeScanned}
                          trigger={
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 ml-2"
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                          }
                        />
                      </FormLabel>
                      <FormControl>
                        <Input placeholder={t('products.barcodePlaceholder')} {...field} />
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
                      <FormLabel>{t('products.location')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('products.locationPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="currentStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('products.currentStock')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
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
                        <Input type="number" min={0} {...field} />
                      </FormControl>
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
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('products.description')}</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={t('products.descriptionPlaceholder')}
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      {t('products.tags')}
                      <div className="ml-2 inline-flex">
                        <InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
                        <span className="sr-only">{t('products.tagsHelp')}</span>
                      </div>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t('products.tagsPlaceholder')}
                        value={field.value?.join(', ') || ''}
                        onChange={(e) => {
                          // Split by comma and trim whitespace
                          const tags = e.target.value
                            .split(',')
                            .map(tag => tag.trim())
                            .filter(tag => tag !== '');
                          field.onChange(tags);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('products.tagsHelp')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div>
                <FormLabel>{t('products.image')}</FormLabel>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-md p-4 text-center">
                    <div className="space-y-2">
                      <label 
                        htmlFor="image-upload" 
                        className="cursor-pointer inline-flex items-center justify-center px-4 py-2 border border-dashed border-input rounded-md text-sm font-medium bg-background hover:bg-accent"
                      >
                        {t('products.selectImage')}
                        <input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                      </label>
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <InfoIcon className="h-3 w-3" />
                        {t('products.imageRequirements')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="border rounded-md aspect-square flex items-center justify-center overflow-hidden bg-muted/50">
                    {imagePreview ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="object-contain w-full h-full"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur-sm"
                          onClick={() => {
                            setImagePreview(null);
                            setImageFile(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : form.getValues('imagePath') ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={form.getValues('imagePath')} 
                          alt="Current" 
                          className="object-contain w-full h-full"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm p-2 text-xs text-center">
                          {t('products.currentImage')}
                        </div>
                      </div>
                    ) : (
                      <Box className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createProductMutation.isPending || updateProductMutation.isPending}
                >
                  {(createProductMutation.isPending || updateProductMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingProduct ? t('products.saveChanges') : t('products.createProduct')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Product Details Dialog - Shopify Style */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        {viewingProduct && (
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <DialogTitle className="text-xl font-semibold">
                {viewingProduct.name}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {user?.role === "admin" && (
                  <>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsDetailsDialogOpen(false);
                        handleEditProduct(viewingProduct);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      {t('products.editProduct')}
                    </Button>
                    <Button 
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setIsDetailsDialogOpen(false);
                        handleDeleteProduct(viewingProduct.id);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('products.deleteProduct')}
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
              <div className="order-2 md:order-1">
                <div className="flex flex-col gap-4">
                  <div className="aspect-square rounded-md overflow-hidden bg-muted/30 border">
                    {viewingProduct.imagePath ? (
                      <img
                        src={viewingProduct.imagePath}
                        alt={viewingProduct.name}
                        className="object-contain w-full h-full"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Image className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-base">{t('products.inventory')}</CardTitle>
                    </CardHeader>
                    <CardContent className="py-0 px-4 space-y-4">
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-sm text-slate-500">{t('products.sku')}</span>
                        <span className="text-sm font-medium">{viewingProduct.sku}</span>
                      </div>
                      
                      {viewingProduct.barcode && (
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="text-sm text-slate-500">{t('products.barcode')}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{viewingProduct.barcode}</span>
                            <BarcodeGenerator
                              data={viewingProduct.barcode}
                              trigger={
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <QrCode className="h-4 w-4" />
                                </Button>
                              }
                            />
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-sm text-slate-500">{t('products.stockStatus')}</span>
                        <Badge 
                          variant={viewingProduct.currentStock === 0 
                            ? "destructive" 
                            : (viewingProduct.currentStock <= viewingProduct.minStockLevel ? "warning" : "success")}
                          className="text-xs"
                        >
                          {viewingProduct.currentStock === 0
                            ? t('products.outOfStock')
                            : (viewingProduct.currentStock <= viewingProduct.minStockLevel
                              ? t('products.lowStock')
                              : t('products.inStock')
                            )
                          }
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-sm text-slate-500">{t('products.currentStock')}</span>
                        <span className="text-sm font-medium">{viewingProduct.currentStock} {t('products.units')}</span>
                      </div>
                      
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-sm text-slate-500">{t('products.minStockLevel')}</span>
                        <span className="text-sm font-medium">{viewingProduct.minStockLevel} {t('products.units')}</span>
                      </div>
                      
                      {viewingProduct.unitsPerBox && (
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="text-sm text-slate-500">{t('products.unitsPerBox')}</span>
                          <span className="text-sm font-medium">{viewingProduct.unitsPerBox} {t('products.units')}</span>
                        </div>
                      )}
                      
                      {viewingProduct.location && (
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="text-sm text-slate-500">{t('products.location')}</span>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            <span className="text-sm font-medium">{viewingProduct.location}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              <div className="order-1 md:order-2">
                <Tabs defaultValue="info" className="w-full" value={selectedTab} onValueChange={setSelectedTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="info">
                      <InfoIcon className="h-4 w-4 mr-2" />
                      {t('products.productInfo')}
                    </TabsTrigger>
                    <TabsTrigger value="tags">
                      <Tag className="h-4 w-4 mr-2" />
                      {t('products.tags')}
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="info" className="mt-0">
                    <Card>
                      <CardHeader className="py-4 px-6">
                        <CardTitle className="text-lg">{t('products.productDetails')}</CardTitle>
                      </CardHeader>
                      <CardContent className="py-0 px-6">
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-sm font-medium text-slate-900 mb-1">{t('products.name')}</h3>
                            <p className="text-slate-700">{viewingProduct.name}</p>
                          </div>
                          
                          {viewingProduct.description && (
                            <div>
                              <h3 className="text-sm font-medium text-slate-900 mb-1">{t('products.description')}</h3>
                              <p className="text-slate-700 whitespace-pre-line">{viewingProduct.description}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="tags" className="mt-0">
                    <Card>
                      <CardHeader className="py-4 px-6">
                        <CardTitle className="text-lg">{t('products.productTags')}</CardTitle>
                      </CardHeader>
                      <CardContent className="py-0 px-6">
                        {viewingProduct.tags && viewingProduct.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {viewingProduct.tags.map(tag => (
                              <Badge key={tag} className="py-1 px-3">
                                <Tag className="mr-2 h-3 w-3" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <Tag className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-500">{t('products.noTags')}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
            
            <DialogFooter className="mt-6 gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsDetailsDialogOpen(false)}
              >
                {t('common.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}