import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/context/SidebarContext';
import ProductPredictionDashboard from '@/components/inventory/ProductPredictionDashboard';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import {
  AlertCircle,
  BarChart3,
  BarChart4,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileText,
  Filter,
  HelpCircle,
  LineChart,
  ListFilter,
  Loader2,
  PackageSearch,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Undo2,
} from 'lucide-react';

// Types
interface InventoryPrediction {
  id: number;
  productId: number;
  productName: string;
  generatedAt: string;
  predictionMethod: 'moving_average' | 'linear_regression' | 'seasonal_adjustment' | 'weighted_average' | 'manual';
  predictedDemand: number;
  confidenceLevel: number;
  accuracy: 'low' | 'medium' | 'high';
  predictedStockoutDate: string | null;
  recommendedReorderDate: string | null;
  recommendedQuantity: number | null;
  currentStock: number;
  notes: string | null;
}

// Form schema for creating/editing predictions
const inventoryPredictionSchema = z.object({
  productId: z.number({
    required_error: "Product is required",
  }),
  predictionMethod: z.enum(['moving_average', 'linear_regression', 'seasonal_adjustment', 'weighted_average', 'manual'], {
    required_error: "Prediction method is required",
  }),
  predictedDemand: z.number({
    required_error: "Predicted demand is required",
  }).min(0, {
    message: "Predicted demand must be 0 or higher",
  }),
  confidenceLevel: z.number({
    required_error: "Confidence level is required",
  }).min(0, {
    message: "Confidence level must be between 0 and 100",
  }).max(100, {
    message: "Confidence level must be between 0 and 100",
  }),
  accuracy: z.enum(['low', 'medium', 'high'], {
    required_error: "Accuracy is required",
  }),
  predictedStockoutDate: z.date().nullable().optional(),
  recommendedReorderDate: z.date().nullable().optional(),
  recommendedQuantity: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

type PredictionFormValues = z.infer<typeof inventoryPredictionSchema>;

interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  description?: string;
  minStockLevel: number;
  currentStock: number;
  price?: number;
}

const InventoryPredictions: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { setCurrentPage } = useSidebar();
  const queryClient = useQueryClient();
  
  // State
  const [activeTab, setActiveTab] = useState<string>("existing");
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [predictionMethod, setPredictionMethod] = useState<string>("moving_average");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingPrediction, setEditingPrediction] = useState<InventoryPrediction | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [selectedProductForDashboard, setSelectedProductForDashboard] = useState<number | null>(null);
  
  // Queries
  const { data: predictions = [], isLoading: isLoadingPredictions, refetch: refetchPredictions } = useQuery<InventoryPrediction[]>({
    queryKey: ['/api/inventory-predictions'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/inventory-predictions');
        if (!response.ok) {
          throw new Error('Failed to fetch inventory predictions');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching predictions:', error);
        return [];
      }
    }
  });
  
  const { data: products = [], isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ['/api/products'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/products');
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const data = await response.json();
        // Handle API response structure: { success: true, data: [...] }
        if (data && typeof data === 'object' && 'data' in data) {
          return Array.isArray(data.data) ? data.data : [];
        }
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching products:', error);
        return [];
      }
    }
  });
  
  const { data: productsRequiringReorder = [], isLoading: isLoadingReorderProducts } = useQuery<InventoryPrediction[]>({
    queryKey: ['/api/inventory-predictions/reorder-required'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/inventory-predictions/reorder-required');
        if (!response.ok) {
          throw new Error('Failed to fetch products requiring reorder');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching reorder data:', error);
        return [];
      }
    }
  });
  
  // Mutations
  const generatePredictionsMutation = useMutation({
    mutationFn: async (method: string) => {
      const response = await fetch(`/api/inventory-predictions/generate?method=${method}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to generate predictions');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory-predictions/reorder-required'] });
      toast({
        title: t('inventoryPredictions.generateSuccess'),
        description: t('inventoryPredictions.generateSuccessDescription'),
      });
      setIsGenerating(false);
    },
    onError: (error) => {
      toast({
        title: t('inventoryPredictions.generateError'),
        description: error.message,
        variant: 'destructive',
      });
      setIsGenerating(false);
    }
  });
  
  const deletePredictionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/inventory-predictions/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete prediction');
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory-predictions/reorder-required'] });
      toast({
        title: t('inventoryPredictions.deleteSuccess'),
        description: t('inventoryPredictions.deleteSuccessDescription'),
      });
      setConfirmDeleteId(null);
    },
    onError: (error) => {
      toast({
        title: t('inventoryPredictions.deleteError'),
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Set page title
  React.useEffect(() => {
    setCurrentPage(t('inventoryPredictions.title'));
  }, [setCurrentPage, t]);
  
  // Form for creating/editing predictions
  const form = useForm<PredictionFormValues>({
    resolver: zodResolver(inventoryPredictionSchema),
    defaultValues: editingPrediction ? {
      productId: editingPrediction.productId,
      predictionMethod: editingPrediction.predictionMethod,
      predictedDemand: editingPrediction.predictedDemand,
      confidenceLevel: editingPrediction.confidenceLevel,
      accuracy: editingPrediction.accuracy,
      recommendedQuantity: editingPrediction.recommendedQuantity || undefined,
      notes: editingPrediction.notes || undefined,
      predictedStockoutDate: editingPrediction.predictedStockoutDate ? new Date(editingPrediction.predictedStockoutDate) : undefined,
      recommendedReorderDate: editingPrediction.recommendedReorderDate ? new Date(editingPrediction.recommendedReorderDate) : undefined,
    } : {
      productId: 0,
      predictionMethod: 'moving_average',
      predictedDemand: 0,
      confidenceLevel: 70,
      accuracy: 'medium',
      recommendedQuantity: null,
      notes: null,
      predictedStockoutDate: null,
      recommendedReorderDate: null,
    }
  });
  
  React.useEffect(() => {
    if (editingPrediction) {
      form.reset({
        productId: editingPrediction.productId,
        predictionMethod: editingPrediction.predictionMethod,
        predictedDemand: editingPrediction.predictedDemand,
        confidenceLevel: editingPrediction.confidenceLevel,
        accuracy: editingPrediction.accuracy,
        recommendedQuantity: editingPrediction.recommendedQuantity || undefined,
        notes: editingPrediction.notes || undefined,
        predictedStockoutDate: editingPrediction.predictedStockoutDate ? new Date(editingPrediction.predictedStockoutDate) : undefined,
        recommendedReorderDate: editingPrediction.recommendedReorderDate ? new Date(editingPrediction.recommendedReorderDate) : undefined,
      });
    } else {
      form.reset({
        productId: 0,
        predictionMethod: 'moving_average',
        predictedDemand: 0,
        confidenceLevel: 70,
        accuracy: 'medium',
        recommendedQuantity: null,
        notes: null,
        predictedStockoutDate: null,
        recommendedReorderDate: null,
      });
    }
  }, [editingPrediction, form]);
  
  // Filtered predictions based on search query and selected product
  const filteredPredictions = useMemo(() => {
    let filtered = [...predictions];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(prediction => 
        prediction.productName.toLowerCase().includes(query)
      );
    }
    
    if (selectedProduct) {
      filtered = filtered.filter(prediction => prediction.productId === selectedProduct);
    }
    
    return filtered;
  }, [predictions, searchQuery, selectedProduct]);
  
  // Sort products by name for dropdown
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);
  
  // Handle form submission
  const onSubmit = async (values: PredictionFormValues) => {
    try {
      if (editingPrediction) {
        // Update existing prediction
        const response = await fetch(`/api/inventory-predictions/${editingPrediction.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...values,
            predictedStockoutDate: values.predictedStockoutDate ? format(values.predictedStockoutDate, 'yyyy-MM-dd') : null,
            recommendedReorderDate: values.recommendedReorderDate ? format(values.recommendedReorderDate, 'yyyy-MM-dd') : null,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update prediction');
        }
        
        toast({
          title: t('inventoryPredictions.updateSuccess'),
          description: t('inventoryPredictions.updateSuccessDescription'),
        });
      } else {
        // Create new prediction
        const response = await fetch('/api/inventory-predictions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...values,
            predictedStockoutDate: values.predictedStockoutDate ? format(values.predictedStockoutDate, 'yyyy-MM-dd') : null,
            recommendedReorderDate: values.recommendedReorderDate ? format(values.recommendedReorderDate, 'yyyy-MM-dd') : null,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to create prediction');
        }
        
        toast({
          title: t('inventoryPredictions.createSuccess'),
          description: t('inventoryPredictions.createSuccessDescription'),
        });
      }
      
      // Refresh data and close form
      queryClient.invalidateQueries({ queryKey: ['/api/inventory-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory-predictions/reorder-required'] });
      setIsFormOpen(false);
      setEditingPrediction(null);
    } catch (error) {
      console.error('Error saving prediction:', error);
      toast({
        title: t('common.error'),
        description: t('inventoryPredictions.saveError'),
        variant: 'destructive',
      });
    }
  };
  
  // Format date based on locale
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    
    try {
      const date = new Date(dateStr);
      return format(date, 'PP', { locale: i18n.language === 'el' ? el : undefined });
    } catch (e) {
      return dateStr;
    }
  };
  
  // Handle generating predictions
  const handleGeneratePredictions = () => {
    setIsGenerating(true);
    generatePredictionsMutation.mutate(predictionMethod);
  };
  
  // Get confidence level color
  const getConfidenceLevelColor = (level: number) => {
    if (level >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (level >= 60) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (level >= 40) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };
  
  // Get accuracy badge color
  const getAccuracyBadgeColor = (accuracy: string) => {
    switch (accuracy) {
      case 'high':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };
  
  // Handle view for product prediction dashboard
  const handleViewProductDashboard = (productId: number) => {
    setSelectedProductForDashboard(productId);
  };

  // Handle back from product dashboard
  const handleBackFromDashboard = () => {
    setSelectedProductForDashboard(null);
  };

  return (
    <div className="space-y-4">
      {selectedProductForDashboard ? (
        <ProductPredictionDashboard 
          productId={selectedProductForDashboard}
          onBack={handleBackFromDashboard}
        />
      ) : (
        <>
          {/* Page Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {t('inventoryPredictions.title')}
              </h1>
              <p className="text-muted-foreground">
                {t('inventoryPredictions.description')}
              </p>
            </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-4 lg:mt-0">
          <Select value={predictionMethod} onValueChange={setPredictionMethod}>
            <SelectTrigger className="w-full sm:w-auto">
              <SelectValue placeholder={t('inventoryPredictions.selectMethod')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="moving_average">{t('inventoryPredictions.methods.movingAverage')}</SelectItem>
              <SelectItem value="linear_regression">{t('inventoryPredictions.methods.linearRegression')}</SelectItem>
              <SelectItem value="seasonal_adjustment">{t('inventoryPredictions.methods.seasonalAdjustment')}</SelectItem>
              <SelectItem value="weighted_average">{t('inventoryPredictions.methods.weightedAverage')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleGeneratePredictions} 
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4 mr-2" />
            )}
            {t('inventoryPredictions.generatePredictions')}
          </Button>
          <Button onClick={() => {
            setEditingPrediction(null);
            setIsFormOpen(true);
          }} className="gap-2">
            <Plus className="h-4 w-4 mr-2" />
            {t('inventoryPredictions.addManually')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="existing" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="existing">
            <FileText className="h-4 w-4 mr-2" />
            {t('inventoryPredictions.existingPredictions')}
          </TabsTrigger>
          <TabsTrigger value="reorder">
            <PackageSearch className="h-4 w-4 mr-2" />
            {t('inventoryPredictions.reorderRequired')}
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart4 className="h-4 w-4 mr-2" />
            {t('inventoryPredictions.statistics')}
          </TabsTrigger>
          <TabsTrigger value="howItWorks">
            <HelpCircle className="h-4 w-4 mr-2" />
            {t('inventoryPredictions.howItWorks.title')}
          </TabsTrigger>
        </TabsList>
        
        {/* Existing Predictions Tab */}
        <TabsContent value="existing" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <CardTitle>{t('inventoryPredictions.allPredictions')}</CardTitle>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder={t('common.search')}
                      className="w-full sm:w-[200px] pl-9 pr-4"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select
                    value={selectedProduct ? selectedProduct.toString() : "all"}
                    onValueChange={(value) => 
                      setSelectedProduct(value === "all" ? null : parseInt(value, 10))
                    }
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder={t('inventoryPredictions.filterByProduct')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t('common.all')}
                      </SelectItem>
                      {sortedProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingPredictions ? (
                <div className="py-10 text-center">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">{t('common.loading')}</p>
                </div>
              ) : filteredPredictions.length === 0 ? (
                <div className="py-10 text-center border rounded-md">
                  <p className="text-muted-foreground">{t('inventoryPredictions.noPredictions')}</p>
                  <Button
                    variant="outline"
                    className="mt-4 gap-2"
                    onClick={handleGeneratePredictions}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-4 w-4 mr-2" />
                    )}
                    {t('inventoryPredictions.generatePredictions')}
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('inventoryPredictions.product')}</TableHead>
                        <TableHead>{t('inventoryPredictions.method')}</TableHead>
                        <TableHead className="text-right">{t('inventoryPredictions.predictedDemand')}</TableHead>
                        <TableHead className="text-center">{t('inventoryPredictions.confidence')}</TableHead>
                        <TableHead className="text-center">{t('inventoryPredictions.accuracy')}</TableHead>
                        <TableHead>{t('inventoryPredictions.predictedStockoutDate')}</TableHead>
                        <TableHead className="text-right">{t('common.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPredictions.map((prediction) => (
                        <TableRow key={prediction.id}>
                          <TableCell className="font-medium">{prediction.productName}</TableCell>
                          <TableCell>
                            {t(`inventoryPredictions.methods.${prediction.predictionMethod === 'moving_average' ? 'movingAverage' : 
                                prediction.predictionMethod === 'linear_regression' ? 'linearRegression' : 
                                prediction.predictionMethod === 'seasonal_adjustment' ? 'seasonalAdjustment' : 
                                prediction.predictionMethod === 'weighted_average' ? 'weightedAverage' : 'manual'}`)}
                          </TableCell>
                          <TableCell className="text-right">
                            {prediction.predictedDemand}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant="outline" 
                              className={getConfidenceLevelColor(prediction.confidenceLevel)}
                            >
                              {prediction.confidenceLevel}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant="outline" 
                              className={getAccuracyBadgeColor(prediction.accuracy)}
                            >
                              {t(`inventoryPredictions.accuracyLevels.${prediction.accuracy}`)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {prediction.predictedStockoutDate 
                              ? formatDate(prediction.predictedStockoutDate)
                              : '—'
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewProductDashboard(prediction.productId)}
                                title={t('inventoryPredictions.viewDashboard')}
                              >
                                <BarChart3 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingPrediction(prediction);
                                  setIsFormOpen(true);
                                }}
                                title={t('common.edit')}
                              >
                                <Settings2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDeleteId(prediction.id)}
                                title={t('common.delete')}
                                className="text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t px-6 py-3">
              <div className="text-sm text-muted-foreground">
                {filteredPredictions.length > 0 
                  ? t('inventoryPredictions.showingCount', { count: filteredPredictions.length, total: predictions.length })
                  : ''
                }
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Reorder Required Tab */}
        <TabsContent value="reorder" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('inventoryPredictions.reorderRequired')}</CardTitle>
              <CardDescription>
                {t('inventoryPredictions.reorderRequiredDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingReorderProducts ? (
                <div className="py-10 text-center">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">{t('common.loading')}</p>
                </div>
              ) : productsRequiringReorder.length === 0 ? (
                <div className="py-10 text-center border rounded-md">
                  <p className="text-muted-foreground">{t('inventoryPredictions.noReorderRequired')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('inventoryPredictions.product')}</TableHead>
                        <TableHead className="text-right">{t('inventoryPredictions.currentStock')}</TableHead>
                        <TableHead className="text-right">{t('inventoryPredictions.predictedDemand')}</TableHead>
                        <TableHead className="text-center">{t('inventoryPredictions.confidence')}</TableHead>
                        <TableHead>{t('inventoryPredictions.stockoutDate')}</TableHead>
                        <TableHead>{t('inventoryPredictions.recommendedReorderDate')}</TableHead>
                        <TableHead className="text-right">{t('inventoryPredictions.recommendedQuantity')}</TableHead>
                        <TableHead className="text-right">{t('common.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productsRequiringReorder.map((prediction) => (
                        <TableRow key={prediction.id}>
                          <TableCell className="font-medium">{prediction.productName}</TableCell>
                          <TableCell className="text-right">
                            {prediction.currentStock}
                          </TableCell>
                          <TableCell className="text-right">
                            {prediction.predictedDemand}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant="outline" 
                              className={getConfidenceLevelColor(prediction.confidenceLevel)}
                            >
                              {prediction.confidenceLevel}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {prediction.predictedStockoutDate 
                              ? formatDate(prediction.predictedStockoutDate)
                              : '—'
                            }
                          </TableCell>
                          <TableCell>
                            {prediction.recommendedReorderDate 
                              ? formatDate(prediction.recommendedReorderDate)
                              : '—'
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            {prediction.recommendedQuantity || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewProductDashboard(prediction.productId)}
                              title={t('inventoryPredictions.viewDashboard')}
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('inventoryPredictions.methodsUsed')}</CardTitle>
              </CardHeader>
              <CardContent className="pb-8">
                {isLoadingPredictions ? (
                  <div className="py-10 text-center">
                    <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                  </div>
                ) : predictions.length === 0 ? (
                  <div className="py-10 text-center border rounded-md">
                    <p className="text-muted-foreground">{t('inventoryPredictions.noPredictions')}</p>
                  </div>
                ) : (
                  <div className="relative h-60">
                    {/* In a real implementation, this would be a pie chart or bar chart */}
                    <div className="flex flex-col gap-4">
                      {Object.entries(
                        predictions.reduce((acc, prediction) => {
                          // Get the proper method name translation with correct mapping
                          const methodKey = prediction.predictionMethod === 'moving_average' ? 'movingAverage' : 
                                            prediction.predictionMethod === 'linear_regression' ? 'linearRegression' : 
                                            prediction.predictionMethod === 'seasonal_adjustment' ? 'seasonalAdjustment' : 
                                            prediction.predictionMethod === 'weighted_average' ? 'weightedAverage' : 'manual';
                          const method = t(`inventoryPredictions.methods.${methodKey}`);
                          acc[method] = (acc[method] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([method, count], index) => (
                        <div key={method} className="flex items-center">
                          <div 
                            className="w-4 h-4 rounded-full mr-2"
                            style={{ backgroundColor: `hsl(${index * 30}, 70%, 50%)` }}
                          />
                          <span className="text-sm flex-1">{method}</span>
                          <span className="text-sm font-medium">{count}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({Math.round((count / predictions.length) * 100)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{t('inventoryPredictions.accuracyDistribution')}</CardTitle>
              </CardHeader>
              <CardContent className="pb-8">
                {isLoadingPredictions ? (
                  <div className="py-10 text-center">
                    <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                  </div>
                ) : predictions.length === 0 ? (
                  <div className="py-10 text-center border rounded-md">
                    <p className="text-muted-foreground">{t('inventoryPredictions.noPredictions')}</p>
                  </div>
                ) : (
                  <div className="relative h-60">
                    {/* In a real implementation, this would be a pie chart or bar chart */}
                    <div className="flex flex-col gap-4">
                      {(['high', 'medium', 'low'] as const).map((accuracy, index) => {
                        const count = predictions.filter(p => p.accuracy === accuracy).length;
                        return (
                          <div key={accuracy} className="flex items-center">
                            <div 
                              className={`w-4 h-4 rounded-full mr-2 ${
                                accuracy === 'high' ? 'bg-green-500' :
                                accuracy === 'medium' ? 'bg-blue-500' :
                                'bg-amber-500'
                              }`}
                            />
                            <span className="text-sm flex-1">
                              {t(`inventoryPredictions.accuracyLevels.${accuracy}`)}
                            </span>
                            <span className="text-sm font-medium">{count}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({predictions.length > 0 ? Math.round((count / predictions.length) * 100) : 0}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t('inventoryPredictions.predictionsSummary')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">
                      {t('inventoryPredictions.totalPredictions')}
                    </div>
                    <div className="text-2xl font-bold">
                      {predictions.length}
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">
                      {t('inventoryPredictions.reorderRequired')}
                    </div>
                    <div className="text-2xl font-bold">
                      {productsRequiringReorder.length}
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">
                      {t('inventoryPredictions.avgConfidence')}
                    </div>
                    <div className="text-2xl font-bold">
                      {predictions.length > 0
                        ? Math.round(
                            predictions.reduce((sum, p) => sum + p.confidenceLevel, 0) / predictions.length
                          )
                        : 0}%
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">
                      {t('inventoryPredictions.productsTracked')}
                    </div>
                    <div className="text-2xl font-bold">
                      {new Set(predictions.map(p => p.productId)).size}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('inventoryPredictions.outOf', { total: products.length })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* How It Works Tab */}
        <TabsContent value="howItWorks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('inventoryPredictions.howItWorks.title')}</CardTitle>
              <CardDescription>
                {t('inventoryPredictions.howItWorks.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Moving Average Method */}
                  <div className="bg-slate-50 p-6 rounded-lg">
                    <div className="flex items-center mb-3">
                      <div className="bg-blue-100 p-2 rounded-full mr-3">
                        <TrendingUp className="h-5 w-5 text-blue-700" />
                      </div>
                      <h3 className="text-lg font-medium">
                        {t('inventoryPredictions.methods.movingAverage')}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('inventoryPredictions.howItWorks.movingAverage')}
                    </p>
                  </div>
                  
                  {/* Linear Regression Method */}
                  <div className="bg-slate-50 p-6 rounded-lg">
                    <div className="flex items-center mb-3">
                      <div className="bg-green-100 p-2 rounded-full mr-3">
                        <LineChart className="h-5 w-5 text-green-700" />
                      </div>
                      <h3 className="text-lg font-medium">
                        {t('inventoryPredictions.methods.linearRegression')}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('inventoryPredictions.howItWorks.linearRegression')}
                    </p>
                  </div>
                  
                  {/* Seasonal Adjustment Method */}
                  <div className="bg-slate-50 p-6 rounded-lg">
                    <div className="flex items-center mb-3">
                      <div className="bg-amber-100 p-2 rounded-full mr-3">
                        <Calendar className="h-5 w-5 text-amber-700" />
                      </div>
                      <h3 className="text-lg font-medium">
                        {t('inventoryPredictions.methods.seasonalAdjustment')}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('inventoryPredictions.howItWorks.seasonalAdjustment')}
                    </p>
                  </div>
                  
                  {/* Weighted Average Method */}
                  <div className="bg-slate-50 p-6 rounded-lg">
                    <div className="flex items-center mb-3">
                      <div className="bg-purple-100 p-2 rounded-full mr-3">
                        <BarChart4 className="h-5 w-5 text-purple-700" />
                      </div>
                      <h3 className="text-lg font-medium">
                        {t('inventoryPredictions.methods.weightedAverage')}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('inventoryPredictions.howItWorks.weightedAverage')}
                    </p>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-6">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-blue-700 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900 mb-1">
                        {t('common.note')}
                      </h4>
                      <p className="text-sm text-blue-700">
                        {t('inventoryPredictions.generateSuccess')} {t('inventoryPredictions.generateSuccessDescription')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Create/Edit Prediction Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingPrediction 
                ? t('inventoryPredictions.editPrediction') 
                : t('inventoryPredictions.createPrediction')
              }
            </DialogTitle>
            <DialogDescription>
              {t('inventoryPredictions.formDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Product Selection */}
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('inventoryPredictions.product')}</FormLabel>
                    <Select
                      disabled={!!editingPrediction}
                      value={field.value.toString()}
                      onValueChange={(value) => field.onChange(parseInt(value, 10))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('inventoryPredictions.selectProduct')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sortedProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Prediction Method */}
              <FormField
                control={form.control}
                name="predictionMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('inventoryPredictions.predictionMethod')}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('inventoryPredictions.selectMethod')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="moving_average">
                          {t('inventoryPredictions.methods.movingAverage')}
                        </SelectItem>
                        <SelectItem value="linear_regression">
                          {t('inventoryPredictions.methods.linearRegression')}
                        </SelectItem>
                        <SelectItem value="seasonal_adjustment">
                          {t('inventoryPredictions.methods.seasonalAdjustment')}
                        </SelectItem>
                        <SelectItem value="weighted_average">
                          {t('inventoryPredictions.methods.weightedAverage')}
                        </SelectItem>
                        <SelectItem value="manual">
                          {t('inventoryPredictions.methods.manual')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                {/* Predicted Demand */}
                <FormField
                  control={form.control}
                  name="predictedDemand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('inventoryPredictions.predictedDemand')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Confidence Level */}
                <FormField
                  control={form.control}
                  name="confidenceLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('inventoryPredictions.confidence')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('inventoryPredictions.confidenceDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Accuracy */}
              <FormField
                control={form.control}
                name="accuracy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('inventoryPredictions.accuracy')}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('inventoryPredictions.selectAccuracy')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="high">{t('inventoryPredictions.accuracyLevels.high')}</SelectItem>
                        <SelectItem value="medium">{t('inventoryPredictions.accuracyLevels.medium')}</SelectItem>
                        <SelectItem value="low">{t('inventoryPredictions.accuracyLevels.low')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                {/* Recommended Quantity */}
                <FormField
                  control={form.control}
                  name="recommendedQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('inventoryPredictions.recommendedQuantity')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          value={field.value !== null ? field.value : ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? null : parseInt(e.target.value, 10);
                            field.onChange(value);
                          }}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.notes')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('inventoryPredictions.notesPlaceholder')}
                        className="resize-none"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit">
                  {editingPrediction ? t('common.save') : t('common.create')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Confirm Delete Dialog */}
      <Dialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('inventoryPredictions.confirmDelete')}</DialogTitle>
            <DialogDescription>
              {t('inventoryPredictions.confirmDeleteDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              {t('common.cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (confirmDeleteId !== null) {
                  deletePredictionMutation.mutate(confirmDeleteId);
                }
              }}
              disabled={deletePredictionMutation.isPending}
            >
              {deletePredictionMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
};

export default InventoryPredictions;