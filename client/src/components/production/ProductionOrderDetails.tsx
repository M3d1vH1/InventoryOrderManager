import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Check, 
  CheckCircle2, 
  ChevronRight, 
  ClipboardCheck, 
  Edit, 
  FileText, 
  Gauge, 
  Package, 
  PackagePlus, 
  Play, 
  Printer,
  ShieldCheck,
  Loader2
} from 'lucide-react';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import MaterialConsumptionDialog from './MaterialConsumptionDialog';
import ProductionQualityCheckDialog from './ProductionQualityCheckDialog';

interface ProductionOrderDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number | null;
  onEdit?: (order: any) => void;
}

export default function ProductionOrderDetails({
  open,
  onOpenChange,
  orderId,
  onEdit,
}: ProductionOrderDetailsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('details');
  const [materialDialogOpen, setMaterialDialogOpen] = useState<boolean>(false);
  const [qualityCheckDialogOpen, setQualityCheckDialogOpen] = useState<boolean>(false);
  const [processingAction, setProcessingAction] = useState<boolean>(false);

  // Fetch order details
  const {
    data: order,
    isLoading: orderLoading,
    error: orderError,
  } = useQuery({
    queryKey: ['/api/production/orders', orderId],
    enabled: !!orderId && open,
  });

  // Fetch production logs
  const {
    data: logs = [],
    isLoading: logsLoading,
  } = useQuery({
    queryKey: ['/api/production/orders', orderId, 'logs'],
    enabled: !!orderId && open,
  });

  // Fetch consumed materials
  const {
    data: consumedMaterials = [],
    isLoading: materialsLoading,
  } = useQuery({
    queryKey: ['/api/production/orders', orderId, 'consumed-materials'],
    enabled: !!orderId && open && activeTab === 'materials',
  });

  // Fetch raw materials from recipe
  const {
    data: recipeMaterials = [],
    isLoading: recipeMaterialsLoading,
  } = useQuery({
    queryKey: ['/api/production/recipes', order?.recipeId, 'materials'],
    enabled: !!order?.recipeId && open && activeTab === 'materials',
  });

  // Fetch quality checks
  const {
    data: qualityChecks = [],
    isLoading: qualityChecksLoading,
  } = useQuery({
    queryKey: ['/api/production/orders', orderId, 'quality-checks'],
    enabled: !!orderId && open && activeTab === 'quality',
  });

  // Mutation to update order status
  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      return await apiRequest(`/api/production/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status,
          notes: `Status changed to ${status}`
        })
      });
    },
    onSuccess: (data, variables) => {
      // Add log entry
      const eventTypeMap: Record<string, string> = {
        'in_progress': 'start',
        'completed': 'completed',
        'quality_check': 'quality_check',
      };

      const eventType = eventTypeMap[variables] || 'other';
      
      apiRequest('/api/production/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productionOrderId: orderId,
          eventType,
          description: `Production ${eventType}: ${order.productName}`,
        })
      });

      toast({
        title: t(`production.order${variables.charAt(0).toUpperCase() + variables.slice(1)}`),
        description: t(`production.order${variables.charAt(0).toUpperCase() + variables.slice(1)}Desc`),
      });

      // Refresh order data
      queryClient.invalidateQueries({ queryKey: ['/api/production/orders', orderId] });
      queryClient.invalidateQueries({ queryKey: ['/api/production/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/production/orders', orderId, 'logs'] });
    },
    onError: (error: any) => {
      console.error('Error updating order status:', error);
      toast({
        title: t('errorOccurred'),
        description: error.message || t('production.errorUpdatingStatus'),
        variant: 'destructive',
      });
    }
  });

  // Handle status change
  const handleStatusChange = async (status: string) => {
    setProcessingAction(true);
    try {
      await statusMutation.mutateAsync(status);
    } finally {
      setProcessingAction(false);
    }
  };

  // Start production
  const handleStartProduction = () => {
    if (order.status !== 'planned' && order.status !== 'material_check') return;
    handleStatusChange('in_progress');
  };

  // Complete production
  const handleCompleteProduction = () => {
    if (order.status !== 'in_progress') return;
    handleStatusChange('completed');
  };

  // Send to quality check
  const handleQualityCheck = () => {
    if (order.status !== 'in_progress' && order.status !== 'completed') return;
    handleStatusChange('quality_check');
  };

  // Helper functions
  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'planned': 'bg-blue-100 text-blue-800 border-blue-300',
      'material_check': 'bg-sky-100 text-sky-800 border-sky-300',
      'in_progress': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'completed': 'bg-green-100 text-green-800 border-green-300',
      'partially_completed': 'bg-orange-100 text-orange-800 border-orange-300',
      'cancelled': 'bg-red-100 text-red-800 border-red-300',
      'quality_check': 'bg-purple-100 text-purple-800 border-purple-300',
      'approved': 'bg-emerald-100 text-emerald-800 border-emerald-300',
      'rejected': 'bg-red-100 text-red-800 border-red-300',
    };

    return (
      <Badge
        variant="outline"
        className={statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-300'}
      >
        {t(`production.orderStatus.${status}`)}
      </Badge>
    );
  };

  const getEventTypeBadge = (eventType: string) => {
    const eventColors: Record<string, string> = {
      'start': 'bg-green-100 text-green-800 border-green-300',
      'pause': 'bg-orange-100 text-orange-800 border-orange-300',
      'resume': 'bg-blue-100 text-blue-800 border-blue-300',
      'material_added': 'bg-purple-100 text-purple-800 border-purple-300',
      'completed': 'bg-emerald-100 text-emerald-800 border-emerald-300',
      'quality_check': 'bg-cyan-100 text-cyan-800 border-cyan-300',
      'issue': 'bg-red-100 text-red-800 border-red-300',
    };

    return (
      <Badge
        variant="outline"
        className={eventColors[eventType] || 'bg-gray-100 text-gray-800 border-gray-300'}
      >
        {t(`production.eventTypes.${eventType}`)}
      </Badge>
    );
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—';
    try {
      return format(new Date(date), 'PPp');
    } catch (error) {
      return '—';
    }
  };

  const calculateProgress = () => {
    if (!order) return 0;
    
    if (order.status === 'completed' || order.status === 'approved') return 100;
    if (order.status === 'planned') return 0;
    
    // Calculate based on logs
    if (logs && logs.length > 0) {
      // Simplified calculation based on logs count
      const totalSteps = 5; // Start, material additions (x3), completion
      const completedSteps = Math.min(logs.length, totalSteps);
      return Math.min(Math.round((completedSteps / totalSteps) * 100), 95);
    }
    
    // Default progress based on status
    switch (order.status) {
      case 'material_check': return 20;
      case 'in_progress': return 60;
      case 'quality_check': return 90;
      case 'partially_completed': return 80;
      default: return 0;
    }
  };

  const getMaterialConsumptionStatus = () => {
    if (!recipeMaterials.length || !consumedMaterials.length) return 0;
    
    const totalMaterials = recipeMaterials.length;
    const consumedCount = consumedMaterials.reduce((acc: number, material: any) => {
      if (material.consumed) return acc + 1;
      return acc;
    }, 0);
    
    return Math.round((consumedCount / totalMaterials) * 100);
  };

  const isLoading = orderLoading || logsLoading || materialsLoading || recipeMaterialsLoading || qualityChecksLoading;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px]">
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (orderError || !order) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>{t('production.orderDetails')}</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('errorOccurred')}</AlertTitle>
            <AlertDescription>
              {t('production.errorLoadingOrderDetails')}
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {order.orderNumber}
              <span className="text-muted-foreground mx-2">•</span>
              {order.productName}
              {getStatusBadge(order.status)}
            </DialogTitle>
            <DialogDescription>
              {t('production.orderDetailsDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(order)}>
                  <Edit className="mr-2 h-4 w-4" />
                  {t('production.editOrder')}
                </Button>
              )}
              
              {['planned', 'material_check'].includes(order.status) && (
                <Button variant="default" size="sm" onClick={handleStartProduction} disabled={processingAction}>
                  {processingAction ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {t('production.start')}
                </Button>
              )}
              
              {order.status === 'in_progress' && (
                <>
                  <Button variant="default" size="sm" onClick={handleCompleteProduction} disabled={processingAction}>
                    {processingAction ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    {t('production.complete')}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setMaterialDialogOpen(true)}
                  >
                    <PackagePlus className="mr-2 h-4 w-4" />
                    {t('production.addMaterials')}
                  </Button>
                </>
              )}
              
              {(order.status === 'in_progress' || order.status === 'completed') && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleQualityCheck} 
                  disabled={processingAction}
                >
                  {processingAction ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  {t('production.qualityCheck')}
                </Button>
              )}
              
              {order.status === 'quality_check' && (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={() => setQualityCheckDialogOpen(true)}
                >
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  {t('production.performQualityCheck')}
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">
                {t('production.progress')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Progress value={calculateProgress()} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <span>{t('production.orderStatus.planned')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                    <span>{t('production.orderStatus.in_progress')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                    <span>{t('production.orderStatus.quality_check')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span>{t('production.orderStatus.completed')}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="details">
                <FileText className="h-4 w-4 mr-2" />
                {t('production.details')}
              </TabsTrigger>
              <TabsTrigger value="materials">
                <Package className="h-4 w-4 mr-2" />
                {t('production.materials')}
              </TabsTrigger>
              <TabsTrigger value="logs">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                {t('production.logs')}
              </TabsTrigger>
              <TabsTrigger value="quality">
                <Gauge className="h-4 w-4 mr-2" />
                {t('production.quality')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">{t('production.product')}</h4>
                  <p className="text-sm">{order.productName || '—'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">{t('production.recipe')}</h4>
                  <p className="text-sm">{order.recipeName || '—'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">{t('production.batchNumber')}</h4>
                  <p className="text-sm">{order.batchNumber || '—'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">{t('production.status')}</h4>
                  <div className="text-sm">{getStatusBadge(order.status)}</div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">{t('production.plannedQuantity')}</h4>
                  <p className="text-sm">{order.plannedQuantity}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">{t('production.actualQuantity')}</h4>
                  <p className="text-sm">{order.actualQuantity || '—'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">{t('production.startDate')}</h4>
                  <p className="text-sm">{formatDate(order.startDate)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">{t('production.endDate')}</h4>
                  <p className="text-sm">{formatDate(order.endDate)}</p>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-1">{t('notes')}</h4>
                <p className="text-sm whitespace-pre-wrap">{order.notes || '—'}</p>
              </div>
            </TabsContent>

            <TabsContent value="materials" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">{t('production.materialRequirements')}</h3>
                
                {order.status === 'in_progress' && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setMaterialDialogOpen(true)}
                  >
                    <PackagePlus className="mr-2 h-4 w-4" />
                    {t('production.recordConsumption')}
                  </Button>
                )}
              </div>
              
              {recipeMaterialsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : recipeMaterials.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-medium">{t('production.consumptionProgress')}</h4>
                    <span className="text-sm font-medium">{getMaterialConsumptionStatus()}%</span>
                  </div>
                  <Progress value={getMaterialConsumptionStatus()} className="h-2 mb-4" />
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('production.material')}</TableHead>
                        <TableHead>{t('production.required')}</TableHead>
                        <TableHead>{t('production.consumed')}</TableHead>
                        <TableHead>{t('production.remaining')}</TableHead>
                        <TableHead>{t('production.status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipeMaterials.map((material: any) => {
                        const consumedMaterial = consumedMaterials.find(
                          (m: any) => m.materialId === material.materialId
                        );
                        
                        const consumed = consumedMaterial ? consumedMaterial.quantity : 0;
                        const remaining = material.quantity - consumed;
                        const isConsumed = consumed >= material.quantity;
                        
                        return (
                          <TableRow key={material.id}>
                            <TableCell>
                              <div className="font-medium">{material.materialName}</div>
                              <div className="text-xs text-slate-500">{material.unit}</div>
                            </TableCell>
                            <TableCell>{material.quantity}</TableCell>
                            <TableCell>{consumed || 0}</TableCell>
                            <TableCell>{remaining > 0 ? remaining : 0}</TableCell>
                            <TableCell>
                              {isConsumed ? (
                                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                  <Check className="mr-1 h-3 w-3" />
                                  {t('production.fulfilled')}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                  <ChevronRight className="mr-1 h-3 w-3" />
                                  {t('production.pending')}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Alert>
                  <AlertTitle>{t('production.noMaterialsFound')}</AlertTitle>
                  <AlertDescription>
                    {t('production.noMaterialsFoundDescription')}
                  </AlertDescription>
                </Alert>
              )}
              
              {consumedMaterials.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-2">{t('production.consumptionHistory')}</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('production.material')}</TableHead>
                        <TableHead>{t('production.quantity')}</TableHead>
                        <TableHead>{t('production.date')}</TableHead>
                        <TableHead>{t('notes')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consumedMaterials.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.materialName}</div>
                            {item.unit && <div className="text-xs text-slate-500">{item.unit}</div>}
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>
                            {item.consumedAt ? formatDate(item.consumedAt) : '-'}
                          </TableCell>
                          <TableCell>{item.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="logs">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">{t('production.productionLogs')}</h3>
                
                {logsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : logs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('production.eventType')}</TableHead>
                        <TableHead>{t('production.timestamp')}</TableHead>
                        <TableHead>{t('production.description')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {getEventTypeBadge(log.eventType)}
                          </TableCell>
                          <TableCell>
                            {formatDate(log.createdAt)}
                          </TableCell>
                          <TableCell>{log.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    {t('production.noLogsYet')}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="quality">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">{t('production.qualityChecks')}</h3>
                  
                  {order.status === 'quality_check' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setQualityCheckDialogOpen(true)}
                    >
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      {t('production.addQualityCheck')}
                    </Button>
                  )}
                </div>
                
                {qualityChecksLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : qualityChecks.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('production.checkType')}</TableHead>
                        <TableHead>{t('production.date')}</TableHead>
                        <TableHead>{t('production.result')}</TableHead>
                        <TableHead>{t('notes')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {qualityChecks.map((check: any) => (
                        <TableRow key={check.id}>
                          <TableCell>
                            {check.checkType}
                          </TableCell>
                          <TableCell>
                            {formatDate(check.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                check.passed
                                  ? 'bg-green-100 text-green-800 border-green-300'
                                  : 'bg-red-100 text-red-800 border-red-300'
                              }
                            >
                              {check.passed ? t('production.passed') : t('production.failed')}
                            </Badge>
                          </TableCell>
                          <TableCell>{check.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    {t('production.noQualityChecksYet')}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('close')}
            </Button>
            
            {order.status === 'completed' && (
              <Button variant="default">
                <Printer className="mr-2 h-4 w-4" />
                {t('production.printProductionReport')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Material Consumption Dialog */}
      <MaterialConsumptionDialog
        open={materialDialogOpen}
        onOpenChange={setMaterialDialogOpen}
        productionOrderId={orderId}
        recipeId={order?.recipeId || null}
      />

      {/* Quality Check Dialog */}
      <ProductionQualityCheckDialog
        open={qualityCheckDialogOpen}
        onClose={() => setQualityCheckDialogOpen(false)}
        productionOrderId={orderId}
      />
    </>
  );
}