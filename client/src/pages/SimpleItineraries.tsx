import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Truck, Package, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/queryClient';
import { Checkbox } from '@/components/ui/checkbox';

// Simple types that match our backend
type Itinerary = {
  id: number;
  itineraryNumber: string;
  departureDate: string;
  driverName: string | null;
  vehicleInfo: string | null;
  notes: string | null;
  status: string;
  totalBoxes: number;
};

type Order = {
  id: number;
  orderNumber: string;
  customerName: string;
  boxCount: number;
  area?: string;
  priority?: string;
};

export default function SimpleItineraries() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewOrdersDialogOpen, setViewOrdersDialogOpen] = useState(false);
  const [addOrdersDialogOpen, setAddOrdersDialogOpen] = useState(false);
  
  // Selected item states
  const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    itineraryNumber: '',
    departureDate: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
    driverName: '',
    vehicleInfo: '',
    notes: ''
  });
  
  // Get all itineraries
  const { data: itineraries = [], isLoading: isLoadingItineraries, refetch: refetchItineraries } = useQuery({
    queryKey: ['/api/itineraries'],
    queryFn: async () => {
      const response = await apiRequest('/api/itineraries', { method: 'GET' });
      const data = await response.json();
      console.log('Loaded itineraries:', data.length);
      return data || [];
    }
  });
  
  // Get orders that can be added to itineraries
  const availableOrders = [
    {
      id: 93,
      orderNumber: "ORD-0093",
      customerName: "Μαυρόπουλος Γεώργιος Ιωάννης",
      status: "picked",
      priority: "high",
      boxCount: 3
    },
    {
      id: 153,
      orderNumber: "ORD-0153",
      customerName: "ΤΣΑΟΥΣΟΓΛΟΥ CORFU PALACE ΑΕ ΞΤΕ",
      status: "picked",
      priority: "medium",
      area: "Κέρκυρα",
      boxCount: 4
    },
    {
      id: 154,
      orderNumber: "ORD-0154",
      customerName: "La Pasteria - White River",
      status: "picked",
      priority: "medium",
      boxCount: 2
    }
  ];
  
  const isLoadingOrders = false;
  const refetchOrders = () => {};
  
  // Get orders for a specific itinerary
  const { data: itineraryOrders = [], isLoading: isLoadingItineraryOrders, refetch: refetchItineraryOrders } = useQuery({
    queryKey: ['/api/itineraries', selectedItinerary?.id, 'orders'],
    queryFn: async () => {
      if (!selectedItinerary) return [];
      
      const response = await apiRequest(`/api/itineraries/${selectedItinerary.id}/orders`, { method: 'GET' });
      const data = await response.json();
      console.log(`Loaded ${data.length} orders for itinerary #${selectedItinerary.id}`);
      return data || [];
    },
    enabled: !!selectedItinerary && viewOrdersDialogOpen
  });
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  // Handle creating new itinerary
  const handleCreateItinerary = async () => {
    try {
      // Form validation
      if (!formData.itineraryNumber.trim()) {
        toast({
          title: t('Error'),
          description: t('Itinerary number is required'),
          variant: 'destructive'
        });
        return;
      }
      
      // Send API request to create itinerary
      const response = await apiRequest('/api/itineraries', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          orderIds: selectedOrderIds.length > 0 ? selectedOrderIds : undefined
        })
      });
      
      if (!response.ok) {
        throw new Error(t('Failed to create itinerary'));
      }
      
      // Success
      toast({
        title: t('Success'),
        description: t('Itinerary created successfully')
      });
      
      // Reset form and close dialog
      setFormData({
        itineraryNumber: '',
        departureDate: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
        driverName: '',
        vehicleInfo: '',
        notes: ''
      });
      setSelectedOrderIds([]);
      setCreateDialogOpen(false);
      
      // Refresh itineraries list
      refetchItineraries();
    } catch (error) {
      console.error('Error creating itinerary:', error);
      toast({
        title: t('Error'),
        description: t('Failed to create itinerary'),
        variant: 'destructive'
      });
    }
  };
  
  // Handle viewing orders for an itinerary
  const handleViewOrders = (itinerary: Itinerary) => {
    setSelectedItinerary(itinerary);
    setViewOrdersDialogOpen(true);
  };
  
  // Handle order selection
  const handleOrderSelect = (orderId: number) => {
    setSelectedOrderIds(prev => {
      if (prev.includes(orderId)) {
        return prev.filter(id => id !== orderId);
      } else {
        return [...prev, orderId];
      }
    });
  };
  
  // Get order selection status
  const isOrderSelected = (orderId: number) => {
    return selectedOrderIds.includes(orderId);
  };
  
  // Get status badge color
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'outline';
      case 'proposed': return 'secondary';
      default: return 'outline';
    }
  };
  
  // Get priority badge color
  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };
  
  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t('Delivery Itineraries')}</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('Create Itinerary')}
        </Button>
      </div>
      
      {/* Itineraries List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('Active Itineraries')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingItineraries ? (
            <div className="flex justify-center p-4">{t('Loading itineraries...')}</div>
          ) : itineraries.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Truck className="h-12 w-12 mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium">{t('No itineraries found')}</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {t('Create your first delivery itinerary to start managing shipments')}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Itinerary Number')}</TableHead>
                  <TableHead>{t('Departure Date')}</TableHead>
                  <TableHead>{t('Driver')}</TableHead>
                  <TableHead>{t('Vehicle')}</TableHead>
                  <TableHead>{t('Total Boxes')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead className="text-right">{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itineraries.map((itinerary) => (
                  <TableRow key={itinerary.id}>
                    <TableCell className="font-medium">{itinerary.itineraryNumber}</TableCell>
                    <TableCell>
                      {new Date(itinerary.departureDate).toLocaleDateString()}
                      {' '}
                      {new Date(itinerary.departureDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>{itinerary.driverName || '-'}</TableCell>
                    <TableCell>{itinerary.vehicleInfo || '-'}</TableCell>
                    <TableCell>{itinerary.totalBoxes}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(itinerary.status)}>
                        {itinerary.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleViewOrders(itinerary)}>
                        {t('View Orders')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Create Itinerary Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('Create New Delivery Itinerary')}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="itineraryNumber">{t('Itinerary Number')}</Label>
                <Input
                  id="itineraryNumber"
                  name="itineraryNumber"
                  value={formData.itineraryNumber}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="departureDate">{t('Departure Date & Time')}</Label>
                <Input
                  id="departureDate"
                  name="departureDate"
                  type="datetime-local"
                  value={formData.departureDate}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="driverName">{t('Driver Name')}</Label>
                <Input
                  id="driverName"
                  name="driverName"
                  value={formData.driverName}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleInfo">{t('Vehicle Information')}</Label>
                <Input
                  id="vehicleInfo"
                  name="vehicleInfo"
                  value={formData.vehicleInfo}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">{t('Notes')}</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
              />
            </div>
            
            {/* Order Selection */}
            <div className="space-y-2 mt-4">
              <div className="flex justify-between items-center">
                <Label>{t('Select Orders for Delivery')}</Label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setAddOrdersDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('Add Orders')}
                </Button>
              </div>
              
              {selectedOrderIds.length === 0 ? (
                <div className="text-muted-foreground text-sm p-4 text-center border rounded-md">
                  {t('No orders selected')}
                </div>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Order #')}</TableHead>
                        <TableHead>{t('Customer')}</TableHead>
                        <TableHead>{t('Boxes')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availableOrders
                        .filter(order => selectedOrderIds.includes(order.id))
                        .map(order => (
                          <TableRow key={order.id}>
                            <TableCell>{order.orderNumber}</TableCell>
                            <TableCell>{order.customerName}</TableCell>
                            <TableCell>{order.boxCount}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleCreateItinerary}>
              {t('Create Itinerary')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* View Orders Dialog */}
      <Dialog open={viewOrdersDialogOpen} onOpenChange={setViewOrdersDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t('Orders for Itinerary')}: {selectedItinerary?.itineraryNumber}
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingItineraryOrders ? (
            <div className="flex justify-center p-4">{t('Loading orders...')}</div>
          ) : itineraryOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Package className="h-12 w-12 mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium">{t('No orders in this itinerary')}</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {t('Add orders to this itinerary to start managing shipments')}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Order Number')}</TableHead>
                    <TableHead>{t('Customer')}</TableHead>
                    <TableHead>{t('Area')}</TableHead>
                    <TableHead>{t('Boxes')}</TableHead>
                    <TableHead>{t('Priority')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itineraryOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell>{order.area || '-'}</TableCell>
                      <TableCell>{order.boxCount}</TableCell>
                      <TableCell>
                        {order.priority && (
                          <Badge variant={getPriorityBadgeVariant(order.priority)}>
                            {order.priority}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Add Orders Dialog */}
      <Dialog open={addOrdersDialogOpen} onOpenChange={setAddOrdersDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('Select Orders for Delivery')}</DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center py-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('Search orders...')}
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          {isLoadingOrders ? (
            <div className="flex justify-center p-4">{t('Loading orders...')}</div>
          ) : availableOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Package className="h-12 w-12 mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium">{t('No orders available')}</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {t('There are no picked orders available for delivery')}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>{t('Order Number')}</TableHead>
                    <TableHead>{t('Customer')}</TableHead>
                    <TableHead>{t('Area')}</TableHead>
                    <TableHead>{t('Boxes')}</TableHead>
                    <TableHead>{t('Priority')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableOrders.map((order) => (
                    <TableRow 
                      key={order.id}
                      className={isOrderSelected(order.id) ? "bg-muted/50" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isOrderSelected(order.id)}
                          onCheckedChange={() => handleOrderSelect(order.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell>{order.area || '-'}</TableCell>
                      <TableCell>{order.boxCount}</TableCell>
                      <TableCell>
                        {order.priority && (
                          <Badge variant={getPriorityBadgeVariant(order.priority)}>
                            {order.priority}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
          
          <DialogFooter>
            <div className="flex items-center mr-auto">
              <span className="text-sm text-muted-foreground">
                {t('Selected')}: {selectedOrderIds.length} {t('orders')}
              </span>
            </div>
            <Button variant="outline" onClick={() => setAddOrdersDialogOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={() => setAddOrdersDialogOpen(false)}>
              {t('Add Selected')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}