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
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ClipboardCheck,
  Link,
  Search,
  BarChart4,
  Download,
  Eye,
  FileEdit,
  ListFilter,
  Plus,
  RefreshCw,
  Trash2,
  X,
  CalendarRange,
  Package,
  PackageCheck
} from 'lucide-react';

// Type definitions
interface OrderQuality {
  id: number;
  orderId?: number;
  orderNumber?: string;
  reportDate: string;
  reportedById: number;
  errorType: 'missing_item' | 'wrong_item' | 'damaged_item' | 'wrong_quantity' | 'duplicate_item' | 'wrong_address' | 'picking_issue' | 'packing_issue' | 'system_issue' | 'other';
  description: string;
  affectedProductIds: string[];
  correctiveAction?: string;
  inventoryAdjusted: boolean;
  resolved: boolean;
  resolvedById?: number;
  resolvedDate?: string;
  rootCause?: string;
  preventiveMeasures?: string;
  // New standalone quality fields
  qualityLabel?: string;
  qualityCategory?: string;
  qualityStatus?: string;
  assignedToId?: number;
  dueDate?: string;
  priority?: string;
  qualityNotes?: string;
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
  orderId: z.number().optional(),
  orderNumber: z.string().optional(),
  errorType: z.enum(['missing_item', 'wrong_item', 'damaged_item', 'wrong_quantity', 'duplicate_item', 'wrong_address', 'picking_issue', 'packing_issue', 'system_issue', 'other']),
  description: z.string().min(5, { message: "Description must be at least 5 characters" }),
  affectedItems: z.array(
    z.object({
      productId: z.number(),
      quantity: z.number().min(1),
      issueDescription: z.string()
    })
  ).optional(),
  // New standalone quality fields
  qualityLabel: z.string().optional(),
  qualityCategory: z.string().optional(),
  qualityStatus: z.string().optional(),
  assignedToId: z.number().optional(),
  dueDate: z.string().optional(),
  priority: z.string().optional(),
  qualityNotes: z.string().optional(),
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
  const [activeTab, setActiveTab] = useState('order-related');
  const [selectedQuality, setSelectedQuality] = useState<OrderQuality | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  // Removed isAdjustPromptOpen state as we're using toast notification instead
  const [affectedProducts, setAffectedProducts] = useState<Product[]>([]);
  const [createdQualityId, setCreatedQualityId] = useState<number | null>(null);
  const [filterOrderId, setFilterOrderId] = useState<string>('');
  const [filterResolved, setFilterResolved] = useState<string>('all');
  const [filterQualityType, setFilterQualityType] = useState<string>('all');
  const [orderSearchResults, setOrderSearchResults] = useState<any[]>([]);
  const [isOrderSearchDialogOpen, setIsOrderSearchDialogOpen] = useState(false);

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

  // Function to check if a quality type requires inventory adjustment
  const isInventoryRelatedIssue = (qualityType: string | null | undefined): boolean => {
    if (!qualityType) return false;
    
    // These issue types typically affect inventory levels
    const inventoryRelatedTypes = [
      'missing_item', 
      'wrong_item', 
      'damaged_item', 
      'wrong_quantity', 
      'duplicate_item'
    ];
    return inventoryRelatedTypes.includes(qualityType);
  };

  // Initialize forms with default values
  const createForm = useForm<QualityFormValues>({
    resolver: zodResolver(qualityFormSchema),
    defaultValues: {
      orderId: undefined,
      orderNumber: '',
      errorType: 'missing_item',
      description: '',
      affectedItems: [],
      qualityLabel: '',
      qualityCategory: '',
      qualityStatus: 'open',
      assignedToId: user?.id || undefined,
      dueDate: '',
      priority: 'medium',
      qualityNotes: '',
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
      if (response && response.id) {
        setCreatedQualityId(response.id);
        
        // Get the quality issue type from the response
        const errorType = response.errorType || "";
        
        // Show a regular success message
        toast({
          title: t('orderQuality.createSuccess'),
          description: t('orderQuality.createSuccessDescription'),
        });
        
        // For inventory-related issues, show a separate informational toast about manual adjustment
        if (isInventoryRelatedIssue(errorType)) {
          setTimeout(() => {
            toast({
              title: t('orderQuality.inventoryAdjustmentInfo'),
              description: t('orderQuality.manualAdjustmentPrompt'),
              variant: "default",
              duration: 8000,
            });
          }, 1000); // Slight delay to make sure it appears after the first toast
        }
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
        orderId: undefined,
        orderNumber: '',
        errorType: 'missing_item',
        description: '',
        affectedItems: [],
        qualityLabel: '',
        qualityCategory: '',
        qualityStatus: 'open',
        assignedToId: user?.id || undefined,
        dueDate: '',
        priority: 'medium',
        qualityNotes: '',
      });
    }
  }, [isCreateDialogOpen, createForm, user]);

  // Effect to reset form values when opening resolve dialog
  useEffect(() => {
    if (isResolveDialogOpen && selectedQuality) {
      resolveForm.reset({
        rootCause: selectedQuality.rootCause || '',
        preventiveMeasures: selectedQuality.preventiveMeasures || '',
      });
    }
  }, [isResolveDialogOpen, selectedQuality, resolveForm]);

  // Effect to prepare adjustment form when opening adjust inventory dialog
  useEffect(() => {
    if (isAdjustDialogOpen) {
      // Always reset to a safe default first
      adjustInventoryForm.reset({
        adjustments: []
      });
      
      if (selectedQuality) {
        // Initialize adjustment form with affected products in the next tick
        // to avoid React controlled/uncontrolled component warnings
        setTimeout(() => {
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
        }, 0);
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
      // Handle optional orderNumber field - check qualityLabel as fallback
      if (quality.orderNumber) {
        match = match && quality.orderNumber.toLowerCase().includes(filterOrderId.toLowerCase());
      } else if (quality.qualityLabel) {
        match = match && quality.qualityLabel.toLowerCase().includes(filterOrderId.toLowerCase());
      } else {
        match = false;
      }
    }

    if (filterResolved !== 'all') {
      match = match && (quality.resolved === (filterResolved === 'resolved'));
    }

    if (filterQualityType !== 'all') {
      match = match && quality.errorType === filterQualityType;
    }

    return match;
  });

  // Search for orders to link to a quality issue
  const handleOrderSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setOrderSearchResults([]);
      return;
    }

    try {
      const results = await apiRequest<any[]>(`/api/orders/search?q=${query}`);
      setOrderSearchResults(results || []);
    } catch (error) {
      console.error('Error searching orders:', error);
      setOrderSearchResults([]);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Handler for creating a new quality issue
  const onCreateSubmit = (values: QualityFormValues) => {
    // Extract affected product IDs from the form values
    const productIds = values.affectedItems?.map(item => item.productId.toString()) || [];
    
    // Create the quality issue
    createQualityMutation.mutate({
      ...values,
      affectedItems: values.affectedItems || [],
      // We pass the affected product IDs as a separate field
      // as the backend expects them as strings
      affectedProductIds: productIds
    } as any);
  };

  // Handler for resolving a quality issue
  const onResolveSubmit = (values: ResolveFormValues) => {
    resolveQualityMutation.mutate(values);
  };

  // Handler for adjusting inventory
  const onAdjustInventorySubmit = (values: InventoryAdjustmentValues) => {
    adjustInventoryMutation.mutate(values);
  };

  // Render details of a quality issue
  const renderQualityDetails = () => {
    if (!selectedQuality) return null;

    return (
      <div className="space-y-4 p-2">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="general">Γενικές Πληροφορίες</TabsTrigger>
            <TabsTrigger value="products">Επηρεαζόμενα Προϊόντα</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            {/* Order related information */}
            {selectedQuality.orderNumber && (
              <div className="border rounded p-4 bg-blue-50">
                <h3 className="font-medium text-blue-800 mb-2">{t('orderQuality.orderInfo')}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">{t('orders.orderNumber')}:</div>
                  <div>{selectedQuality.orderNumber}</div>
                </div>
              </div>
            )}

            {/* For standalone quality issues without an order */}
            {!selectedQuality.orderNumber && selectedQuality.qualityLabel && (
              <div className="border rounded p-4 bg-purple-50">
                <h3 className="font-medium text-purple-800 mb-2">{t('orderQuality.qualityInfo')}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">{t('orderQuality.qualityLabel')}:</div>
                  <div>{selectedQuality.qualityLabel}</div>
                  
                  {selectedQuality.qualityCategory && (
                    <>
                      <div className="font-medium">{t('orderQuality.qualityCategory')}:</div>
                      <div>{t(`orderQuality.categories.${selectedQuality.qualityCategory}`, selectedQuality.qualityCategory)}</div>
                    </>
                  )}
                  
                  {selectedQuality.priority && (
                    <>
                      <div className="font-medium">{t('orderQuality.priority')}:</div>
                      <div>
                        <Badge variant="outline" className={
                          selectedQuality.priority === 'high' ? 'bg-red-100 text-red-800' :
                          selectedQuality.priority === 'medium' ? 'bg-amber-100 text-amber-800' :
                          'bg-green-100 text-green-800'
                        }>
                          {t(`orderQuality.priorities.${selectedQuality.priority}`)}
                        </Badge>
                      </div>
                    </>
                  )}
                  
                  {selectedQuality.qualityStatus && (
                    <>
                      <div className="font-medium">{t('orderQuality.qualityStatus')}:</div>
                      <div>
                        <Badge variant="outline" className={
                          selectedQuality.qualityStatus === 'open' ? 'bg-blue-100 text-blue-800' :
                          selectedQuality.qualityStatus === 'in_progress' ? 'bg-amber-100 text-amber-800' :
                          selectedQuality.qualityStatus === 'waiting' ? 'bg-purple-100 text-purple-800' :
                          selectedQuality.qualityStatus === 'closed' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {t(`orderQuality.statuses.${selectedQuality.qualityStatus}`)}
                        </Badge>
                      </div>
                    </>
                  )}
                  
                  {selectedQuality.dueDate && (
                    <>
                      <div className="font-medium">{t('orderQuality.dueDate')}:</div>
                      <div>{formatDate(selectedQuality.dueDate)}</div>
                    </>
                  )}
                </div>
                
                {selectedQuality.qualityNotes && (
                  <div className="mt-3">
                    <div className="font-medium text-sm">{t('orderQuality.qualityNotes')}:</div>
                    <div className="text-sm mt-1 p-2 bg-white rounded border">
                      {selectedQuality.qualityNotes}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Issue details */}
            <div className="border rounded p-4">
              <h3 className="font-medium mb-2">{t('orderQuality.issueDetails')}</h3>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium">{t('orderQuality.reportDate')}:</div>
                <div>{formatDate(selectedQuality.reportDate)}</div>
                
                <div className="font-medium">{t('orderQuality.qualityType')}:</div>
                <div>
                  <Badge variant="outline" className="bg-amber-100 text-amber-800">
                    {t(`orderQuality.types.${selectedQuality.errorType}`)}
                  </Badge>
                </div>
                
                <div className="font-medium">{t('orderQuality.status')}:</div>
                <div>
                  <Badge variant="outline" className={selectedQuality.resolved ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                    {selectedQuality.resolved ? t('orderQuality.resolved') : t('orderQuality.unresolved')}
                  </Badge>
                </div>
                
                <div className="font-medium">{t('orderQuality.inventoryAdjusted')}:</div>
                <div>
                  <Badge variant="outline" className={selectedQuality.inventoryAdjusted ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {selectedQuality.inventoryAdjusted ? t('common.yes') : t('common.no')}
                  </Badge>
                </div>
              </div>
              
              <div className="mt-3">
                <div className="font-medium text-sm">{t('orderQuality.description')}:</div>
                <div className="text-sm mt-1 p-2 bg-gray-50 rounded">
                  {selectedQuality.description}
                </div>
              </div>
            </div>

            {/* Resolution details, if resolved */}
            {selectedQuality.resolved && (
              <div className="border rounded p-4 bg-green-50">
                <h3 className="font-medium text-green-800 mb-2">{t('orderQuality.resolutionDetails')}</h3>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">{t('orderQuality.resolvedDate')}:</div>
                  <div>{selectedQuality.resolvedDate ? formatDate(selectedQuality.resolvedDate) : '-'}</div>
                </div>
                
                {selectedQuality.rootCause && (
                  <div className="mt-3">
                    <div className="font-medium text-sm">{t('orderQuality.rootCause')}:</div>
                    <div className="text-sm mt-1 p-2 bg-white rounded">
                      {selectedQuality.rootCause}
                    </div>
                  </div>
                )}
                
                {selectedQuality.preventiveMeasures && (
                  <div className="mt-3">
                    <div className="font-medium text-sm">{t('orderQuality.preventiveMeasures')}:</div>
                    <div className="text-sm mt-1 p-2 bg-white rounded">
                      {selectedQuality.preventiveMeasures}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            {affectedProducts.length > 0 ? (
              <div className="space-y-3">
                {affectedProducts.map(product => (
                  <div key={product.id} className="border rounded p-3">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-gray-600">
                      SKU: {product.sku} | {t('products.currentStock')}: {product.currentStock}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                {t('orderQuality.noAffectedProducts')}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('orderQuality.title')}</h1>
          <p className="text-gray-500">{t('orderQuality.description')}</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => refetchQuality()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Ανανέωση
          </Button>
          
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Νέο Ζήτημα Ποιότητας
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      {!isLoadingStats && qualityStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Συνολικά Ζητήματα Ποιότητας
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{qualityStats?.totalQualityIssues || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Συνολικές Αποστολές
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{qualityStats?.totalShippedOrders || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Ποσοστό Ζητημάτων Ποιότητας
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {qualityStats?.qualityRate ? qualityStats.qualityRate.toFixed(2) : '0.00'}%
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Συχνότερο Ζήτημα Ποιότητας
              </CardTitle>
            </CardHeader>
            <CardContent>
              {qualityStats?.qualityIssuesByType && qualityStats.qualityIssuesByType.length > 0 ? (
                <div className="text-lg font-bold">
                  {qualityStats.qualityIssuesByType[0].type === 'missing_item' ? 'Ελλείπον Αντικείμενο' :
                   qualityStats.qualityIssuesByType[0].type === 'wrong_item' ? 'Λάθος Αντικείμενο' :
                   qualityStats.qualityIssuesByType[0].type === 'damaged_item' ? 'Κατεστραμμένο Αντικείμενο' :
                   qualityStats.qualityIssuesByType[0].type === 'wrong_quantity' ? 'Λάθος Ποσότητα' :
                   qualityStats.qualityIssuesByType[0].type === 'duplicate_item' ? 'Διπλό Αντικείμενο' :
                   qualityStats.qualityIssuesByType[0].type === 'wrong_address' ? 'Λάθος Διεύθυνση' :
                   qualityStats.qualityIssuesByType[0].type === 'picking_issue' ? 'Πρόβλημα Συλλογής' :
                   qualityStats.qualityIssuesByType[0].type === 'packing_issue' ? 'Πρόβλημα Συσκευασίας' :
                   qualityStats.qualityIssuesByType[0].type === 'system_issue' ? 'Πρόβλημα Συστήματος' : 'Άλλο'}
                </div>
              ) : (
                <div className="text-lg">-</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <ListFilter className="h-5 w-5 mr-2" />
            Φίλτρα
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="filter-id">Αριθμός Παραγγελίας</Label>
              <Input
                id="filter-id"
                placeholder="Φιλτράρισμα ανά αναγνωριστικό..."
                value={filterOrderId}
                onChange={(e) => setFilterOrderId(e.target.value)}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="filter-resolved">Κατάσταση</Label>
              <Select value={filterResolved} onValueChange={setFilterResolved}>
                <SelectTrigger id="filter-resolved" className="mt-1">
                  <SelectValue placeholder="Επιλέξτε κατάσταση" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Όλα</SelectItem>
                  <SelectItem value="unresolved">Εκκρεμεί</SelectItem>
                  <SelectItem value="resolved">Επιλύθηκε</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="filter-type">Τύπος Ζητήματος</Label>
              <Select value={filterQualityType} onValueChange={setFilterQualityType}>
                <SelectTrigger id="filter-type" className="mt-1">
                  <SelectValue placeholder="Επιλέξτε τύπο" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Όλα</SelectItem>
                  <SelectItem value="missing_item">Ελλείπον Αντικείμενο</SelectItem>
                  <SelectItem value="wrong_item">Λάθος Αντικείμενο</SelectItem>
                  <SelectItem value="damaged_item">Κατεστραμμένο Αντικείμενο</SelectItem>
                  <SelectItem value="wrong_quantity">Λάθος Ποσότητα</SelectItem>
                  <SelectItem value="duplicate_item">Διπλό Αντικείμενο</SelectItem>
                  <SelectItem value="wrong_address">Λάθος Διεύθυνση</SelectItem>
                  <SelectItem value="picking_issue">Πρόβλημα Συλλογής</SelectItem>
                  <SelectItem value="packing_issue">Πρόβλημα Συσκευασίας</SelectItem>
                  <SelectItem value="system_issue">Πρόβλημα Συστήματος</SelectItem>
                  <SelectItem value="other">Άλλο</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quality issues table */}
      <Card>
        <CardHeader>
          <CardTitle>Λίστα Ζητημάτων Ποιότητας</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingQuality ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {filteredQualityIssues.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Αναγνωριστικό</TableHead>
                      <TableHead className="w-[150px]">Ημερομηνία Αναφοράς</TableHead>
                      <TableHead>Τύπος Ζητήματος</TableHead>
                      <TableHead className="w-[100px]">Κατάσταση</TableHead>
                      <TableHead className="text-right">Ενέργειες</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQualityIssues.map(quality => (
                      <TableRow key={quality.id}>
                        <TableCell className="font-medium">
                          {quality.orderNumber ? (
                            quality.orderNumber
                          ) : (
                            quality.qualityLabel || `#${quality.id}`
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDate(quality.reportDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-amber-100 text-amber-800">
                            {quality.errorType === 'missing_item' ? 'Ελλείπον Αντικείμενο' :
                             quality.errorType === 'wrong_item' ? 'Λάθος Αντικείμενο' :
                             quality.errorType === 'damaged_item' ? 'Κατεστραμμένο Αντικείμενο' :
                             quality.errorType === 'wrong_quantity' ? 'Λάθος Ποσότητα' :
                             quality.errorType === 'duplicate_item' ? 'Διπλό Αντικείμενο' :
                             quality.errorType === 'wrong_address' ? 'Λάθος Διεύθυνση' :
                             quality.errorType === 'picking_issue' ? 'Πρόβλημα Συλλογής' :
                             quality.errorType === 'packing_issue' ? 'Πρόβλημα Συσκευασίας' :
                             quality.errorType === 'system_issue' ? 'Πρόβλημα Συστήματος' : 'Άλλο'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={quality.resolved ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                            {quality.resolved ? 'Επιλύθηκε' : 'Εκκρεμεί'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedQuality(quality);
                                setIsViewDialogOpen(true);
                              }}
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
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {!quality.inventoryAdjusted && isInventoryRelatedIssue(quality.errorType) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedQuality(quality);
                                  setIsAdjustDialogOpen(true);
                                }}
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
              ) : (
                <div className="text-center py-10">
                  <ClipboardList className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="mt-2 text-gray-500">Δεν βρέθηκαν ζητήματα ποιότητας</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create quality issue dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('orderQuality.createNew')}</DialogTitle>
            <DialogDescription>
              {t('orderQuality.createDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <Tabs defaultValue="order_related" className="mb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="order_related">{t('orderQuality.tabs.orderRelated')}</TabsTrigger>
                  <TabsTrigger value="standalone">{t('orderQuality.tabs.standalone')}</TabsTrigger>
                </TabsList>

                <TabsContent value="order_related" className="space-y-4">
                  <div>
                  <FormField
                    control={createForm.control}
                    name="orderNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-blue-700">{t('orders.orderNumber')}</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl className="flex-1">
                            <Input 
                              placeholder={t('orderQuality.orderNumberPlaceholder')} 
                              {...field} 
                              value={field.value || ''}
                            />
                          </FormControl>
                          <Button 
                            type="button" 
                            variant="secondary"
                            onClick={() => setIsOrderSearchDialogOpen(true)}
                            className="whitespace-nowrap"
                          >
                            <Search className="h-4 w-4 mr-1.5" />
                            {t('common.search')}
                          </Button>
                        </div>
                        <FormDescription className="text-xs text-blue-600">
                          {t('orderQuality.orderNumberHint')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Hidden orderId field */}
                  <FormField
                    control={createForm.control}
                    name="orderId"
                    render={({ field }) => (
                      <FormItem className="hidden">
                        <FormControl>
                          <Input 
                            type="hidden" 
                            value={field.value?.toString() || ''} 
                            onChange={(e) => {
                              const val = e.target.value;
                              field.onChange(val ? parseInt(val) : undefined);
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                </TabsContent>

                <TabsContent value="standalone" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="qualityLabel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('orderQuality.qualityLabel')}</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={t('orderQuality.qualityLabelPlaceholder')} 
                              {...field} 
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="qualityCategory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('orderQuality.qualityCategory')}</FormLabel>
                          <div>
                            <FormControl>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t('orderQuality.qualityCategoryPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="production">{t('orderQuality.categories.production')}</SelectItem>
                                  <SelectItem value="warehouse">{t('orderQuality.categories.warehouse')}</SelectItem>
                                  <SelectItem value="shipping">{t('orderQuality.categories.shipping')}</SelectItem>
                                  <SelectItem value="supplier">{t('orderQuality.categories.supplier')}</SelectItem>
                                  <SelectItem value="other">{t('orderQuality.categories.other')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('orderQuality.priority')}</FormLabel>
                          <div>
                            <FormControl>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t('orderQuality.priorityPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">{t('orderQuality.priorities.low')}</SelectItem>
                                  <SelectItem value="medium">{t('orderQuality.priorities.medium')}</SelectItem>
                                  <SelectItem value="high">{t('orderQuality.priorities.high')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="qualityStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('orderQuality.qualityStatus')}</FormLabel>
                          <div>
                            <FormControl>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t('orderQuality.qualityStatusPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open">{t('orderQuality.statuses.open')}</SelectItem>
                                  <SelectItem value="in_progress">{t('orderQuality.statuses.in_progress')}</SelectItem>
                                  <SelectItem value="waiting">{t('orderQuality.statuses.waiting')}</SelectItem>
                                  <SelectItem value="closed">{t('orderQuality.statuses.closed')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="assignedToId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('orderQuality.assignedTo')}</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              value={field.value?.toString() || ''} 
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val ? parseInt(val) : undefined);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('orderQuality.dueDate')}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={createForm.control}
                    name="qualityNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('orderQuality.qualityNotes')}</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder={t('orderQuality.qualityNotesPlaceholder')} 
                            className="resize-none" 
                            rows={3} 
                            {...field}
                            value={field.value || ''} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>
              
              <FormField
                control={createForm.control}
                name="errorType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('orderQuality.qualityType')}</FormLabel>
                    <div>
                      <FormControl>
                        <Select 
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('orderQuality.selectQualityType')} />
                          </SelectTrigger>
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
                      </FormControl>
                    </div>
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
                        placeholder={t('orderQuality.descriptionPlaceholder')} 
                        className="resize-none" 
                        rows={4} 
                        {...field} 
                        value={field.value || ''}
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
            <DialogTitle>{t('orderQuality.resolveIssue')}</DialogTitle>
            <DialogDescription>
              {selectedQuality && t('orderQuality.resolveDescription', { 
                orderNumber: selectedQuality.orderNumber || selectedQuality.qualityLabel || `#${selectedQuality.id}` 
              })}
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
                        placeholder={t('orderQuality.rootCausePlaceholder')} 
                        className="resize-none" 
                        rows={3} 
                        {...field} 
                        value={field.value || ''}
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
                        placeholder={t('orderQuality.preventiveMeasuresPlaceholder')} 
                        className="resize-none" 
                        rows={3} 
                        {...field} 
                        value={field.value || ''}
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
              {selectedQuality && t('orderQuality.adjustInventoryDescription', { 
                orderNumber: selectedQuality.orderNumber || selectedQuality.qualityLabel || `#${selectedQuality.id}` 
              })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="text-sm">{t('orderQuality.adjustmentsDescription')}</div>
          
          {affectedProducts.length > 0 ? (
            <Form {...adjustInventoryForm}>
              <form onSubmit={adjustInventoryForm.handleSubmit(onAdjustInventorySubmit)} className="space-y-4">
                <div className="space-y-4">
                  {adjustInventoryForm.getValues('adjustments')?.map((adjustment, index) => {
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
                            value={adjustment.quantity || 0}
                            onChange={(e) => {
                              let value = 0;
                              try {
                                value = parseInt(e.target.value) || 0;
                              } catch (err) {
                                value = 0;
                              }
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
                  })}
                </div>
                
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
          ) : (
            <div className="text-center p-4 text-gray-500">
              {t('orderQuality.noProductsToAdjust')}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View quality issue dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('orderQuality.details')}</DialogTitle>
            {selectedQuality && (
              <DialogDescription>
                {selectedQuality.orderNumber 
                  ? t('orderQuality.errorForOrder', { orderNumber: selectedQuality.orderNumber })
                  : (selectedQuality.qualityLabel 
                      ? t('orderQuality.qualityIssueDetails', { label: selectedQuality.qualityLabel })
                      : t('orderQuality.qualityIssueById', { id: selectedQuality.id })
                    )
                }
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
            {selectedQuality && !selectedQuality.inventoryAdjusted && isInventoryRelatedIssue(selectedQuality.errorType) && (
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

      {/* Removed inventory adjustment prompt - now using toast notification instead */}

      {/* Order search dialog */}
      <Dialog 
        open={isOrderSearchDialogOpen} 
        onOpenChange={(open) => {
          setIsOrderSearchDialogOpen(open);
          // When opening the dialog, automatically load recent orders
          if (open) {
            handleOrderSearch("");
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('orderQuality.selectOrder')}</DialogTitle>
            <DialogDescription>
              {t('orderQuality.selectOrderDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input 
                placeholder={t('orderQuality.searchOrderPlaceholder')}
                onChange={(e) => handleOrderSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
          </div>
          
          <div className="overflow-auto max-h-[400px] border rounded-md">
            {orderSearchResults.length > 0 ? (
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>{t('orders.orderNumber')}</TableHead>
                    <TableHead>{t('orders.customerName')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('orders.orderDate')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('orders.columns.status')}</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderSearchResults.map(order => (
                    <TableRow key={order.id} className="group hover:bg-gray-50">
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(order.orderDate)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge
                          variant="outline"
                          className={
                            order.status === 'shipped' ? 'bg-green-100 text-green-800' :
                            order.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'processing' ? 'bg-amber-100 text-amber-800' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }
                        >
                          {t(`orders.statusValues.${order.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            // Set the order information in the form
                            createForm.setValue("orderId", order.id);
                            createForm.setValue("orderNumber", order.orderNumber);
                            setIsOrderSearchDialogOpen(false);
                            toast({
                              description: t('orderQuality.orderSelected', { orderNumber: order.orderNumber }),
                            });
                          }}
                        >
                          {t('common.select')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 px-4">
                <Search className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                <p className="text-gray-500 mb-1">{t('common.noResults')}</p>
                <p className="text-sm text-gray-400">Try searching by order number</p>
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsOrderSearchDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}