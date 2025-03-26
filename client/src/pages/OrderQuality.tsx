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
              <span className="font-medium">{t('orderQuality.status')}:</span> {' '}
              <Badge variant={selectedQuality.resolved ? "outline" : "destructive"} className={selectedQuality.resolved ? "bg-green-100 text-green-800" : ""}>
                {selectedQuality.resolved ? t('orderQuality.resolved') : t('orderQuality.unresolved')}
              </Badge>
            </div>
            <div>
              <span className="font-medium">{t('orderQuality.inventoryAdjusted')}:</span> {' '}
              {selectedQuality.inventoryAdjusted ? t('common.yes') : t('common.no')}
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-md font-medium mb-1">{t('orderQuality.description')}</h4>
            <p className="text-sm bg-slate-50 p-2 rounded border">{selectedQuality.description}</p>
          </div>

          {selectedQuality.correctiveAction && (
            <div className="mt-4">
              <h4 className="text-md font-medium mb-1">{t('common.correctiveAction')}</h4>
              <p className="text-sm bg-slate-50 p-2 rounded border">{selectedQuality.correctiveAction}</p>
            </div>
          )}

          {selectedQuality.resolved && (
            <div className="mt-4">
              <h4 className="text-md font-medium mb-1">{t('orderQuality.resolution')}</h4>
              <div className="space-y-2">
                {selectedQuality.resolvedDate && (
                  <div>
                    <span className="font-medium">{t('orderQuality.resolvedDate')}:</span> {formatDate(selectedQuality.resolvedDate)}
                  </div>
                )}
                {selectedQuality.rootCause && (
                  <div>
                    <span className="font-medium">{t('orderQuality.rootCause')}:</span>
                    <p className="text-sm bg-slate-50 p-2 rounded border mt-1">{selectedQuality.rootCause}</p>
                  </div>
                )}
                {selectedQuality.preventiveMeasures && (
                  <div>
                    <span className="font-medium">{t('orderQuality.preventiveMeasures')}:</span>
                    <p className="text-sm bg-slate-50 p-2 rounded border mt-1">{selectedQuality.preventiveMeasures}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">{t('orderQuality.affectedProducts')}</h3>
          {affectedProducts.length > 0 ? (
            <div className="space-y-2">
              {affectedProducts.map(product => (
                <div key={product.id} className="bg-slate-100 p-2 rounded">
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm">SKU: {product.sku}</div>
                  <div className="text-sm">
                    {t('products.stockLevel')}: {product.currentStock} / {t('products.minLevel')}: {product.minStockLevel}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">{t('orderQuality.noAffectedProducts')}</div>
          )}
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{t('orderQuality.title')}</CardTitle>
              <CardDescription className="mt-1">
                {t('orderQuality.createDescription')}
              </CardDescription>
            </div>
            <div className="flex space-x-2 mt-4 md:mt-0">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  refetchQuality();
                  refetchStats();
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('common.refresh')}
              </Button>
              <Button 
                size="sm" 
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('orderQuality.createNew')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="quality">
                <ClipboardList className="h-4 w-4 mr-1" />
                {t('orderQuality.errors')}
              </TabsTrigger>
              <TabsTrigger value="stats">
                <BarChart4 className="h-4 w-4 mr-1" />
                {t('orderQuality.statistics')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="quality">
              <div className="mb-4 bg-gray-50 p-3 rounded">
                <div className="flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-4">
                  <div className="flex items-center">
                    <ListFilter className="h-4 w-4 mr-1 text-gray-500" />
                    <span className="text-sm font-medium">{t('orderQuality.filters.title')}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="w-44"
                      placeholder={t('orderQuality.filters.orderNumberPlaceholder')}
                      value={filterOrderId}
                      onChange={(e) => setFilterOrderId(e.target.value)}
                    />
                    <Select 
                      value={filterResolved} 
                      onValueChange={setFilterResolved}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder={t('orderQuality.status')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('common.all')}</SelectItem>
                        <SelectItem value="unresolved">{t('orderQuality.unresolved')}</SelectItem>
                        <SelectItem value="resolved">{t('orderQuality.resolved')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select 
                      value={filterQualityType} 
                      onValueChange={setFilterQualityType}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder={t('orderQuality.qualityType')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('common.all')}</SelectItem>
                        <SelectItem value="missing_item">{t('orderQuality.types.missing_item')}</SelectItem>
                        <SelectItem value="wrong_item">{t('orderQuality.types.wrong_item')}</SelectItem>
                        <SelectItem value="damaged_item">{t('orderQuality.types.damaged_item')}</SelectItem>
                        <SelectItem value="wrong_quantity">{t('orderQuality.types.wrong_quantity')}</SelectItem>
                        <SelectItem value="duplicate_item">{t('orderQuality.types.duplicate_item')}</SelectItem>
                        <SelectItem value="wrong_address">{t('orderQuality.types.wrong_address')}</SelectItem>
                        <SelectItem value="picking_issue">{t('orderQuality.types.picking_error')}</SelectItem>
                        <SelectItem value="packing_issue">{t('orderQuality.types.packing_error')}</SelectItem>
                        <SelectItem value="system_issue">{t('orderQuality.types.system_error')}</SelectItem>
                        <SelectItem value="other">{t('orderQuality.types.other')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex ml-auto">
                    <div className="dropdown">
                      <Button variant="outline" size="sm" className="ml-auto">
                        <Download className="h-4 w-4 mr-1" />
                        {t('common.export')}
                      </Button>
                      <div className="dropdown-menu">
                        <Button variant="ghost" size="sm" onClick={() => handleExport('csv')}>CSV</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleExport('excel')}>Excel</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleExport('pdf')}>PDF</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isLoadingQuality ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : filteredQualityIssues.length > 0 ? (
                <>
                  <div className="text-sm text-gray-500 mb-2">
                    {t('orderQuality.count', { count: filteredQualityIssues.length })}
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('orders.orderNumber')}</TableHead>
                          <TableHead>{t('orderQuality.qualityType')}</TableHead>
                          <TableHead>{t('orderQuality.reportDate')}</TableHead>
                          <TableHead>{t('orderQuality.status')}</TableHead>
                          <TableHead>{t('orderQuality.inventoryAdjusted')}</TableHead>
                          <TableHead className="text-right">{t('common.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredQualityIssues.map(quality => (
                          <TableRow key={quality.id}>
                            <TableCell>{quality.orderNumber}</TableCell>
                            <TableCell>{getQualityTypeDisplay(quality.qualityType)}</TableCell>
                            <TableCell>{formatDate(quality.reportDate)}</TableCell>
                            <TableCell>
                              <Badge variant={quality.resolved ? "outline" : "destructive"} className={quality.resolved ? "bg-green-100 text-green-800" : ""}>
                                {quality.resolved ? t('orderQuality.resolved') : t('orderQuality.unresolved')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {quality.inventoryAdjusted ? (
                                <Badge variant="outline" className="bg-green-50">
                                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                                  {t('common.yes')}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-yellow-50">
                                  <AlertCircle className="h-3 w-3 mr-1 text-yellow-500" />
                                  {t('common.no')}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    setSelectedQuality(quality);
                                    setIsViewDialogOpen(true);
                                  }}
                                  title={t('orderQuality.details')}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {!quality.resolved && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => {
                                      setSelectedQuality(quality);
                                      setIsResolveDialogOpen(true);
                                    }}
                                    title={t('orderQuality.resolveError')}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {!quality.inventoryAdjusted && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => {
                                      setSelectedQuality(quality);
                                      setIsAdjustDialogOpen(true);
                                    }}
                                    title={t('orderQuality.adjustInventory')}
                                  >
                                    <Package className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                    <ClipboardList className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium">{t('orderQuality.noErrors')}</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    {t('orderQuality.noErrorsDescription')}
                  </p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="stats">
              {isLoadingStats ? (
                <div className="space-y-4">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-60 w-full" />
                </div>
              ) : qualityStats ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold">{qualityStats.totalQualityIssues}</div>
                          <div className="text-sm text-gray-500 mt-1">{t('orderQuality.stats.totalErrors')}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {t('orderQuality.stats.fromOrders', { count: qualityStats.totalShippedOrders })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold">{qualityStats.qualityRate.toFixed(2)}%</div>
                          <div className="text-sm text-gray-500 mt-1">{t('orderQuality.stats.errorRate')}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {t('orderQuality.stats.per100Orders')}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          {qualityStats.qualityIssuesByType.length > 0 ? (
                            <>
                              <div className="text-xl font-bold">
                                {getQualityTypeDisplay(qualityStats.qualityIssuesByType[0].type)}
                              </div>
                              <div className="text-sm text-gray-500 mt-1">{t('orderQuality.stats.mostCommonError')}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                {t('orderQuality.stats.errorCount', { count: qualityStats.qualityIssuesByType[0].count })}
                              </div>
                            </>
                          ) : (
                            <div className="text-gray-500">{t('common.noData')}</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{t('orderQuality.stats.errorsByType')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {qualityStats.qualityIssuesByType.length > 0 ? (
                          <div className="space-y-2">
                            {qualityStats.qualityIssuesByType.map(item => (
                              <div key={item.type} className="flex items-center">
                                <div className="w-1/2 text-sm">{getQualityTypeDisplay(item.type)}</div>
                                <div className="w-1/2">
                                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div
                                      className="bg-blue-600 h-2.5 rounded-full"
                                      style={{ width: `${(item.count / qualityStats.totalQualityIssues) * 100}%` }}
                                    ></div>
                                  </div>
                                  <div className="text-xs text-right mt-1">{item.count}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">{t('common.noData')}</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{t('orderQuality.stats.errorRateTrend')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {qualityStats.trending.length > 0 ? (
                          <div className="h-60">
                            {/* Chart would go here - using a placeholder for now */}
                            <div className="flex h-full items-end">
                              {qualityStats.trending.map((point, index) => (
                                <div key={index} className="flex-1 flex flex-col items-center">
                                  <div
                                    className="w-4/5 bg-blue-500 rounded-t"
                                    style={{
                                      height: `${Math.max(5, (point.qualityRate / 10) * 100)}%`,
                                      minHeight: '10px'
                                    }}
                                  ></div>
                                  <div className="text-xs mt-1 rotate-45 origin-left text-gray-500">
                                    {new Date(point.date).toLocaleDateString(navigator.language, { month: 'short', day: 'numeric' })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">{t('common.noData')}</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {t('common.failedToLoadData')}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Create quality issue dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('orderQuality.createNew')}</DialogTitle>
            <DialogDescription>
              {t('orderQuality.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="orderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.orderId')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <SelectItem value="picking_issue">{t('orderQuality.types.picking_error')}</SelectItem>
                        <SelectItem value="packing_issue">{t('orderQuality.types.packing_error')}</SelectItem>
                        <SelectItem value="system_issue">{t('orderQuality.types.system_error')}</SelectItem>
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
                        placeholder={t('orderQuality.descriptionPlaceholder')}
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button 
                  type="submit"
                  disabled={createQualityMutation.isPending}
                >
                  {createQualityMutation.isPending ? t('common.creating') : t('common.create')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Resolve quality issue dialog */}
      <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('orderQuality.resolveSuccess')}</DialogTitle>
            <DialogDescription>
              {selectedQuality && t('orderQuality.resolveErrorDescription', { orderNumber: selectedQuality.orderNumber })}
            </DialogDescription>
          </DialogHeader>
          <Form {...resolveForm}>
            <form onSubmit={resolveForm.handleSubmit(onResolveSubmit)} className="space-y-4">
              <FormField
                control={resolveForm.control}
                name="rootCause"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('orderQuality.rootCause')}</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder={t('orderQuality.rootCausePlaceholder')}
                        rows={3}
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
                        placeholder={t('orderQuality.preventiveMeasuresPlaceholder')}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsResolveDialogOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button 
                  type="submit"
                  disabled={resolveQualityMutation.isPending}
                >
                  {resolveQualityMutation.isPending ? t('common.saving') : t('orderQuality.resolveAction')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Adjust inventory dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('orderQuality.adjustInventory')}</DialogTitle>
            <DialogDescription>
              {selectedQuality && t('orderQuality.adjustInventoryDescription', { orderNumber: selectedQuality.orderNumber })}
            </DialogDescription>
          </DialogHeader>
          <Form {...adjustInventoryForm}>
            <form onSubmit={adjustInventoryForm.handleSubmit(onAdjustInventorySubmit)} className="space-y-4">
              <div className="text-sm">{t('orderQuality.adjustmentsDescription')}</div>
              {affectedProducts.length > 0 ? (
                adjustInventoryForm.watch('adjustments')?.map((adjustment, index) => {
                  const product = products.find(p => p.id === adjustment.productId);
                  if (!product) return null;

                  return (
                    <div key={index} className="border rounded p-3 space-y-2">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm">
                        SKU: {product.sku} | {t('products.currentStock')}: {product.currentStock}
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm w-40">{t('orderQuality.adjustmentQuantity')}:</label>
                        <Input
                          type="number"
                          value={adjustment.quantity}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            const newAdjustments = [...adjustInventoryForm.getValues('adjustments')];
                            newAdjustments[index].quantity = value;
                            adjustInventoryForm.setValue('adjustments', newAdjustments);
                          }}
                          className="w-24"
                        />
                        {adjustment.quantity !== 0 && (
                          <span className="text-sm">
                            {adjustment.quantity > 0 ? (
                              <span className="text-green-600">
                                {t('orderQuality.willIncrease', { newStock: product.currentStock + adjustment.quantity })}
                              </span>
                            ) : (
                              <span className="text-red-600">
                                {t('orderQuality.willDecrease', { newStock: product.currentStock + adjustment.quantity })}
                              </span>
                            )}
                          </span>
                        )}
                        {adjustment.quantity === 0 && (
                          <span className="text-sm text-gray-500">{t('orderQuality.noChange')}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center p-4 text-gray-500">{t('orderQuality.noProductsToAdjust')}</div>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAdjustDialogOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button 
                  type="submit"
                  disabled={adjustInventoryMutation.isPending || affectedProducts.length === 0}
                >
                  {adjustInventoryMutation.isPending ? t('common.saving') : t('orderQuality.adjustAction')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View quality issue dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('orderQuality.details')}</DialogTitle>
            {selectedQuality && (
              <DialogDescription>
                {t('orderQuality.errorForOrder', { orderNumber: selectedQuality.orderNumber })}
              </DialogDescription>
            )}
          </DialogHeader>
          <ScrollArea className="max-h-[calc(80vh-200px)]">
            {renderQualityDetails()}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              {t('common.close')}
            </Button>
            {selectedQuality && !selectedQuality.resolved && (
              <Button
                onClick={() => {
                  setIsViewDialogOpen(false);
                  setIsResolveDialogOpen(true);
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {t('orderQuality.resolveAction')}
              </Button>
            )}
            {selectedQuality && !selectedQuality.inventoryAdjusted && (
              <Button
                variant="secondary"
                onClick={() => {
                  setIsViewDialogOpen(false);
                  setIsAdjustDialogOpen(true);
                }}
              >
                <Package className="h-4 w-4 mr-1" />
                {t('orderQuality.adjustInventory')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory adjustment prompt */}
      <AlertDialog open={isAdjustPromptOpen} onOpenChange={setIsAdjustPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('orderQuality.inventoryAdjustmentNeeded')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('orderQuality.adjustmentQuestion')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsAdjustPromptOpen(false);
              setCreatedQualityId(null);
              // Just show success message without adjustment
              toast({
                title: t('orderQuality.createSuccess'),
                description: t('orderQuality.createSuccessDescription'),
              });
              queryClient.invalidateQueries({ queryKey: ['/api/order-quality'] });
            }}>
              {t('common.no')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setIsAdjustPromptOpen(false);
              setIsAdjustDialogOpen(true);
            }}>
              {t('common.yes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}