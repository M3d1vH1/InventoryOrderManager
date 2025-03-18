import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/use-toast'; 
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/queryClient";
import { useSidebar } from "@/context/SidebarContext";
import { exportData } from "@/lib/utils";
import { Link } from "wouter";
import JsBarcode from "jsbarcode";
import BarcodeScanner from "@/components/barcode/BarcodeScanner";
import BarcodeGenerator from "@/components/barcode/BarcodeGenerator";
import {
  ArrowDown,
  ArrowUp,
  Box,
  ChevronDown,
  Download,
  Edit,
  Filter,
  ImageIcon,
  Loader2,
  MapPin,
  MoreHorizontal,
  PackageCheck,
  PackagePlus,
  PlusCircle,
  QrCode,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";


interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  description?: string;
  minStockLevel: number;
  currentStock: number;
  location?: string;
  unitsPerBox?: number;
  imagePath?: string;
}

const productFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  sku: z.string().min(2, "SKU must be at least 2 characters"),
  barcode: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  minStockLevel: z.coerce.number().min(0, "Min stock level must be 0 or greater"),
  currentStock: z.coerce.number().min(0, "Current stock must be 0 or greater"),
  location: z.string().optional(),
  unitsPerBox: z.coerce.number().min(1, "Units per box must be at least 1").optional(),
  imagePath: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

const Products = () => {
  const { t } = useTranslation();
  const { setCurrentPage } = useSidebar();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      category: "",
      description: "",
      minStockLevel: 5,
      currentStock: 0,
      location: "",
      unitsPerBox: 1,
      imagePath: "",
    },
  });
  const { data: products = [] as Product[], isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
    staleTime: 15000,
  });
  const { data: categories = [] as string[] } = useQuery<string[]>({
    queryKey: ['/api/products/categories'],
    staleTime: Infinity,
    initialData: ["Electronics", "Clothing", "Food & Beverage", "Furniture", "Books", "Other"],
  });
  const [filteredProducts, setFilteredProducts] = useState(products);

  useEffect(() => {
    setCurrentPage("Products");
  }, [setCurrentPage]);

  useEffect(() => {
    if (editingProduct) {
      form.reset({
        name: editingProduct.name,
        sku: editingProduct.sku,
        barcode: editingProduct.barcode || "",
        category: editingProduct.category,
        description: editingProduct.description || "",
        minStockLevel: editingProduct.minStockLevel,
        currentStock: editingProduct.currentStock,
        location: editingProduct.location || "",
        unitsPerBox: editingProduct.unitsPerBox || 1,
        imagePath: editingProduct.imagePath || "",
      });
    }
  }, [editingProduct, form]);

  useEffect(() => {
    setFilteredProducts(products.filter(product => 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.barcode && product.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
    ));
  }, [searchQuery, products]);

  const createProductMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      return apiRequest({
        url: '/api/products',
        method: 'POST',
        body: JSON.stringify(values)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Product created",
        description: "The product has been created successfully.",
      });
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
      return apiRequest({
        url: `/api/products/${id}`,
        method: 'PATCH',
        body: JSON.stringify(values)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      form.reset();
      toast({
        title: "Product updated",
        description: "The product has been updated successfully.",
      });
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
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Product deleted",
        description: "The product has been deleted successfully.",
      });
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

  const handleViewProduct = (product: Product) => {
    setViewingProduct(product);
    setIsDetailsDialogOpen(true);
  };

  const handleDeleteProduct = (id: number) => {
    if (window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
      deleteProductMutation.mutate(id);
    }
  };
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  const handleExportData = (format: string) => {
    const productsForExport = products.map((product: Product) => ({
      Name: product.name,
      SKU: product.sku,
      Barcode: product.barcode || "N/A",
      Category: product.category,
      "Min Stock": product.minStockLevel,
      "Current Stock": product.currentStock,
      Location: product.location || "N/A",
      "Units/Box": product.unitsPerBox || "N/A",
    }));
    exportData(productsForExport, format, "Products_Export");
  };
  const handleBarcodeScanned = (barcode: string) => {
    form.setValue("barcode", barcode);
    toast({
      title: "Barcode Scanned",
      description: `Successfully scanned barcode: ${barcode}`,
    });
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    form.reset({
      name: "",
      sku: "",
      barcode: "",
      category: "",
      description: "",
      minStockLevel: 5,
      currentStock: 0,
      location: "",
      unitsPerBox: 1,
      imagePath: "",
    });
    setIsDialogOpen(true);
  };

  const getStockStatusClass = (currentStock: number, minStockLevel: number) => {
    if (currentStock === 0) return "text-red-600";
    if (currentStock <= minStockLevel) return "text-amber-600";
    return "text-green-600";
  };

  return (
    <div className="container mx-auto py-6">
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h1 className="font-semibold text-2xl">{t('products.title')}</h1>
            <p className="text-slate-500 mt-1">{t('products.subtitle')}</p>
          </div>
          <Button 
            onClick={handleNewProduct}
            className="flex items-center gap-1"
          >
            <PlusCircle className="h-4 w-4" />
            {t('products.addProduct')}
          </Button>
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
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder={t('products.allCategories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('products.allCategories')}</SelectItem>
                  {categories.map((category: string) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                {searchQuery || categoryFilter !== "all" || stockFilter !== "all" ? (
                  t('products.tryClearingFilters')
                ) : (
                  t('products.createFirstProduct')
                )}
              </p>
              {!searchQuery && categoryFilter === "all" && stockFilter === "all" && (
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
                        onClick={() => handleSort("category")}
                      >
                        <div className="flex items-center">
                          {t('products.category')}
                          {sortField === "category" && (
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
                    {filteredProducts.map((product: Product) => (
                      <tr 
                        key={product.id} 
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => handleViewProduct(product)}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0 rounded bg-slate-100 flex items-center justify-center">
                              {product.imagePath ? (
                                <img 
                                  src={product.imagePath} 
                                  alt={product.name} 
                                  className="h-10 w-10 object-cover rounded"
                                />
                              ) : (
                                <Box className="h-5 w-5 text-slate-400" />
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-slate-900">{product.name}</div>
                              {product.barcode && (
                                <div className="text-xs text-slate-500">
                                  <QrCode className="h-3 w-3 inline-block mr-1" />
                                  {product.barcode}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">
                          {product.sku}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">
                          {product.category}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${getStockStatusClass(product.currentStock, product.minStockLevel)}`}>
                            {product.currentStock} 
                            <span className="text-slate-400 ml-1">/ {product.minStockLevel} min</span>
                          </div>
                          {product.location && (
                            <div className="text-xs text-slate-500">
                              <MapPin className="h-3 w-3 inline-block mr-1" />
                              {product.location}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditProduct(product);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">{t('products.edit')}</span>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProduct(product.id);
                              }}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">{t('products.delete')}</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-center text-sm text-slate-500">
                {t('products.showing', { count: filteredProducts.length, total: products.length })}
              </div>
            </>
          )}
        </div>
      </div>

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
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <div className="flex flex-col items-center justify-center py-4 border-2 border-dashed rounded-md border-slate-300 bg-white mb-4">
                        <div className="mb-2">
                          {imagePreview ? (
                            <img
                              src={imagePreview}
                              alt="Product preview"
                              className="w-28 h-28 object-contain"
                            />
                          ) : editingProduct?.imagePath ? (
                            <img
                              src={editingProduct.imagePath}
                              alt="Product preview"
                              className="w-28 h-28 object-contain"
                            />
                          ) : (
                            <ImageIcon className="w-12 h-12 text-slate-300" />
                          )}
                        </div>
                        <div className="space-y-1 text-center">
                          <Button type="button" variant="outline" size="sm" asChild>
                            <label className="cursor-pointer">
                              <Upload className="h-4 w-4 mr-1 inline-block" />
                              {t('products.uploadImage')}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageChange}
                              />
                            </label>
                          </Button>
                          <p className="text-xs text-slate-500">{t('products.imageSize')}</p>
                        </div>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="w-2/3 max-h-[80vh] overflow-y-auto">
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
                      render={({ field }: { field: any }) => (
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
                      render={({ field }: { field: any }) => (
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
                      name="category"
                      render={({ field }: { field: any }) => (
                        <FormItem>
                          <FormLabel>{t('products.category')}</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('products.selectCategory')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((category: string) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2 items-start">
                      <FormField
                        control={form.control}
                        name="barcode"
                        render={({ field }: { field: any }) => (
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
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }: { field: any }) => (
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
                      render={({ field }: { field: any }) => (
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
                      render={({ field }: { field: any }) => (
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
                      render={({ field }: { field: any }) => (
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
                      render={({ field }: { field: any }) => (
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

      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-auto">
          {viewingProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">{viewingProduct.name}</DialogTitle>
                <DialogDescription>
                  <span className="font-medium">{t('products.sku')}:</span> {viewingProduct.sku} • <span className="font-medium">{t('products.category')}:</span> {viewingProduct.category}
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
                            <h4 className="text-sm font-medium text-slate-500">{t('products.description')}</h4>
                            <p className="mt-1">{viewingProduct.description || t('products.noDescription')}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-medium text-slate-500">{t('products.currentStock')}</h4>
                              <p className={`text-xl font-bold ${getStockStatusClass(viewingProduct.currentStock, viewingProduct.minStockLevel)}`}>
                                {viewingProduct.currentStock}
                              </p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-slate-500">{t('products.minStockLevel')}</h4>
                              <p className="text-xl font-bold text-slate-700">{viewingProduct.minStockLevel}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-medium text-slate-500">{t('products.storageLocation')}</h4>
                              <p className="text-slate-700">{viewingProduct.location || t('products.notSpecified')}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-slate-500">{t('products.unitsPerBox')}</h4>
                              <p className="text-slate-700">{viewingProduct.unitsPerBox || t('products.notSpecified')}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setIsDetailsDialogOpen(false);
                          handleEditProduct(viewingProduct);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        {t('products.updateInventory')}
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
                <TabsContent value="barcode">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('products.productBarcode')}</CardTitle>
                      <CardDescription>{t('products.scanOrPrint')}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center py-6">
                      {viewingProduct.barcode ? (
                        <div className="text-center">
                          <BarcodeGenerator 
                            value={viewingProduct.barcode}
                            width={2}
                            height={100}
                            displayValue={true}
                            showPrintButton={true}
                            showDownloadButton={true}
                          />
                          <p className="mt-4 text-sm text-slate-500">{t('products.barcode')}: {viewingProduct.barcode}</p>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <QrCode className="h-16 w-16 text-slate-300 mx-auto" />
                          <p className="mt-4 text-slate-500">{t('products.noBarcode')}</p>
                          <Button 
                            variant="outline" 
                            className="mt-4"
                            onClick={() => {
                              setIsDetailsDialogOpen(false);
                              handleEditProduct(viewingProduct);
                            }}
                          >
                            {t('products.assignBarcode')}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
              <DialogFooter className="mt-4 gap-2">
                <Button 
                  variant="default" 
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
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;