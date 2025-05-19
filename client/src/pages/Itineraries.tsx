import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Printer, Edit, Trash, CalendarDays, Package, Search, Truck, FileText, FilterX, Filter } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { el } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

// Enhanced types for our components
type Itinerary = {
  id: number;
  itineraryNumber: string;
  departureDate: string;
  shippingCompany: string | null;
  driverName: string | null;
  vehicleInfo: string | null;
  totalBoxes: number;
  notes: string | null;
  status: 'active' | 'completed' | 'cancelled';
  createdAt?: string;
};

type Order = {
  id: number;
  orderNumber: string;
  customerName: string;
  boxCount: number;
  shippingCompany?: string | null;
  shippingAddress?: string | null;
  area?: string | null;
  totalItems?: number;
};

export default function Itineraries() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isOrdersDialogOpen, setIsOrdersDialogOpen] = useState(false);
  const [isAddOrderDialogOpen, setIsAddOrderDialogOpen] = useState(false);
  const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderFilter, setOrderFilter] = useState('all'); // 'all', 'byArea', 'byShipping'
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedShippingCompany, setSelectedShippingCompany] = useState<string | null>(null);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  
  // Form state for creating new itinerary
  const [formData, setFormData] = useState({
    itineraryNumber: '',
    departureDate: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
    driverName: '',
    vehicleInfo: '',
    shippingCompany: '',
    notes: ''
  });

  // Get all itineraries with status filtering
  const [statusFilter, setStatusFilter] = useState<string>('active');
  
  const { data: itineraries, isLoading } = useQuery({
    queryKey: ['/api/itineraries', statusFilter],
    queryFn: async () => {
      try {
        const url = statusFilter === 'all' 
          ? '/api/itineraries' 
          : `/api/itineraries?status=${statusFilter}`;
          
        const response = await apiRequest(url, { method: 'GET' });
        if (!response.ok) throw new Error('Failed to fetch itineraries');
        return await response.json();
      } catch (error) {
        console.error('Error fetching itineraries:', error);
        return [];
      }
    }
  });

  // Create new itinerary
  const createItineraryMutation = useMutation({
    mutationFn: async (data: typeof formData & { orderIds?: number[] }) => {
      const response = await apiRequest('/api/itineraries', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to create itinerary');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t('Itinerary created'),
        description: t('New delivery itinerary has been created successfully'),
      });
      setIsCreateDialogOpen(false);
      
      // If we have selected orders during creation, add them immediately after
      if (selectedOrders.length > 0) {
        addOrdersMutation.mutate({
          itineraryId: data.id,
          orderIds: selectedOrders
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/itineraries'] });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: t('Error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Get orders for an itinerary
  const { data: itineraryOrders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['/api/itineraries', selectedItinerary?.id, 'orders'],
    queryFn: async () => {
      if (!selectedItinerary) return [];
      try {
        const response = await apiRequest(`/api/itineraries/${selectedItinerary.id}/orders`, { method: 'GET' });
        if (!response.ok) throw new Error('Failed to fetch orders');
        return await response.json();
      } catch (error) {
        console.error('Error fetching orders:', error);
        return [];
      }
    },
    enabled: !!selectedItinerary
  });
  
  // Get shipping areas for filtering
  const { data: areas } = useQuery({
    queryKey: ['/api/areas'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/orders/areas', { method: 'GET' });
        if (!response.ok) return [];
        return await response.json();
      } catch (error) {
        console.error('Error fetching areas:', error);
        return [];
      }
    }
  });
  
  // Get shipping companies for filtering
  const { data: shippingCompanies } = useQuery({
    queryKey: ['/api/shipping-companies'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/customers/shipping-companies', { method: 'GET' });
        if (!response.ok) return [];
        return await response.json();
      } catch (error) {
        console.error('Error fetching shipping companies:', error);
        return [];
      }
    }
  });

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Reset form state
  const resetForm = () => {
    setFormData({
      itineraryNumber: '',
      departureDate: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
      driverName: '',
      vehicleInfo: '',
      shippingCompany: '',
      notes: ''
    });
    setSelectedOrders([]);
  };

  // Submit form handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      orderIds: selectedOrders.length > 0 ? selectedOrders : undefined
    };
    
    createItineraryMutation.mutate(submitData);
  };

  // View orders for a specific itinerary
  const handleViewOrders = (itinerary: Itinerary) => {
    setSelectedItinerary(itinerary);
    setIsOrdersDialogOpen(true);
  };

  // Print itinerary
  const handlePrintItinerary = (itineraryId: number) => {
    window.open(`/api/itineraries/${itineraryId}/print`, '_blank');
  };
  
  // Remove order from itinerary
  const removeOrderMutation = useMutation({
    mutationFn: async ({ itineraryId, orderId }: { itineraryId: number, orderId: number }) => {
      const response = await apiRequest(`/api/itineraries/${itineraryId}/orders/${orderId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to remove order from itinerary');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('Order removed'),
        description: t('Order has been removed from the itinerary'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/itineraries', selectedItinerary?.id, 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/itineraries'] });
    },
    onError: (error) => {
      toast({
        title: t('Error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Handle removing order from itinerary
  const handleRemoveOrder = (orderId: number) => {
    if (!selectedItinerary) return;
    
    if (window.confirm(t('Are you sure you want to remove this order from the itinerary?'))) {
      removeOrderMutation.mutate({ 
        itineraryId: selectedItinerary.id, 
        orderId 
      });
    }
  };
  
  // Update itinerary status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ itineraryId, status }: { itineraryId: number, status: 'active' | 'completed' | 'cancelled' }) => {
      const response = await apiRequest(`/api/itineraries/${itineraryId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error('Failed to update itinerary status');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('Status updated'),
        description: t('Itinerary status has been updated'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/itineraries'] });
    },
    onError: (error) => {
      toast({
        title: t('Error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Handle updating itinerary status
  const handleUpdateStatus = (itineraryId: number, status: 'active' | 'completed' | 'cancelled') => {
    updateStatusMutation.mutate({ itineraryId, status });
  };

  // Get available orders for adding to itinerary
  const { data: availableOrders, isLoading: isLoadingAvailableOrders } = useQuery({
    queryKey: ['/api/orders', 'available', searchQuery],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/orders/available?search=${encodeURIComponent(searchQuery)}`, { method: 'GET' });
        if (!response.ok) throw new Error('Failed to fetch available orders');
        return await response.json();
      } catch (error) {
        console.error('Error fetching available orders:', error);
        return [];
      }
    },
    enabled: isAddOrderDialogOpen
  });

  // Add orders to itinerary
  const addOrdersMutation = useMutation({
    mutationFn: async ({ itineraryId, orderIds }: { itineraryId: number, orderIds: number[] }) => {
      const response = await apiRequest(`/api/itineraries/${itineraryId}/orders`, {
        method: 'POST',
        body: JSON.stringify({ orderIds }),
      });
      if (!response.ok) {
        throw new Error('Failed to add orders to itinerary');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('Orders added'),
        description: t('Orders have been added to the itinerary'),
      });
      setIsAddOrderDialogOpen(false);
      setSelectedOrders([]);
      queryClient.invalidateQueries({ queryKey: ['/api/itineraries', selectedItinerary?.id, 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/itineraries'] });
    },
    onError: (error) => {
      toast({
        title: t('Error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Handle selection of orders
  const handleOrderSelection = (orderId: number) => {
    setSelectedOrders(prev => {
      if (prev.includes(orderId)) {
        return prev.filter(id => id !== orderId);
      } else {
        return [...prev, orderId];
      }
    });
  };

  // Handle adding selected orders to itinerary
  const handleAddOrders = () => {
    if (!selectedItinerary || selectedOrders.length === 0) return;
    
    addOrdersMutation.mutate({
      itineraryId: selectedItinerary.id,
      orderIds: selectedOrders
    });
  };

  // Generate a suggested itinerary number based on date and next sequential number
  useEffect(() => {
    if (isCreateDialogOpen && !formData.itineraryNumber) {
      const date = new Date();
      const dateStr = format(date, 'yyyyMMdd');
      const nextNum = itineraries?.length ? itineraries.length + 1 : 1;
      const suggestedNumber = `IT-${dateStr}-${nextNum.toString().padStart(3, '0')}`;
      setFormData(prev => ({ ...prev, itineraryNumber: suggestedNumber }));
    }
  }, [isCreateDialogOpen, itineraries]);

  // Render component
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Δρομολόγια</h1>
          <p className="text-muted-foreground">Διαχείριση δρομολογίων παράδοσης</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus size={16} />
                Νέο Δρομολόγιο
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Δημιουργία Νέου Δρομολογίου</DialogTitle>
                <DialogDescription>
                  Συμπληρώστε τα στοιχεία του νέου δρομολογίου παράδοσης
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="itineraryNumber">Αριθμός Δρομολογίου</Label>
                      <Input
                        id="itineraryNumber"
                        name="itineraryNumber"
                        value={formData.itineraryNumber}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="departureDate">Ημερομηνία Αναχώρησης</Label>
                      <Input
                        id="departureDate"
                        name="departureDate"
                        type="datetime-local"
                        value={formData.departureDate}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="driverName">Όνομα Οδηγού</Label>
                      <Input
                        id="driverName"
                        name="driverName"
                        value={formData.driverName}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vehicleInfo">Στοιχεία Οχήματος</Label>
                      <Input
                        id="vehicleInfo"
                        name="vehicleInfo"
                        value={formData.vehicleInfo}
                        onChange={handleInputChange}
                        placeholder="Αριθμός κυκλοφορίας / Τύπος"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shippingCompany">Μεταφορική Εταιρεία</Label>
                    <Input
                      id="shippingCompany"
                      name="shippingCompany"
                      value={formData.shippingCompany}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Σημειώσεις</Label>
                    <Input
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      className="h-20"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Ακύρωση
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createItineraryMutation.isPending}
                  >
                    {createItineraryMutation.isPending ? 'Επεξεργασία...' : 'Αποθήκευση'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Itineraries list */}
      <Card>
        <CardHeader>
          <CardTitle>Λίστα Δρομολογίων</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center p-4">Φόρτωση δρομολογίων...</div>
          ) : itineraries?.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Αριθμός</TableHead>
                  <TableHead>Ημερομηνία</TableHead>
                  <TableHead>Οδηγός</TableHead>
                  <TableHead>Μεταφορική</TableHead>
                  <TableHead className="text-center">Κιβώτια</TableHead>
                  <TableHead>Κατάσταση</TableHead>
                  <TableHead className="text-right">Ενέργειες</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itineraries.map((itinerary: Itinerary) => (
                  <TableRow key={itinerary.id}>
                    <TableCell className="font-medium">{itinerary.itineraryNumber}</TableCell>
                    <TableCell>
                      {format(new Date(itinerary.departureDate), 'dd/MM/yyyy HH:mm', { locale: el })}
                    </TableCell>
                    <TableCell>{itinerary.driverName || '-'}</TableCell>
                    <TableCell>{itinerary.shippingCompany || '-'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <Package size={14} className="mr-1" />
                        {itinerary.totalBoxes}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          itinerary.status === 'active' ? 'bg-green-100 text-green-800' :
                          itinerary.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {itinerary.status === 'active' ? 'Ενεργό' :
                           itinerary.status === 'completed' ? 'Ολοκληρώθηκε' :
                           'Ακυρώθηκε'}
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="py-0 px-1 h-6">
                              <Edit size={14} />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Αλλαγή Κατάστασης</DialogTitle>
                              <DialogDescription>
                                Επιλέξτε τη νέα κατάσταση για το δρομολόγιο {itinerary.itineraryNumber}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-3 gap-2">
                                <Button 
                                  variant={itinerary.status === 'active' ? 'default' : 'outline'} 
                                  className={itinerary.status === 'active' ? 'bg-green-600' : ''} 
                                  onClick={() => handleUpdateStatus(itinerary.id, 'active')}
                                  disabled={updateStatusMutation.isPending}
                                >
                                  Ενεργό
                                </Button>
                                <Button 
                                  variant={itinerary.status === 'completed' ? 'default' : 'outline'} 
                                  className={itinerary.status === 'completed' ? 'bg-blue-600' : ''} 
                                  onClick={() => handleUpdateStatus(itinerary.id, 'completed')}
                                  disabled={updateStatusMutation.isPending}
                                >
                                  Ολοκληρώθηκε
                                </Button>
                                <Button 
                                  variant={itinerary.status === 'cancelled' ? 'default' : 'outline'} 
                                  className={itinerary.status === 'cancelled' ? 'bg-red-600' : ''} 
                                  onClick={() => handleUpdateStatus(itinerary.id, 'cancelled')}
                                  disabled={updateStatusMutation.isPending}
                                >
                                  Ακυρώθηκε
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleViewOrders(itinerary)}
                          title="Προβολή παραγγελιών"
                        >
                          <CalendarDays size={16} />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handlePrintItinerary(itinerary.id)}
                          title="Εκτύπωση δρομολογίου"
                        >
                          <Printer size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center p-6">
              <p className="text-muted-foreground mb-4">Δεν υπάρχουν δρομολόγια ακόμα</p>
              <Button 
                variant="outline" 
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus size={16} className="mr-2" />
                Δημιουργία Πρώτου Δρομολογίου
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for viewing orders in an itinerary */}
      <Dialog open={isOrdersDialogOpen} onOpenChange={setIsOrdersDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>
              Παραγγελίες Δρομολογίου {selectedItinerary?.itineraryNumber}
            </DialogTitle>
            <DialogDescription>
              {selectedItinerary && format(new Date(selectedItinerary.departureDate), 'dd/MM/yyyy', { locale: el })}
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingOrders ? (
            <div className="text-center p-4">Φόρτωση παραγγελιών...</div>
          ) : itineraryOrders?.length > 0 ? (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Αριθμός</TableHead>
                    <TableHead>Πελάτης</TableHead>
                    <TableHead className="text-center">Κιβώτια</TableHead>
                    <TableHead className="text-right">Ενέργειες</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itineraryOrders.map((order: Order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell className="text-center">{order.boxCount}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          title="Αφαίρεση από δρομολόγιο"
                          onClick={() => handleRemoveOrder(order.id)}
                          disabled={removeOrderMutation.isPending}
                        >
                          <Trash size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center p-6">
              <p className="text-muted-foreground">Δεν υπάρχουν παραγγελίες σε αυτό το δρομολόγιο</p>
            </div>
          )}
          
          <DialogFooter className="flex justify-between">
            <div>
              <span className="text-sm font-medium text-muted-foreground mr-2">
                Συνολικά Κιβώτια:
              </span>
              <span className="font-bold">
                {selectedItinerary?.totalBoxes || 0}
              </span>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsOrdersDialogOpen(false)}
              >
                Κλείσιμο
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setIsAddOrderDialogOpen(true);
                  setSelectedOrders([]);
                }}
              >
                <Plus size={16} className="mr-2" />
                Προσθήκη Παραγγελιών
              </Button>
              <Button 
                onClick={() => selectedItinerary && handlePrintItinerary(selectedItinerary.id)}
              >
                <Printer size={16} className="mr-2" />
                Εκτύπωση Λίστας
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for adding orders to an itinerary */}
      <Dialog open={isAddOrderDialogOpen} onOpenChange={setIsAddOrderDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>
              Προσθήκη Παραγγελιών στο Δρομολόγιο {selectedItinerary?.itineraryNumber}
            </DialogTitle>
            <DialogDescription>
              Επιλέξτε τις παραγγελίες που θέλετε να προσθέσετε στο δρομολόγιο
            </DialogDescription>
          </DialogHeader>
          
          <div className="mb-4">
            <div className="flex items-center space-x-2">
              <Search size={16} className="text-gray-400" />
              <Input
                placeholder="Αναζήτηση με αριθμό παραγγελίας ή όνομα πελάτη..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          
          {isLoadingAvailableOrders ? (
            <div className="text-center p-4">Φόρτωση διαθέσιμων παραγγελιών...</div>
          ) : availableOrders?.length > 0 ? (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Επιλογή</TableHead>
                    <TableHead>Αριθμός</TableHead>
                    <TableHead>Πελάτης</TableHead>
                    <TableHead>Ημερομηνία</TableHead>
                    <TableHead className="text-center">Κιβώτια</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableOrders.map((order: any) => (
                    <TableRow key={order.id} className={selectedOrders.includes(order.id) ? 'bg-gray-50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={() => handleOrderSelection(order.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell>{format(new Date(order.orderDate), 'dd/MM/yyyy', { locale: el })}</TableCell>
                      <TableCell className="text-center">{order.boxCount || '?'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center p-6">
              <p className="text-muted-foreground">Δεν βρέθηκαν διαθέσιμες παραγγελίες</p>
            </div>
          )}
          
          <DialogFooter>
            <div className="flex justify-between w-full">
              <div className="text-sm">
                {selectedOrders.length} επιλεγμένες παραγγελίες
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddOrderDialogOpen(false)}
                >
                  Ακύρωση
                </Button>
                <Button 
                  onClick={handleAddOrders} 
                  disabled={selectedOrders.length === 0 || addOrdersMutation.isPending}
                >
                  {addOrdersMutation.isPending ? 'Προσθήκη...' : 'Προσθήκη Παραγγελιών'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}