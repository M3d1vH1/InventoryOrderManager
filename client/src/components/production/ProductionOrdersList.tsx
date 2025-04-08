import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
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
  DialogTrigger
} from '@/components/ui/dialog';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Search, Plus, FileText, Play, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// Mock data for demonstration
const mockOrders = [
  {
    id: 1,
    orderNumber: 'PO-2025-001',
    productId: 5,
    productName: 'Premium EVOO 750ml',
    recipeId: 1,
    recipeName: 'Premium Extra Virgin Olive Oil 750ml',
    plannedQuantity: 1000,
    actualQuantity: 950,
    status: 'completed',
    startDate: new Date('2025-04-02T10:30:00'),
    endDate: new Date('2025-04-02T16:45:00'),
    batchId: 1,
    batchNumber: 'B-2025-001',
    notes: 'Production completed with high quality output',
    logs: [
      { id: 1, eventType: 'start', description: 'Production started', createdAt: new Date('2025-04-02T10:30:00') },
      { id: 2, eventType: 'material_added', description: 'Added 750 liters of olive oil', createdAt: new Date('2025-04-02T11:15:00') },
      { id: 3, eventType: 'material_added', description: 'Added 1000 glass bottles', createdAt: new Date('2025-04-02T13:00:00') },
      { id: 4, eventType: 'material_added', description: 'Added 1000 bottle caps', createdAt: new Date('2025-04-02T14:30:00') },
      { id: 5, eventType: 'material_added', description: 'Added 1000 labels', createdAt: new Date('2025-04-02T15:15:00') },
      { id: 6, eventType: 'completed', description: 'Production completed with 950 bottles', createdAt: new Date('2025-04-02T16:45:00') }
    ]
  },
  {
    id: 2,
    orderNumber: 'PO-2025-002',
    productId: 8,
    productName: 'Organic EVOO 500ml',
    recipeId: 2,
    recipeName: 'Organic Extra Virgin Olive Oil 500ml',
    plannedQuantity: 800,
    actualQuantity: null,
    status: 'in_progress',
    startDate: new Date('2025-04-10T09:15:00'),
    endDate: null,
    batchId: 2,
    batchNumber: 'B-2025-002',
    notes: 'Organic production in progress',
    logs: [
      { id: 7, eventType: 'start', description: 'Production started', createdAt: new Date('2025-04-10T09:15:00') },
      { id: 8, eventType: 'material_added', description: 'Added 400 liters of olive oil', createdAt: new Date('2025-04-10T10:00:00') },
      { id: 9, eventType: 'material_added', description: 'Added 800 glass bottles', createdAt: new Date('2025-04-10T11:30:00') },
      { id: 10, eventType: 'material_added', description: 'Added 800 bottle caps', createdAt: new Date('2025-04-10T13:00:00') },
      { id: 11, eventType: 'pause', description: 'Production paused for lunch break', createdAt: new Date('2025-04-10T13:15:00') }
    ]
  },
  {
    id: 3,
    orderNumber: 'PO-2025-003',
    productId: 12,
    productName: 'Gift Box Collection',
    recipeId: 3,
    recipeName: 'Gift Box 3x250ml',
    plannedQuantity: 500,
    actualQuantity: null,
    status: 'planned',
    startDate: new Date('2025-05-05T08:00:00'),
    endDate: null,
    batchId: 3,
    batchNumber: 'B-2025-003',
    notes: 'Gift box production scheduled',
    logs: []
  }
];

export default function ProductionOrdersList() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState(mockOrders);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('details');

  const filteredOrders = searchTerm 
    ? orders.filter(order => 
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.recipeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : orders;

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order);
    setOpenDialog(true);
    setActiveTab('details');
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
    
    // Calculate progress based on production steps in logs
    const totalSteps = 5; // Start, material additions (x3), completion
    const completedSteps = order.logs.length;
    
    return Math.min(Math.round((completedSteps / totalSteps) * 100), 95);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{t('production.ordersList')}</CardTitle>
            <CardDescription>{t('production.ordersDescription')}</CardDescription>
          </div>
          <Button>
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
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
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
                        onClick={() => handleViewOrder(order)}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        {t('production.details')}
                      </Button>
                      
                      {order.status === 'planned' && (
                        <Button variant="default" size="sm">
                          <Play className="mr-2 h-4 w-4" />
                          {t('production.start')}
                        </Button>
                      )}
                      
                      {order.status === 'in_progress' && (
                        <Button variant="default" size="sm">
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

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>
                {selectedOrder?.orderNumber} - {selectedOrder?.productName}
              </DialogTitle>
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
                      <p className="text-sm">{selectedOrder.productName}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">{t('production.recipe')}</h4>
                      <p className="text-sm">{selectedOrder.recipeName}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">{t('production.batchNumber')}</h4>
                      <p className="text-sm">{selectedOrder.batchNumber}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">{t('production.status')}</h4>
                      <p className="text-sm">{getStatusBadge(selectedOrder.status)}</p>
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
                      <p className="text-sm">
                        {selectedOrder.startDate ? format(new Date(selectedOrder.startDate), 'PPp') : '—'}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">{t('production.endDate')}</h4>
                      <p className="text-sm">
                        {selectedOrder.endDate ? format(new Date(selectedOrder.endDate), 'PPp') : '—'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-1">{t('notes')}</h4>
                    <p className="text-sm">{selectedOrder.notes || '—'}</p>
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
                </TabsContent>
                
                <TabsContent value="logs">
                  {selectedOrder.logs.length > 0 ? (
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
                          {selectedOrder.logs.map((log: any) => (
                            <TableRow key={log.id}>
                              <TableCell>{getEventTypeBadge(log.eventType)}</TableCell>
                              <TableCell>{format(new Date(log.createdAt), 'PPp')}</TableCell>
                              <TableCell>{log.description}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      {t('production.noLogsYet')}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}