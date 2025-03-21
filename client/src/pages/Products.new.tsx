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
  Loader2, PackageCheck, PlusCircle, QrCode, Search, SlidersHorizontal, Trash2, X,
  Info as InfoIcon, Tag
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
      
      // If there's an image file, don't send it via JSON
      // The server expects multipart form data for file uploads
      if (imageFile) {
        const formData = new FormData();
        
        // Add all product data fields to the form
        Object.entries(productData).forEach(([key, value]) => {
          if (key !== 'imagePath' && value !== undefined) {
            if (key === 'tags') {
