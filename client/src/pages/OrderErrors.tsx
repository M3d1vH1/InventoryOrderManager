import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/context/AuthContext';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useIsMobile } from '@/hooks/use-mobile';

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { exportData } from '@/lib/utils';

// Icons
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  Eye,
  FileEdit,
  ListFilter,
  Plus,
  RefreshCw,
  Trash2,
  X,
  CalendarRange,
  BarChart4,
  Package,
  PackageCheck
} from 'lucide-react';

// Type definitions
interface OrderError {
  id: number;
  orderId: number;
  orderNumber: string;
  reportDate: string;
  reportedById: number;
  errorType: 'missing_item' | 'wrong_item' | 'damaged_item' | 'wrong_quantity' | 'duplicate_item' | 'wrong_address' | 'picking_error' | 'packing_error' | 'system_error' | 'other';
  description: string;
  affectedProductIds: string[];
  correctiveAction?: string;
  inventoryAdjusted: boolean;
  resolved: boolean;
  resolvedById?: number;
  resolvedDate?: string;
  rootCause?: string;
  preventiveMeasures?: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  currentStock: number;
  minStockLevel: number;
}

interface ErrorStats {
  totalErrors: number;
  totalShippedOrders: number;
  errorRate: number;
  errorsByType: { type: string; count: number }[];
  trending: { date: string; errorRate: number }[];
}

// Form schema for creating/updating errors
const errorFormSchema = z.object({
  orderId: z.number(),
  orderNumber: z.string(),
  errorType: z.enum(['missing_item', 'wrong_item', 'damaged_item', 'wrong_quantity', 'duplicate_item', 'wrong_address', 'picking_error', 'packing_error', 'system_error', 'other']),
  description: z.string().min(5, { message: "Description must be at least 5 characters" }),
  affectedItems: z.array(
    z.object({
      productId: z.number(),
      quantity: z.number().min(1),
      issueDescription: z.string()
    })
  ).optional(),
});

// Form schema for resolving errors
const resolveErrorSchema = z.object({
  rootCause: z.string().min(5, { message: "Root cause must be at least 5 characters" }),
  preventiveMeasures: z.string().min(5, { message: "Preventive measures must be at least 5 characters" }),
});

// Form schema for inventory adjustments
const inventoryAdjustmentSchema = z.object({
  adjustments: z.array(
    z.object({
      productId: z.number(),
      quantity: z.number().int(),
    })
  )
});

type ErrorFormValues = z.infer<typeof errorFormSchema>;
type ResolveFormValues = z.infer<typeof resolveErrorSchema>;
type InventoryAdjustmentValues = z.infer<typeof inventoryAdjustmentSchema>;

export default function OrderErrors() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  
  // State variables
  const [activeTab, setActiveTab] = useState('errors');
  const [selectedError, setSelectedError] = useState<OrderError | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAdjustPromptOpen, setIsAdjustPromptOpen] = useState(false);
  const [affectedProducts, setAffectedProducts] = useState<Product[]>([]);
  const [createdErrorId, setCreatedErrorId] = useState<number | null>(null);
  const [filterOrderId, setFilterOrderId] = useState<string>('');
  const [filterResolved, setFilterResolved] = useState<string>('all');
  const [filterErrorType, setFilterErrorType] = useState<string>('all');
  
  // Query for fetching errors
  const {
    data: orderErrors = [],
    isLoading: isLoadingErrors,
    refetch: refetchErrors
  } = useQuery({
    queryKey: ['/api/order-errors'],
    queryFn: () => apiRequest<OrderError[]>('/api/order-errors')
  });

  // Query for fetching error statistics
  const {
    data: errorStats,
    isLoading: isLoadingStats,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['/api/order-errors-stats'],
    queryFn: () => apiRequest<ErrorStats>('/api/order-errors-stats')
  });

  // Query for fetching products (used for dropdowns)
  const {
    data: products = [],
    isLoading: isLoadingProducts
  } = useQuery({
    queryKey: ['/api/products'],
    queryFn: () => apiRequest<Product[]>('/api/products')
  });

  // Mutation for creating a new error
  const createErrorMutation = useMutation({
    mutationFn: async (values: ErrorFormValues) => {
      return apiRequest('/api/order-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          reportedById: user?.id
        })
      });
    },
    onSuccess: (response: any) => {
      // Store the created error ID for potential inventory adjustment
      if (response && response.id) {
        setCreatedErrorId(response.id);
        
        // Show adjustment prompt
        setIsAdjustPromptOpen(true);
      } else {
        // Just show success message if no ID is returned
        toast({
          title: t('orderErrors.createSuccess'),
          description: t('orderErrors.createSuccessDescription'),
        });
      }
      
      setIsCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/order-errors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/order-errors-stats'] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.errorOccurred'),
        description: error.message || t('orderErrors.createError'),
        variant: 'destructive'
      });
    }
  });

  // Mutation for resolving an error
  const resolveErrorMutation = useMutation({
    mutationFn: async (values: ResolveFormValues) => {
      if (!selectedError) return null;
      return apiRequest(`/api/order-errors/${selectedError.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          userId: user?.id
        })
      });
    },
    onSuccess: () => {
      toast({
        title: t('orderErrors.resolveSuccess'),
        description: t('orderErrors.resolveSuccessDescription'),
      });
      setIsResolveDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/order-errors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/order-errors-stats'] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.errorOccurred'),
        description: error.message || t('orderErrors.resolveError'),
        variant: 'destructive'
      });
    }
  });

  // Mutation for adjusting inventory
  const adjustInventoryMutation = useMutation({
    mutationFn: async (values: InventoryAdjustmentValues) => {
      if (!selectedError) return null;
      return apiRequest(`/api/order-errors/${selectedError.id}/adjust-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
    },
    onSuccess: () => {
      toast({
        title: t('orderErrors.inventoryAdjustSuccess'),
        description: t('orderErrors.inventoryAdjustSuccessDescription'),
      });
      setIsAdjustDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/order-errors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.errorOccurred'),
        description: error.message || t('orderErrors.inventoryAdjustError'),
        variant: 'destructive'
      });
    }
  });

  // Forms
  const createForm = useForm<ErrorFormValues>({
    resolver: zodResolver(errorFormSchema),
    defaultValues: {
      orderId: 0,
      orderNumber: '',
      errorType: 'missing_item',
      description: '',
      affectedItems: [],
    }
  });

  const resolveForm = useForm<ResolveFormValues>({
    resolver: zodResolver(resolveErrorSchema),
    defaultValues: {
      rootCause: '',
      preventiveMeasures: '',
    }
  });

  const adjustInventoryForm = useForm<InventoryAdjustmentValues>({
    resolver: zodResolver(inventoryAdjustmentSchema),
    defaultValues: {
      adjustments: []
    }
  });

  // Effect to initialize affected products when viewing details
  useEffect(() => {
    if (selectedError && products.length > 0) {
      const productData = selectedError.affectedProductIds
        .map(id => products.find(p => p.id === parseInt(id)))
        .filter((p): p is Product => !!p);
      setAffectedProducts(productData);
    } else {
      setAffectedProducts([]);
    }
  }, [selectedError, products]);

  // Effect to reset form values when opening create dialog
  useEffect(() => {
    if (isCreateDialogOpen) {
      createForm.reset({
        orderId: 0,
        orderNumber: '',
        errorType: 'missing_item',
        description: '',
        affectedItems: [],
      });
    }
  }, [isCreateDialogOpen, createForm]);

  // Effect to reset form values when opening resolve dialog
  useEffect(() => {
    if (isResolveDialogOpen && selectedError) {
      resolveForm.reset({
        rootCause: selectedError.rootCause || '',
        preventiveMeasures: selectedError.preventiveMeasures || '',
      });
    }
  }, [isResolveDialogOpen, selectedError, resolveForm]);

  // Effect to reset form values when opening adjust inventory dialog
  useEffect(() => {
    if (isAdjustDialogOpen && selectedError) {
      // Initialize adjustment form with affected products
      const initialAdjustments = selectedError.affectedProductIds
        .map(id => {
          const productId = parseInt(id);
          return {
            productId,
            quantity: 0
          };
        });
      
      adjustInventoryForm.reset({
        adjustments: initialAdjustments
      });
    }
  }, [isAdjustDialogOpen, selectedError, adjustInventoryForm]);

  // Filter errors based on selected filters
  const filteredErrors = orderErrors.filter(error => {
    let match = true;
    
    if (filterOrderId) {
      match = match && error.orderNumber.toLowerCase().includes(filterOrderId.toLowerCase());
    }

    if (filterResolved !== 'all') {
      match = match && (filterResolved === 'resolved' ? error.resolved : !error.resolved);
    }

    if (filterErrorType !== 'all') {
      match = match && error.errorType === filterErrorType;
    }
    
    return match;
  });

  // Handle form submissions
  const onCreateSubmit = (values: ErrorFormValues) => {
    createErrorMutation.mutate(values);
  };

  const onResolveSubmit = (values: ResolveFormValues) => {
    resolveErrorMutation.mutate(values);
  };

  const onAdjustInventorySubmit = (values: InventoryAdjustmentValues) => {
    // Filter out zero quantity adjustments
    const filteredAdjustments = values.adjustments.filter(adj => adj.quantity !== 0);
    if (filteredAdjustments.length === 0) {
      toast({
        title: t('orderErrors.noAdjustments'),
        description: t('orderErrors.noAdjustmentsDescription'),
        variant: 'destructive'
      });
      return;
    }

    adjustInventoryMutation.mutate({
      adjustments: filteredAdjustments
    });
  };

  // Helper to format dates
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(navigator.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Helper to get error type display name
  const getErrorTypeDisplay = (errorType: string) => {
    return t(`orderErrors.types.${errorType}`);
  };

  // Helper to export error data
  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const dataForExport = filteredErrors.map(error => ({
      'Order Number': error.orderNumber,
      'Error Type': getErrorTypeDisplay(error.errorType),
      'Reported Date': formatDate(error.reportDate),
      'Description': error.description,
      'Status': error.resolved ? t('orderErrors.resolved') : t('orderErrors.unresolved'),
      'Inventory Adjusted': error.inventoryAdjusted ? t('common.yes') : t('common.no'),
    }));

    exportData(dataForExport, format, 'order-errors-report');
  };

  // Render view for error details
  const renderErrorDetails = () => {
    if (!selectedError) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">{t('orderErrors.details')}</h3>
          <div className="space-y-2">
            <div>
              <span className="font-medium">{t('orders.orderNumber')}:</span> {selectedError.orderNumber}
            </div>
            <div>
              <span className="font-medium">{t('orderErrors.errorType')}:</span> {getErrorTypeDisplay(selectedError.errorType)}
            </div>
            <div>
              <span className="font-medium">{t('orderErrors.reportDate')}:</span> {formatDate(selectedError.reportDate)}
            </div>
            <div>
              <span className="font-medium">{t('orderErrors.description')}:</span> {selectedError.description}
            </div>
            <div>
              <span className="font-medium">{t('orderErrors.status')}:</span>{' '}
              {selectedError.resolved ? (
                <Badge className="bg-green-500 hover:bg-green-600">{t('orderErrors.resolved')}</Badge>
              ) : (
                <Badge variant="destructive">{t('orderErrors.unresolved')}</Badge>
              )}
            </div>
            <div>
              <span className="font-medium">{t('orderErrors.inventoryAdjusted')}:</span>{' '}
              {selectedError.inventoryAdjusted ? t('common.yes') : t('common.no')}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">{t('orderErrors.affectedProducts')}</h3>
          {affectedProducts.length === 0 ? (
            <p>{t('orderErrors.noAffectedProducts')}</p>
          ) : (
            <div className="space-y-2">
              {affectedProducts.map(product => (
                <div key={product.id} className="p-2 border rounded">
                  <div><span className="font-medium">{t('products.name')}:</span> {product.name}</div>
                  <div><span className="font-medium">{t('products.sku')}:</span> {product.sku}</div>
                  <div><span className="font-medium">{t('products.currentStock')}:</span> {product.currentStock}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedError.resolved && (
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-semibold mb-2">{t('orderErrors.resolution')}</h3>
            <div className="space-y-2">
              <div>
                <span className="font-medium">{t('orderErrors.resolvedDate')}:</span>{' '}
                {selectedError.resolvedDate ? formatDate(selectedError.resolvedDate) : t('common.notApplicable')}
              </div>
              <div>
                <span className="font-medium">{t('orderErrors.rootCause')}:</span>{' '}
                {selectedError.rootCause || t('common.notProvided')}
              </div>
              <div>
                <span className="font-medium">{t('orderErrors.preventiveMeasures')}:</span>{' '}
                {selectedError.preventiveMeasures || t('common.notProvided')}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render statistics view
  const renderErrorStats = () => {
    if (isLoadingStats || !errorStats) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-3">
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-52 w-full" />
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle>{t('orderErrors.stats.totalErrors')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{errorStats.totalErrors}</div>
            <p className="text-sm text-muted-foreground">
              {t('orderErrors.stats.fromOrders', { count: errorStats.totalShippedOrders })}
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle>{t('orderErrors.stats.errorRate')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {errorStats.errorRate.toFixed(2)}%
            </div>
            <p className="text-sm text-muted-foreground">
              {t('orderErrors.stats.per100Orders')}
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle>{t('orderErrors.stats.mostCommonError')}</CardTitle>
          </CardHeader>
          <CardContent>
            {errorStats.errorsByType.length > 0 ? (
              <>
                <div className="text-xl font-bold">
                  {getErrorTypeDisplay(errorStats.errorsByType[0].type)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('orderErrors.stats.errorCount', { count: errorStats.errorsByType[0].count })}
                </p>
              </>
            ) : (
              <div className="text-muted-foreground">{t('common.noData')}</div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>{t('orderErrors.stats.errorsByType')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {errorStats.errorsByType.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {errorStats.errorsByType.map(item => (
                    <div key={item.type} className="flex items-center justify-between">
                      <div className="flex-1">{getErrorTypeDisplay(item.type)}</div>
                      <div className="w-48 bg-muted rounded-full h-4 overflow-hidden">
                        <div 
                          className="bg-primary h-full" 
                          style={{ 
                            width: `${(item.count / errorStats.errorsByType[0].count) * 100}%` 
                          }}
                        />
                      </div>
                      <div className="w-12 text-right">{item.count}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-muted-foreground">{t('common.noData')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>{t('orderErrors.stats.errorRateTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {errorStats.trending.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {errorStats.trending.map(item => (
                    <div key={item.date} className="flex items-center justify-between">
                      <div className="w-32">{new Date(item.date).toLocaleDateString()}</div>
                      <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                        <div 
                          className="bg-primary h-full" 
                          style={{ 
                            width: `${Math.min(item.errorRate * 5, 100)}%` 
                          }}
                        />
                      </div>
                      <div className="w-24 text-right">{item.errorRate.toFixed(2)}%</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-muted-foreground">{t('common.noData')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('orderErrors.title')}</h1>
        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> {t('orderErrors.createNew')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{t('orderErrors.createNew')}</DialogTitle>
                <DialogDescription>{t('orderErrors.createDescription')}</DialogDescription>
              </DialogHeader>

              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="orderId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('orders.orderId')}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="orderNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('orders.orderNumber')}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={createForm.control}
                    name="errorType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('orderErrors.errorType')}</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('orderErrors.selectErrorType')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="missing_item">{t('orderErrors.types.missing_item')}</SelectItem>
                            <SelectItem value="wrong_item">{t('orderErrors.types.wrong_item')}</SelectItem>
                            <SelectItem value="damaged_item">{t('orderErrors.types.damaged_item')}</SelectItem>
                            <SelectItem value="wrong_quantity">{t('orderErrors.types.wrong_quantity')}</SelectItem>
                            <SelectItem value="duplicate_item">{t('orderErrors.types.duplicate_item')}</SelectItem>
                            <SelectItem value="wrong_address">{t('orderErrors.types.wrong_address')}</SelectItem>
                            <SelectItem value="picking_error">{t('orderErrors.types.picking_error')}</SelectItem>
                            <SelectItem value="packing_error">{t('orderErrors.types.packing_error')}</SelectItem>
                            <SelectItem value="system_error">{t('orderErrors.types.system_error')}</SelectItem>
                            <SelectItem value="other">{t('orderErrors.types.other')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('orderErrors.description')}</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={3}
                            placeholder={t('orderErrors.descriptionPlaceholder')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-2">{t('orderErrors.affectedProducts')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{t('orderErrors.affectedProductsDescription')}</p>
                    
                    {/* Implementation for adding affected products would go here */}
                    {/* This would typically involve dynamic form fields with react-hook-form */}
                    {/* For simplicity, this part is omitted in this initial implementation */}
                  </div>

                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button 
                      type="submit"
                      disabled={createErrorMutation.isPending}
                    >
                      {createErrorMutation.isPending ? (
                        <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> {t('common.saving')}</>
                      ) : (
                        t('common.save')
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('excel')}>
              <Download className="h-4 w-4 mr-2" /> Excel
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="errors">
            <AlertCircle className="h-4 w-4 mr-2" />
            {t('orderErrors.errors')}
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart4 className="h-4 w-4 mr-2" />
            {t('orderErrors.statistics')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('orderErrors.filters.title')}</CardTitle>
              <CardDescription>{t('orderErrors.filters.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="orderIdFilter">{t('orderErrors.filters.orderNumber')}</Label>
                  <Input
                    id="orderIdFilter"
                    value={filterOrderId}
                    onChange={(e) => setFilterOrderId(e.target.value)}
                    placeholder={t('orderErrors.filters.orderNumberPlaceholder')}
                  />
                </div>
                <div>
                  <Label htmlFor="statusFilter">{t('orderErrors.filters.status')}</Label>
                  <Select value={filterResolved} onValueChange={setFilterResolved}>
                    <SelectTrigger id="statusFilter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('common.all')}</SelectItem>
                      <SelectItem value="resolved">{t('orderErrors.resolved')}</SelectItem>
                      <SelectItem value="unresolved">{t('orderErrors.unresolved')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="typeFilter">{t('orderErrors.filters.errorType')}</Label>
                  <Select value={filterErrorType} onValueChange={setFilterErrorType}>
                    <SelectTrigger id="typeFilter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('common.all')}</SelectItem>
                      <SelectItem value="missing_item">{t('orderErrors.types.missing_item')}</SelectItem>
                      <SelectItem value="wrong_item">{t('orderErrors.types.wrong_item')}</SelectItem>
                      <SelectItem value="damaged_item">{t('orderErrors.types.damaged_item')}</SelectItem>
                      <SelectItem value="wrong_quantity">{t('orderErrors.types.wrong_quantity')}</SelectItem>
                      <SelectItem value="duplicate_item">{t('orderErrors.types.duplicate_item')}</SelectItem>
                      <SelectItem value="wrong_address">{t('orderErrors.types.wrong_address')}</SelectItem>
                      <SelectItem value="picking_error">{t('orderErrors.types.picking_error')}</SelectItem>
                      <SelectItem value="packing_error">{t('orderErrors.types.packing_error')}</SelectItem>
                      <SelectItem value="system_error">{t('orderErrors.types.system_error')}</SelectItem>
                      <SelectItem value="other">{t('orderErrors.types.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('orderErrors.list')}</CardTitle>
              <CardDescription>
                {isLoadingErrors ? (
                  t('common.loading')
                ) : (
                  t('orderErrors.count', { count: filteredErrors.length })
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingErrors ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredErrors.length === 0 ? (
                <div className="text-center py-6">
                  <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                  <h3 className="font-medium">{t('orderErrors.noErrors')}</h3>
                  <p className="text-muted-foreground">
                    {t('orderErrors.noErrorsDescription')}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('orders.orderNumber')}</TableHead>
                        <TableHead>{t('orderErrors.errorType')}</TableHead>
                        <TableHead>{t('orderErrors.reportDate')}</TableHead>
                        <TableHead>{t('orderErrors.status')}</TableHead>
                        <TableHead className="text-right">{t('common.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredErrors.map((error) => (
                        <TableRow key={error.id}>
                          <TableCell className="font-medium">{error.orderNumber}</TableCell>
                          <TableCell>{getErrorTypeDisplay(error.errorType)}</TableCell>
                          <TableCell>{formatDate(error.reportDate)}</TableCell>
                          <TableCell>
                            {error.resolved ? (
                              <Badge className="bg-green-500 hover:bg-green-600">{t('orderErrors.resolved')}</Badge>
                            ) : (
                              <Badge variant="destructive">{t('orderErrors.unresolved')}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => {
                                        setSelectedError(error);
                                        setIsViewDialogOpen(true);
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t('common.view')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              {!error.resolved && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => {
                                          setSelectedError(error);
                                          setIsResolveDialogOpen(true);
                                        }}
                                      >
                                        <CheckCircle2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{t('orderErrors.resolve')}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}

                              {!error.inventoryAdjusted && user?.role === 'admin' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => {
                                          setSelectedError(error);
                                          setIsAdjustDialogOpen(true);
                                        }}
                                      >
                                        <Package className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{t('orderErrors.adjustInventory')}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* View Error Dialog */}
          <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{t('orderErrors.viewError')}</DialogTitle>
                <DialogDescription>
                  {selectedError && (
                    <span>
                      {t('orderErrors.errorForOrder', { orderNumber: selectedError.orderNumber })}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {renderErrorDetails()}
              </div>

              <DialogFooter>
                <Button 
                  onClick={() => setIsViewDialogOpen(false)}
                >
                  {t('common.close')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Resolve Error Dialog */}
          <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{t('orderErrors.resolveError')}</DialogTitle>
                <DialogDescription>
                  {selectedError && (
                    <span>
                      {t('orderErrors.resolveErrorDescription', { orderNumber: selectedError.orderNumber })}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <Form {...resolveForm}>
                <form onSubmit={resolveForm.handleSubmit(onResolveSubmit)} className="space-y-6">
                  <FormField
                    control={resolveForm.control}
                    name="rootCause"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('orderErrors.rootCause')}</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={3}
                            placeholder={t('orderErrors.rootCausePlaceholder')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={resolveForm.control}
                    name="preventiveMeasures"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('orderErrors.preventiveMeasures')}</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={3}
                            placeholder={t('orderErrors.preventiveMeasuresPlaceholder')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={() => setIsResolveDialogOpen(false)}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button 
                      type="submit"
                      disabled={resolveErrorMutation.isPending}
                    >
                      {resolveErrorMutation.isPending ? (
                        <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> {t('common.saving')}</>
                      ) : (
                        t('orderErrors.resolveAction')
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Adjust Inventory Dialog */}
          <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{t('orderErrors.adjustInventory')}</DialogTitle>
                <DialogDescription>
                  {selectedError && (
                    <span>
                      {t('orderErrors.adjustInventoryDescription', { orderNumber: selectedError.orderNumber })}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <Form {...adjustInventoryForm}>
                <form onSubmit={adjustInventoryForm.handleSubmit(onAdjustInventorySubmit)} className="space-y-6">
                  <div className="space-y-2">
                    <Label>{t('orderErrors.adjustments')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('orderErrors.adjustmentsDescription')}
                    </p>

                    {adjustInventoryForm.watch('adjustments').length === 0 ? (
                      <div className="border rounded-md p-4 text-center">
                        <p className="text-muted-foreground">{t('orderErrors.noProductsToAdjust')}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {adjustInventoryForm.watch('adjustments').map((adjustment, index) => {
                          const product = products.find(p => p.id === adjustment.productId);
                          if (!product) return null;

                          return (
                            <div key={adjustment.productId} className="border rounded-md p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="font-medium">{product.name}</p>
                                  <p className="text-sm text-muted-foreground">{t('products.sku')}: {product.sku}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {t('products.currentStock')}: {product.currentStock}
                                  </p>
                                </div>
                                <div className="flex items-end">
                                  <div className="w-full">
                                    <Label htmlFor={`quantity-${index}`}>
                                      {t('orderErrors.adjustmentQuantity')}
                                    </Label>
                                    <Input
                                      id={`quantity-${index}`}
                                      type="number"
                                      value={adjustment.quantity}
                                      onChange={(e) => {
                                        const newAdjustments = [...adjustInventoryForm.getValues('adjustments')];
                                        newAdjustments[index].quantity = parseInt(e.target.value) || 0;
                                        adjustInventoryForm.setValue('adjustments', newAdjustments);
                                      }}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {adjustment.quantity > 0 ? (
                                        t('orderErrors.willIncrease', { 
                                          newStock: product.currentStock + adjustment.quantity 
                                        })
                                      ) : adjustment.quantity < 0 ? (
                                        t('orderErrors.willDecrease', { 
                                          newStock: product.currentStock + adjustment.quantity 
                                        })
                                      ) : (
                                        t('orderErrors.noChange')
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={() => setIsAdjustDialogOpen(false)}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button 
                      type="submit"
                      disabled={adjustInventoryMutation.isPending}
                    >
                      {adjustInventoryMutation.isPending ? (
                        <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> {t('common.saving')}</>
                      ) : (
                        t('orderErrors.adjustAction')
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="stats">
          {renderErrorStats()}
        </TabsContent>
      </Tabs>
    </div>
  );
}