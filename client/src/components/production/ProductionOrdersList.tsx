import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Search, Plus, FileText, Play, CheckCircle, Pencil, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import ProductionOrderForm from './ProductionOrderForm';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

export default function ProductionOrdersList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [orderFormOpen, setOrderFormOpen] = useState(false);

  // Fetch orders from API
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['/api/production/orders'],
  });

  // Fetch logs for the selected order
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['/api/production/orders', selectedOrder?.id, 'logs'],
    enabled: !!selectedOrder?.id && detailsDialogOpen,
  });

  const filteredOrders = searchTerm 
    ? orders.filter((order: any) => 
        order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.recipeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : orders;

  const handleAddOrder = () => {
    setSelectedOrder(null);
    setOrderFormOpen(true);
  };

  const handleEditOrder = (order: any) => {
    setSelectedOrder(order);
    setOrderFormOpen(true);
  };

  const handleViewDetails = (order: any) => {
    setSelectedOrder(order);
    setDetailsDialogOpen(true);
    setActiveTab('details');
  };

  const handleStartProduction = async (order: any) => {
    if (order.status !== 'planned') return;
    
    try {
      await apiRequest(`/api/production/orders/${order.id}/status`, {
        method: 'PATCH',
        data: { 
          status: 'in_progress',
          notes: 'Production started'
        }
      });
      
      // Add a production log
      await apiRequest('/api/production/logs', {
        method: 'POST',
        data: {
          productionOrderId: order.id,
          eventType: 'start',
          description: `Production started for ${order.productName}`,
          createdById: 1  // Assuming logged in user id
        }
      });
      
      toast({
        title: t('production.productionStarted'),
        description: t('production.productionStartedDesc'),
      });
      
      // Refresh orders data
      queryClient.invalidateQueries({ queryKey: ['/api/production/orders'] });
      
    } catch (error) {
      console.error('Error starting production:', error);
      toast({
        title: t('errorOccurred'),
        description: t('production.errorStartingProduction'),
        variant: 'destructive',
      });
    }
  };

  const handleCompleteProduction = async (order: any) => {
    if (order.status !== 'in_progress') return;
    
    try {
      await apiRequest(`/api/production/orders/${order.id}/status`, {
        method: 'PATCH',
        data: { 
          status: 'completed',
          notes: 'Production completed'
        }
      });
      
      // Add a production log
      await apiRequest('/api/production/logs', {
        method: 'POST',
        data: {
          productionOrderId: order.id,
          eventType: 'completed',
          description: `Production completed for ${order.productName}`,
          createdById: 1  // Assuming logged in user id
        }
      });
      
      toast({
        title: t('production.productionCompleted'),
        description: t('production.productionCompletedDesc'),
      });
      
      // Refresh orders data
      queryClient.invalidateQueries({ queryKey: ['/api/production/orders'] });
      
    } catch (error) {
      console.error('Error completing production:', error);
      toast({
        title: t('errorOccurred'),
        description: t('production.errorCompletingProduction'),
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'planned': 'bg-blue-100 text-blue-800 border-blue-300',
      'material_check': 'bg-sky-100 text-sky-800 border-sky-300',
      'in_progress': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'completed': 'bg-green-100 text-green-800 border-green-300',
      'partially_completed': 'bg-orange-100 text-orange-800 border-orange-300',
      'cancelled': 'bg-red-100 text-red-800 border-red-300'
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
      'issue': 'bg-red-100 text-red-800 border-red-300'
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

  const calculateProgress = (order: any) => {
    if (order.status === 'completed') return 100;
    if (order.status === 'planned') return 0;
    
    // If we have logs data, use it for more accurate progress
    if (order.logs && order.logs.length > 0) {
      const totalSteps = 5; // Start, material additions (x3), completion
      const completedSteps = order.logs.length;
      return Math.min(Math.round((completedSteps / totalSteps) * 100), 95);
    }
    
    // Default progress based on status
    switch (order.status) {
      case 'material_check': return 20;
      case 'in_progress': return 60;
      case 'partially_completed': return 80;
      default: return 0;
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—';
    try {
      return format(new Date(date), 'PPp');
    } catch (error) {
      return '—';
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{t('production.ordersList')}</CardTitle>
              <CardDescription>{t('production.ordersDescription')}</CardDescription>
            </div>
            <Button onClick={handleAddOrder}>
              <Plus className="mr-2 h-4 w-4" /> {t('production.addOrder')}
            </Button>
          </div>
          <div className="flex mt-4">
            <div className="relative w-full">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('production.searchOrders')}
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('production.orderNumber')}</TableHead>
                  <TableHead>{t('production.product')}</TableHead>
                  <TableHead>{t('production.quantity')}</TableHead>
                  <TableHead>{t('production.status')}</TableHead>
                  <TableHead>{t('production.progress')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">
                      {t('loading')}...
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length > 0 ? (
                  filteredOrders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.productName}</TableCell>
                      <TableCell>
                        {order.actualQuantity 
                          ? `${order.actualQuantity}/${order.plannedQuantity}` 
                          : order.plannedQuantity
                        }
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={calculateProgress(order)} className="h-2 w-[100px]" />
                          <span className="text-xs text-muted-foreground">
                            {calculateProgress(order)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-2"
                          onClick={() => handleViewDetails(order)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {t('production.details')}
                        </Button>
                        
                        {order.status === 'planned' && (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => handleStartProduction(order)}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            {t('production.start')}
                          </Button>
                        )}
                        
                        {order.status === 'in_progress' && (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => handleCompleteProduction(order)}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            {t('production.complete')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      {searchTerm ? t('production.noOrdersFound') : t('production.noOrdersYet')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Production Order Form */}
      <ProductionOrderForm 
        open={orderFormOpen} 
        onOpenChange={setOrderFormOpen} 
        orderToEdit={selectedOrder} 
      />

      {/* Production Order Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>
              {selectedOrder?.orderNumber || ''} - {selectedOrder?.productName || ''}
            </DialogTitle>
            <DialogDescription>
              {t('production.orderDetailsDescription')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <Tabs 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="details">
                  {t('production.orderDetails')}
                </TabsTrigger>
                <TabsTrigger value="logs">
                  {t('production.productionLogs')}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="details">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-1">{t('production.product')}</h4>
                    <p className="text-sm">{selectedOrder.productName || '—'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">{t('production.recipe')}</h4>
                    <p className="text-sm">{selectedOrder.recipeName || '—'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">{t('production.batchNumber')}</h4>
                    <p className="text-sm">{selectedOrder.batchNumber || '—'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">{t('production.status')}</h4>
                    <div className="text-sm">{getStatusBadge(selectedOrder.status)}</div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">{t('production.plannedQuantity')}</h4>
                    <p className="text-sm">{selectedOrder.plannedQuantity}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">{t('production.actualQuantity')}</h4>
                    <p className="text-sm">{selectedOrder.actualQuantity || '—'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">{t('production.startDate')}</h4>
                    <p className="text-sm">{formatDate(selectedOrder.startDate)}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">{t('production.endDate')}</h4>
                    <p className="text-sm">{formatDate(selectedOrder.endDate)}</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-1">{t('notes')}</h4>
                  <p className="text-sm whitespace-pre-wrap">{selectedOrder.notes || '—'}</p>
                </div>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-1">{t('production.progress')}</h4>
                  <Progress 
                    value={calculateProgress(selectedOrder)} 
                    className="h-3 w-full mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-right">
                    {calculateProgress(selectedOrder)}% {t('production.complete')}
                  </p>
                </div>

                {selectedOrder.status === 'planned' && (
                  <div className="mt-4 flex justify-end">
                    <Button 
                      variant="default"
                      onClick={() => {
                        handleStartProduction(selectedOrder);
                        setDetailsDialogOpen(false);
                      }}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {t('production.start')}
                    </Button>
                  </div>
                )}

                {selectedOrder.status === 'in_progress' && (
                  <div className="mt-4 flex justify-end">
                    <Button 
                      variant="default"
                      onClick={() => {
                        handleCompleteProduction(selectedOrder);
                        setDetailsDialogOpen(false);
                      }}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {t('production.complete')}
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="logs">
                {logsLoading ? (
                  <div className="text-center py-4">
                    {t('loading')}...
                  </div>
                ) : logs && logs.length > 0 ? (
                  <div className="rounded-md border">
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
                            <TableCell>{getEventTypeBadge(log.eventType)}</TableCell>
                            <TableCell>{formatDate(log.createdAt)}</TableCell>
                            <TableCell>{log.description}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">
                      {t('production.noLogsYet')}
                    </p>
                  </div>
                )}

                {/* Add Log Entry Button */}
                <div className="mt-6 flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // TODO: Implement add log functionality
                      toast({
                        title: t('notImplemented'),
                        description: t('production.addLogFeatureComingSoon'),
                      });
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t('production.addLogEntry')}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleEditOrder(selectedOrder)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {t('edit')}
            </Button>
            <DialogClose asChild>
              <Button type="button">
                {t('close')}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}