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
import { Search, Plus, FileText, Play, CheckCircle, Edit, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import ProductionOrderForm from './ProductionOrderForm';
import ProductionOrderDetails from './ProductionOrderDetails';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

export default function ProductionOrdersList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<any>(null);
  const [processing, setProcessing] = useState<boolean>(false);

  // Fetch orders from API
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['/api/production/orders'],
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
    setSelectedOrderForEdit(null);
    setOrderFormOpen(true);
  };

  const handleEditOrder = (order: any) => {
    setSelectedOrderForEdit(order);
    setOrderFormOpen(true);
  };

  const handleViewDetails = (order: any) => {
    setSelectedOrderId(order.id);
    setDetailsDialogOpen(true);
  };

  const handleStartProduction = async (order: any) => {
    if (order.status !== 'planned' && order.status !== 'material_check') return;
    
    setProcessing(true);
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
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteProduction = async (order: any) => {
    if (order.status !== 'in_progress') return;
    
    setProcessing(true);
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
    } finally {
      setProcessing(false);
    }
  };

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

  const calculateProgress = (order: any) => {
    if (order.status === 'completed' || order.status === 'approved') return 100;
    if (order.status === 'planned') return 0;
    
    // Default progress based on status
    switch (order.status) {
      case 'material_check': return 20;
      case 'in_progress': return 60;
      case 'quality_check': return 90;
      case 'partially_completed': return 80;
      default: return 0;
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
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        {t('loading')}...
                      </div>
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
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-2"
                          onClick={() => handleEditOrder(order)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          {t('edit')}
                        </Button>
                        
                        {['planned', 'material_check'].includes(order.status) && (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => handleStartProduction(order)}
                            disabled={processing}
                          >
                            {processing ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="mr-2 h-4 w-4" />
                            )}
                            {t('production.start')}
                          </Button>
                        )}
                        
                        {order.status === 'in_progress' && (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => handleCompleteProduction(order)}
                            disabled={processing}
                          >
                            {processing ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="mr-2 h-4 w-4" />
                            )}
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
        orderToEdit={selectedOrderForEdit} 
      />

      {/* Production Order Details */}
      {detailsDialogOpen && (
        <ProductionOrderDetails
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          orderId={selectedOrderId}
          onEdit={handleEditOrder}
        />
      )}
    </>
  );
}