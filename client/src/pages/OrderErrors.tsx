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
interface OrderQuality {
  id: number;
  orderId: number;
  orderNumber: string;
  reportDate: string;
  reportedById: number;
  qualityType: 'missing_item' | 'wrong_item' | 'damaged_item' | 'wrong_quantity' | 'duplicate_item' | 'wrong_address' | 'picking_issue' | 'packing_issue' | 'system_issue' | 'other';
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

interface QualityStats {
  totalQualityIssues: number;
  totalShippedOrders: number;
  qualityRate: number;
  qualityIssuesByType: { type: string; count: number }[];
  trending: { date: string; qualityRate: number }[];
}

// Form schema for creating/updating quality issues
const qualityFormSchema = z.object({
  orderId: z.number(),
  orderNumber: z.string(),
  qualityType: z.enum(['missing_item', 'wrong_item', 'damaged_item', 'wrong_quantity', 'duplicate_item', 'wrong_address', 'picking_issue', 'packing_issue', 'system_issue', 'other']),
  description: z.string().min(5, { message: "Description must be at least 5 characters" }),
  affectedItems: z.array(
    z.object({
      productId: z.number(),
      quantity: z.number().min(1),
      issueDescription: z.string()
    })
  ).optional(),
});

// Form schema for resolving quality issues
const resolveQualitySchema = z.object({
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

type QualityFormValues = z.infer<typeof qualityFormSchema>;
type ResolveFormValues = z.infer<typeof resolveQualitySchema>;
type InventoryAdjustmentValues = z.infer<typeof inventoryAdjustmentSchema>;

export default function OrderQuality() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // State variables
  const [activeTab, setActiveTab] = useState('quality');
  const [selectedQuality, setSelectedQuality] = useState<OrderQuality | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAdjustPromptOpen, setIsAdjustPromptOpen] = useState(false);
  const [affectedProducts, setAffectedProducts] = useState<Product[]>([]);
  const [createdQualityId, setCreatedQualityId] = useState<number | null>(null);
  const [filterOrderId, setFilterOrderId] = useState<string>('');
  const [filterResolved, setFilterResolved] = useState<string>('all');
  const [filterQualityType, setFilterQualityType] = useState<string>('all');

  // Query for fetching quality issues
  const {
    data: orderQualityIssues = [],
    isLoading: isLoadingQuality,
    refetch: refetchQuality
  } = useQuery({
    queryKey: ['/api/order-quality'],
    queryFn: () => apiRequest<OrderQuality[]>('/api/order-quality')
  });

  // Query for fetching quality statistics
  const {
    data: qualityStats,
    isLoading: isLoadingStats,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['/api/order-quality-stats'],
    queryFn: () => apiRequest<QualityStats>('/api/order-quality-stats')
  });

  // Query for fetching products (used for dropdowns)
  const {
    data: products = [],
    isLoading: isLoadingProducts
  } = useQuery({
    queryKey: ['/api/products'],
    queryFn: () => apiRequest<Product[]>('/api/products')
  });

  // Mutation for creating a new quality issue
  const createQualityMutation = useMutation({
    mutationFn: async (values: QualityFormValues) => {
      return apiRequest('/api/order-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          reportedById: user?.id
        })
      });
    },
    onSuccess: (response: any) => {
      // Store the created quality issue ID for potential inventory adjustment
      if (response && response.id) {
        setCreatedQualityId(response.id);

        // Show adjustment prompt
        setIsAdjustPromptOpen(true);
      } else {
        // Just show success message if no ID is returned
        toast({
          title: t('orderQuality.createSuccess'),
          description: t('orderQuality.createSuccessDescription'),
        });
      }

      setIsCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/order-quality'] });
      queryClient.invalidateQueries({ queryKey: ['/api/order-quality-stats'] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.errorOccurred'),
        description: error.message || t('orderQuality.createError'),
        variant: 'destructive'
      });
    }
  });

  // Mutation for resolving a quality issue
  const resolveQualityMutation = useMutation({
    mutationFn: async (values: ResolveFormValues) => {
      if (!selectedQuality) return null;
      return apiRequest(`/api/order-quality/${selectedQuality.id}/resolve`, {
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
        title: t('orderQuality.resolveSuccess'),
        description: t('orderQuality.resolveSuccessDescription'),
      });
      setIsResolveDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/order-quality'] });
      queryClient.invalidateQueries({ queryKey: ['/api/order-quality-stats'] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.errorOccurred'),
        description: error.message || t('orderQuality.resolveError'),
        variant: 'destructive'
      });
    }
  });

  // Mutation for adjusting inventory
  const adjustInventoryMutation = useMutation({
    mutationFn: async (values: InventoryAdjustmentValues) => {
      // Use either selectedQuality.id or createdQualityId
      const qualityId = selectedQuality?.id || createdQualityId;
      if (!qualityId) return null;

      return apiRequest(`/api/order-quality/${qualityId}/adjust-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
    },
    onSuccess: () => {
      toast({
        title: t('orderQuality.inventoryAdjustSuccess'),
        description: t('orderQuality.inventoryAdjustSuccessDescription'),
      });
      setIsAdjustDialogOpen(false);
      // Reset the created quality issue ID after successful adjustment
      setCreatedQualityId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/order-quality'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.errorOccurred'),
        description: error.message || t('orderQuality.inventoryAdjustError'),
        variant: 'destructive'
      });
    }
  });

  // Forms
  const createForm = useForm<QualityFormValues>({
    resolver: zodResolver(qualityFormSchema),
    defaultValues: {
      orderId: 0,
      orderNumber: '',
      qualityType: 'missing_item',
      description: '',
      affectedItems: [],
    }
  });

  const resolveForm = useForm<ResolveFormValues>({
    resolver: zodResolver(resolveQualitySchema),
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
    if (selectedQuality && products.length > 0) {
      const productData = selectedQuality.affectedProductIds
        .map(id => products.find(p => p.id === parseInt(id)))
        .filter((p): p is Product => !!p);
      setAffectedProducts(productData);
    } else {
      setAffectedProducts([]);
    }
  }, [selectedQuality, products]);

  // Effect to reset form values when opening create dialog
  useEffect(() => {
    if (isCreateDialogOpen) {
      createForm.reset({
        orderId: 0,
        orderNumber: '',
        qualityType: 'missing_item',
        description: '',
        affectedItems: [],
      });
    }
  }, [isCreateDialogOpen, createForm]);

  // Effect to reset form values when opening resolve dialog
  useEffect(() => {
    if (isResolveDialogOpen && selectedQuality) {
      resolveForm.reset({
        rootCause: selectedQuality.rootCause || '',
        preventiveMeasures: selectedQuality.preventiveMeasures || '',
      });
    }
  }, [isResolveDialogOpen, selectedQuality, resolveForm]);

  // Effect to reset form values when opening adjust inventory dialog
  useEffect(() => {
    if (isAdjustDialogOpen) {
      if (selectedQuality) {
        // Initialize adjustment form with affected products
        const initialAdjustments = selectedQuality.affectedProductIds
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
      } else if (createdQualityId) {
        // If we have a newly created quality issue but no selectedQuality yet,
        // fetch the quality issue details to get the affected products
        apiRequest<OrderQuality>(`/api/order-quality/${createdQualityId}`)
          .then(quality => {
            setSelectedQuality(quality);
            // The form will be initialized when selectedQuality is set
          })
          .catch(err => {
            toast({
              title: t('common.errorOccurred'),
              description: err.message || t('orderQuality.loadError'),
              variant: 'destructive'
            });
            setIsAdjustDialogOpen(false);
          });
      }
    }
  }, [isAdjustDialogOpen, selectedQuality, createdQualityId, adjustInventoryForm, t]);

  // Filter quality issues based on selected filters
  const filteredQualityIssues = orderQualityIssues.filter(quality => {
    let match = true;

    if (filterOrderId) {
      match = match && quality.orderNumber.toLowerCase().includes(filterOrderId.toLowerCase());
    }

    if (filterResolved !== 'all') {
      match = match && (filterResolved === 'resolved' ? quality.resolved : !quality.resolved);
    }

    if (filterQualityType !== 'all') {
      match = match && quality.qualityType === filterQualityType;
    }

    return match;
  });

  // Handle form submissions
  const onCreateSubmit = (values: QualityFormValues) => {
    createQualityMutation.mutate(values);
  };

  const onResolveSubmit = (values: ResolveFormValues) => {
    resolveQualityMutation.mutate(values);
  };

  const onAdjustInventorySubmit = (values: InventoryAdjustmentValues) => {
    // Filter out zero quantity adjustments
    const filteredAdjustments = values.adjustments.filter(adj => adj.quantity !== 0);
    if (filteredAdjustments.length === 0) {
      toast({
        title: t('orderQuality.noAdjustments'),
        description: t('orderQuality.noAdjustmentsDescription'),
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

  // Helper to get quality type display name
  const getQualityTypeDisplay = (qualityType: string) => {
    return t(`orderQuality.types.${qualityType}`);
  };

  // Helper to export quality issue data
  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const dataForExport = filteredQualityIssues.map(quality => ({
      'Order Number': quality.orderNumber,
      'Quality Type': getQualityTypeDisplay(quality.qualityType),
      'Reported Date': formatDate(quality.reportDate),
      'Description': quality.description,
      'Status': quality.resolved ? t('orderQuality.resolved') : t('orderQuality.unresolved'),
      'Inventory Adjusted': quality.inventoryAdjusted ? t('common.yes') : t('common.no'),
    }));

    exportData(dataForExport, format, 'order-quality-report');
  };

  // Render view for quality issue details
  const renderQualityDetails = () => {
    if (!selectedQuality) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">{t('orderQuality.details')}</h3>
          <div className="space-y-2">
            <div>
              <span className="font-medium">{t('orders.orderNumber')}:</span> {selectedQuality.orderNumber}
            </div>
            <div>
              <span className="font-medium">{t('orderQuality.qualityType')}:</span> {getQualityTypeDisplay(selectedQuality.qualityType)}
            </div>
            <div>
              <span className="font-medium">{t('orderQuality.reportDate')}:</span> {formatDate(selectedQuality.reportDate)}
            </div>
            <div>
              <span className="font-medium">{t('orderQuality.description')}:</span> {selectedQuality.description}
            </div>
            <div>
              <span className="font-medium">{t('orderQuality.status')}:</span>{' '}
              {selectedQuality.resolved ? (
                <Badge className="bg-green-500 hover:bg-green-600">{t('orderQuality.resolved')}</Badge>
              ) : (
                <Badge variant="destructive">{t('orderQuality.unresolved')}</Badge>
              )}
            </div>
            <div>
              <span className="font-medium">{t('orderQuality.inventoryAdjusted')}:</span>{' '}
              {selectedQuality.inventoryAdjusted ? t('common.yes') : t('common.no')}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">{t('orderQuality.affectedProducts')}</h3>
          {affectedProducts.length === 0 ? (
            <p>{t('orderQuality.noAffectedProducts')}</p>
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

        {selectedQuality.resolved && (
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-semibold mb-2">{t('orderQuality.resolution')}</h3>
            <div className="space-y-2">
              <div>
                <span className="font-medium">{t('orderQuality.resolvedDate')}:</span>{' '}
                {selectedQuality.resolvedDate ? formatDate(selectedQuality.resolvedDate) : t('common.notApplicable')}
              </div>
              <div>
                <span className="font-medium">{t('orderQuality.rootCause')}:</span>{' '}
                {selectedQuality.rootCause || t('common.notProvided')}
              </div>
              <div>
                <span className="font-medium">{t('orderQuality.preventiveMeasures')}:</span>{' '}
                {selectedQuality.preventiveMeasures || t('common.notProvided')}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render statistics view
  const renderQualityStats = () => {
    if (isLoadingStats || !qualityStats) {
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
            <CardTitle>{t('orderQuality.stats.totalQualityIssues')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{qualityStats.totalQualityIssues}</div>
            <p className="text-sm text-muted-foreground">
              {t('orderQuality.stats.fromOrders', { count: qualityStats.totalShippedOrders })}
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle>{t('orderQuality.stats.qualityRate')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {qualityStats.qualityRate.toFixed(2)}%
            </div>
            <p className="text-sm text-muted-foreground">
              {t('orderQuality.stats.per100Orders')}
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle>{t('orderQuality.stats.mostCommonQualityIssue')}</CardTitle>
          </CardHeader>
          <CardContent>
            {qualityStats.qualityIssuesByType.length > 0 ? (
              <>
                <div className="text-xl font-bold">
                  {getQualityTypeDisplay(qualityStats.qualityIssuesByType[0].type)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('orderQuality.stats.qualityIssueCount', { count: qualityStats.qualityIssuesByType[0].count })}
                </p>
              </>
            ) : (
              <div className="text-muted-foreground">{t('common.noData')}</div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>{t('orderQuality.stats.qualityIssuesByType')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {qualityStats.qualityIssuesByType.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {qualityStats.qualityIssuesByType.map(item => (
                    <div key={item.type} className="flex items-center justify-between">
                      <div className="flex-1">{getQualityTypeDisplay(item.type)}</div>
                      <div className="w-48 bg-muted rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-primary h-full"
                          style={{
                            width: `${(item.count / qualityStats.qualityIssuesByType[0].count) * 100}%`
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
            <CardTitle>{t('orderQuality.stats.qualityRateTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {qualityStats.trending.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {qualityStats.trending.map(item => (
                    <div key={item.date} className="flex items-center justify-between">
                      <div className="w-32">{new Date(item.date).toLocaleDateString()}</div>
                      <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-primary h-full"
                          style={{
                            width: `${Math.min(item.qualityRate * 5, 100)}%`
                          }}
                        />
                      </div>
                      <div className="w-24 text-right">{item.qualityRate.toFixed(2)}%</div>
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

  // Handle adjustment prompt responses
  const handleAdjustPromptResponse = (adjust: boolean) => {
    setIsAdjustPromptOpen(false);

    if (adjust) {
      // Open the adjustment dialog if user wants to adjust inventory
      setIsAdjustDialogOpen(true);
    } else {
      // Just display success message if user doesn't want to adjust inventory
      toast({
        title: t('orderQuality.createSuccess'),
        description: t('orderQuality.createSuccessDescription'),
      });
      // Reset the created quality issue ID since we're not using it
      setCreatedQualityId(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Adjustment Prompt Dialog */}
      <AlertDialog open={isAdjustPromptOpen} onOpenChange={setIsAdjustPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('orderQuality.inventoryAdjustmentNeeded')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('orderQuality.adjustmentQuestion')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleAdjustPromptResponse(false)}>
              {t('common.no')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleAdjustPromptResponse(true)}>
              {t('common.yes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('orderQuality.title')}</h1>
        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> {t('orderQuality.createNew')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{t('orderQuality.createNew')}</DialogTitle>
                <DialogDescription>{t('orderQuality.createDescription')}</DialogDescription>
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
                    name="qualityType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('orderQuality.qualityType')}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('orderQuality.selectQualityType')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="missing_item">{t('orderQuality.types.missing_item')}</SelectItem>
                            <SelectItem value="wrong_item">{t('orderQuality.types.wrong_item')}</SelectItem>
                            <SelectItem value="damaged_item">{t('orderQuality.types.damaged_item')}</SelectItem>
                            <SelectItem value="wrong_quantity">{t('orderQuality.types.wrong_quantity')}</SelectItem>
                            <SelectItem value="duplicate_item">{t('orderQuality.types.duplicate_item')}</SelectItem>
                            <SelectItem value="wrong_address">{t('orderQuality.types.wrong_address')}</SelectItem>
                            <SelectItem value="picking_issue">{t('orderQuality.types.picking_issue')}</SelectItem>
                            <SelectItem value="packing_issue">{t('orderQuality.types.packing_issue')}</SelectItem>
                            <SelectItem value="system_issue">{t('orderQuality.types.system_issue')}</SelectItem>
                            <SelectItem value="other">{t('orderQuality.types.other')}</SelectItem>
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
                        <FormLabel>{t('orderQuality.description')}</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder={t('orderQuality.descriptionPlaceholder')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-2">{t('orderQuality.affectedProducts')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{t('orderQuality.affectedProductsDescription')}</p>

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
                      disabled={createQualityMutation.isPending}
                    >
                      {createQualityMutation.isPending ? (
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
          <TabsTrigger value="quality">
            <AlertCircle className="h-4 w-4 mr-2" />
            {t('orderQuality.qualityIssues')}
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart4 className="h-4 w-4 mr-2" />
            {t('orderQuality.statistics')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('orderQuality.filters.title')}</CardTitle>
              <CardDescription>{t('orderQuality.filters.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="orderIdFilter">{t('orderQuality.filters.orderNumber')}</Label>
                  <Input
                    id="orderIdFilter"
                    value={filterOrderId}
                    onChange={(e) => setFilterOrderId(e.target.value)}
                    placeholder={t('orderQuality.filters.orderNumberPlaceholder')}
                  />
                </div>
                <div>
                  <Label htmlFor="statusFilter">{t('orderQuality.filters.status')}</Label>
                  <Select value={filterResolved} onValueChange={setFilterResolved}>
                    <SelectTrigger id="statusFilter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('common.all')}</SelectItem>
                      <SelectItem value="resolved">{t('orderQuality.resolved')}</SelectItem>
                      <SelectItem value="unresolved">{t('orderQuality.unresolved')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="typeFilter">{t('orderQuality.filters.qualityType')}</Label>
                  <Select value={filterQualityType} onValueChange={setFilterQualityType}>
                    <SelectTrigger id="typeFilter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('common.all')}</SelectItem>
                      <SelectItem value="missing_item">{t('orderQuality.types.missing_item')}</SelectItem>
                      <SelectItem value="wrong_item">{t('orderQuality.types.wrong_item')}</SelectItem>
                      <SelectItem value="damaged_item">{t('orderQuality.types.damaged_item')}</SelectItem>
                      <SelectItem value="wrong_quantity">{t('orderQuality.types.wrong_quantity')}</SelectItem>
                      <SelectItem value="duplicate_item">{t('orderQuality.types.duplicate_item')}</SelectItem>
                      <SelectItem value="wrong_address">{t('orderQuality.types.wrong_address')}</SelectItem>
                      <SelectItem value="picking_issue">{t('orderQuality.types.picking_issue')}</SelectItem>
                      <SelectItem value="packing_issue">{t('orderQuality.types.packing_issue')}</SelectItem>
                      <SelectItem value="system_issue">{t('orderQuality.types.system_issue')}</SelectItem>
                      <SelectItem value="other">{t('orderQuality.types.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('orderQuality.list')}</CardTitle>
              <CardDescription>
                {isLoadingQuality ? (
                  t('common.loading')
                ) : (
                  t('orderQuality.count', { count: filteredQualityIssues.length })
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingQuality ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredQualityIssues.length === 0 ? (
                <div className="text-center py-6">
                  <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                  <h3 className="font-medium">{t('orderQuality.noQualityIssues')}</h3>
                  <p className="text-muted-foreground">
                    {t('orderQuality.noQualityIssuesDescription')}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('orders.orderNumber')}</TableHead>
                        <TableHead>{t('orderQuality.qualityType')}</TableHead>
                        <TableHead>{t('orderQuality.reportDate')}</TableHead>
                        <TableHead>{t('orderQuality.status')}</TableHead>
                        <TableHead className="text-right">{t('common.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQualityIssues.map((quality) => (
                        <TableRow key={quality.id}>
                          <TableCell className="font-medium">{quality.orderNumber}</TableCell>
                          <TableCell>{getQualityTypeDisplay(quality.qualityType)}</TableCell>
                          <TableCell>{formatDate(quality.reportDate)}</TableCell>
                          <TableCell>
                            {quality.resolved ? (
                              <Badge className="bg-green-500 hover:bg-green-600">{t('orderQuality.resolved')}</Badge>
                            ) : (
                              <Badge variant="destructive">{t('orderQuality.unresolved')}</Badge>
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
                                        setSelectedQuality(quality);
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

                              {!quality.resolved && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedQuality(quality);
                                          setIsResolveDialogOpen(true);
                                        }}
                                      >
                                        <CheckCircle2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{t('orderQuality.resolve')}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}

                              {!quality.inventoryAdjusted && user?.role === 'admin' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedQuality(quality);
                                          setIsAdjustDialogOpen(true);
                                        }}
                                      >
                                        <Package className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{t('orderQuality.adjustInventory')}</p>
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

          {/* View Quality Issue Dialog */}
          <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{t('orderQuality.viewQualityIssue')}</DialogTitle>
                <DialogDescription>
                  {selectedQuality && (
                    <span>
                      {t('orderQuality.qualityIssueForOrder', { orderNumber: selectedQuality.orderNumber })}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {renderQualityDetails()}
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

          {/* Resolve Quality Issue Dialog */}
          <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{t('orderQuality.resolveQualityIssue')}</DialogTitle>
                <DialogDescription>
                  {selectedQuality && (
                    <span>
                      {t('orderQuality.resolveQualityIssueDescription', { orderNumber: selectedQuality.orderNumber })}
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
                        <FormLabel>{t('orderQuality.rootCause')}</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder={t('orderQuality.rootCausePlaceholder')}
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
                        <FormLabel>{t('orderQuality.preventiveMeasures')}</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder={t('orderQuality.preventiveMeasuresPlaceholder')}
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
                      disabled={resolveQualityMutation.isPending}
                    >
                      {resolveQualityMutation.isPending ? (
                        <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> {t('common.saving')}</>
                      ) : (
                        t('orderQuality.resolveAction')
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
                <DialogTitle>{t('orderQuality.adjustInventory')}</DialogTitle>
                <DialogDescription>
                  {selectedQuality && (
                    <span>
                      {t('orderQuality.adjustInventoryDescription', { orderNumber: selectedQuality.orderNumber })}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <Form {...adjustInventoryForm}>
                <form onSubmit={adjustInventoryForm.handleSubmit(onAdjustInventorySubmit)} className="space-y-6">
                  <div className="space-y-2">
                    <Label>{t('orderQuality.adjustments')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('orderQuality.adjustmentsDescription')}
                    </p>

                    {adjustInventoryForm.watch('adjustments').length === 0 ? (
                      <div className="border rounded-md p-4 text-center">
                        <p className="text-muted-foreground">{t('orderQuality.noProductsToAdjust')}</p>
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
                                      {t('orderQuality.adjustmentQuantity')}
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
                                        t('orderQuality.willIncrease', {
                                          newStock: product.currentStock + adjustment.quantity
                                        })
                                      ) : adjustment.quantity < 0 ? (
                                        t('orderQuality.willDecrease', {
                                          newStock: product.currentStock + adjustment.quantity
                                        })
                                      ) : (
                                        t('orderQuality.noChange')
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
                        t('orderQuality.adjustAction')
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="stats">
          {renderQualityStats()}
        </TabsContent>
      </Tabs>

      {/* Inventory adjustment prompt dialog */}
      <Dialog open={isAdjustPromptOpen} onOpenChange={setIsAdjustPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('orderQuality.inventoryAdjustmentNeeded')}</DialogTitle>
            <DialogDescription>
              {t('orderQuality.inventoryAdjustmentPrompt')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex flex-col space-y-2">
              <p>{t('orderQuality.adjustmentQuestion')}</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAdjustPromptOpen(false);
                toast({
                  title: t('orderQuality.createSuccess'),
                  description: t('orderQuality.createSuccessDescription'),
                });
              }}
            >
              {t('common.no')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                // Get quality issue to adjust
                setIsAdjustPromptOpen(false);

                // Fetch the newly created quality issue and open adjustment dialog
                if (createdQualityId !== null) {
                  apiRequest<OrderQuality>(`/api/order-quality/${createdQualityId}`)
                    .then(quality => {
                      setSelectedQuality(quality);
                      setIsAdjustDialogOpen(true);
                    })
                    .catch(err => {
                      toast({
                        title: t('common.errorOccurred'),
                        description: err.message || t('orderQuality.loadError'),
                        variant: 'destructive'
                      });
                    });
                }
              }}
            >
              {t('common.yes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}