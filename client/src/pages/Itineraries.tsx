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
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, Printer, Edit, Trash, CalendarDays, Package, 
  Search, Truck, FileText, FilterX, Filter, CheckCircle2, 
  XCircle, AlertCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { el } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  status: 'proposed' | 'active' | 'completed' | 'cancelled';
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
  priority?: string | null;
};

export default function Itineraries() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isOrdersDialogOpen, setIsOrdersDialogOpen] = useState(false);
  const [isAddOrderDialogOpen, setIsAddOrderDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderFilter, setOrderFilter] = useState('all'); // 'all', 'byShipping', 'priority'
  const [selectedShippingCompany, setSelectedShippingCompany] = useState<string | null>(null);
  const [newlyCreatedItinerary, setNewlyCreatedItinerary] = useState<Itinerary | null>(null);
  
  // Form state for creating new itinerary
  const [formData, setFormData] = useState({
    itineraryNumber: '',
    departureDate: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
    driverName: '',
    vehicleInfo: '',
    notes: '',
    status: 'proposed' as 'proposed' | 'active' | 'completed' | 'cancelled'
  });

  // Itinerary status filter
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Get all itineraries with status filtering
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
      
      // Set the newly created itinerary for confirmation
      setNewlyCreatedItinerary(data);
      setIsConfirmDialogOpen(true);
      
      // If we have selected orders during creation, add them to the itinerary
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
  
  // Get available orders for adding to itinerary with priority sorting and filtering
  const { data: availableOrders, isLoading: isLoadingAvailableOrders, refetch: refetchAvailableOrders } = useQuery({
    queryKey: ['/api/orders/picked', orderFilter, selectedShippingCompany, searchQuery],
    queryFn: async () => {
      try {
        console.log('Fetching picked orders...');
        
        // Use the regular orders endpoint with status=picked to get picked orders
        let url = '/api/orders';
        const params = new URLSearchParams();
        
        // Filter by "picked" or "shipped" status since we need to show both
        params.append('status', 'shipped');
        
        if (searchQuery) params.append('search', searchQuery);
        if (orderFilter === 'byShipping' && selectedShippingCompany) {
          params.append('shippingCompany', selectedShippingCompany);
        }
        if (orderFilter === 'priority') {
          params.append('sortBy', 'priority');
        }
        
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;
        
        console.log('Fetching URL:', url);
        
        const response = await apiRequest(url, { method: 'GET' });
        if (!response.ok) {
          throw new Error('Failed to fetch orders from the database');
        }
        
        const orders = await response.json();
        console.log('Picked orders available:', orders.length);
        
        // Filter by shipping company if selected
        let filteredOrders = [...orders];
        
        if (orderFilter === 'byShipping' && selectedShippingCompany) {
          filteredOrders = filteredOrders.filter((order: any) => 
            order.shippingCompany === selectedShippingCompany
          );
        }
        
        // Filter by search if provided
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filteredOrders = filteredOrders.filter((order: any) => 
            order.orderNumber.toLowerCase().includes(query) ||
            order.customerName.toLowerCase().includes(query) ||
            (order.shippingCompany && order.shippingCompany.toLowerCase().includes(query))
          );
        }
        
        // Sort by priority if needed
        if (orderFilter === 'priority') {
          const priorityWeight: Record<string, number> = {
            'urgent': 4,
            'high': 3,
            'medium': 2,
            'low': 1
          };
          
          filteredOrders.sort((a: any, b: any) => {
            const aPriority = priorityWeight[a.priority || 'low'] || 0;
            const bPriority = priorityWeight[b.priority || 'low'] || 0;
            return bPriority - aPriority;
          });
        }
        
        // Calculate box count for each order based on items if not already present
        const ordersWithBoxCount = filteredOrders.map((order: any) => {
          if (order.boxCount) return order;
          
          // Calculate accurate box count based on items
          let boxCount = 0; 
          
          try {
            if (order.items && order.items.length > 0) {
              boxCount = order.items.reduce((total: number, item: any) => {
                // Get units per box, default to 1 if not available
                const unitsPerBox = item.unitsPerBox || 1;
                // Calculate how many boxes needed for this item
                const itemBoxes = Math.ceil(item.quantity / unitsPerBox);
                return total + itemBoxes;
              }, 0);
            }
            
            // Ensure at least 1 box if calculation resulted in 0
            if (boxCount === 0) boxCount = 1;
          } catch (err) {
            console.error('Error calculating boxes for order', order.id, err);
            boxCount = 1; // Default to 1 if calculation fails
          }
          
          return {
            ...order,
            boxCount
          };
        });
        
        return ordersWithBoxCount;
      } catch (error) {
        console.error('Error fetching picked orders:', error);
        return [];
      }
    },
    enabled: isAddOrderDialogOpen,
    refetchOnWindowFocus: false
  });
  
  // Get shipping companies for filtering from the database
  const { data: shippingCompanies = [] } = useQuery({
    queryKey: ['/api/shipping-companies'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/customers/shipping-companies', { method: 'GET' });
        if (!response.ok) {
          throw new Error('Failed to fetch shipping companies');
        }
        
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching shipping companies:', error);
        return [];
      }
    }
  });
  
  // Get print preview for an itinerary
  const { data: printPreviewData, isLoading: isLoadingPrintPreview, refetch: refetchPrintPreview } = useQuery({
    queryKey: ['/api/itineraries', selectedItinerary?.id, 'print-preview'],
    queryFn: async () => {
      if (!selectedItinerary) return null;
      try {
        const response = await apiRequest(`/api/itineraries/${selectedItinerary.id}/print-preview`, { method: 'GET' });
        if (!response.ok) throw new Error('Failed to generate print preview');
        return await response.json();
      } catch (error) {
        console.error('Error generating print preview:', error);
        return null;
      }
    },
    enabled: isPrintPreviewOpen && !!selectedItinerary
  });
  
  // Confirm itinerary (change status from proposed to active)
  const confirmItineraryMutation = useMutation({
    mutationFn: async ({ itineraryId }: { itineraryId: number }) => {
      const response = await apiRequest(`/api/itineraries/${itineraryId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
      });
      if (!response.ok) {
        throw new Error('Failed to confirm itinerary');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('Itinerary confirmed'),
        description: t('Itinerary has been activated and is ready for delivery'),
      });
      setIsConfirmDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/itineraries'] });
      
      // Open print preview after confirmation
      if (newlyCreatedItinerary) {
        setSelectedItinerary(newlyCreatedItinerary);
        setIsPrintPreviewOpen(true);
      }
    },
    onError: (error) => {
      toast({
        title: t('Error'),
        description: error.message,
        variant: 'destructive',
      });
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
      notes: '',
      status: 'proposed'
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
    // First open print preview
    const itinerary = itineraries?.find(i => i.id === itineraryId);
    if (itinerary) {
      setSelectedItinerary(itinerary);
      setIsPrintPreviewOpen(true);
    } else {
      // Direct print if no preview available
      window.open(`/api/itineraries/${itineraryId}/print`, '_blank');
    }
  };
  
  // Actual print function after preview
  const handleActualPrint = () => {
    if (selectedItinerary) {
      window.open(`/api/itineraries/${selectedItinerary.id}/print`, '_blank');
      setIsPrintPreviewOpen(false);
    }
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
    mutationFn: async ({ itineraryId, status }: { itineraryId: number, status: 'proposed' | 'active' | 'completed' | 'cancelled' }) => {
      const response = await apiRequest(`/api/itineraries/${itineraryId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error('Failed to update itinerary status');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t('Status updated'),
        description: t('Itinerary status has been updated successfully'),
      });
      
      if (data.status === 'active') {
        // If status changed to active, offer print option
        setSelectedItinerary(data);
        setIsPrintPreviewOpen(true);
      }
      
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
  const handleUpdateStatus = (itineraryId: number, status: 'proposed' | 'active' | 'completed' | 'cancelled') => {
    updateStatusMutation.mutate({ itineraryId, status });
  };

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
        description: t('Orders have been added to the itinerary successfully'),
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

  // Handle selection of orders in the selection interface (similar to picking)
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

  // Get priority badge color
  const getPriorityBadge = (priority: string | null | undefined) => {
    if (!priority) return null;
    
    const variant = 
      priority === 'urgent' ? 'destructive' :
      priority === 'high' ? 'default' :
      priority === 'medium' ? 'secondary' :
      'outline';
      
    return (
      <Badge variant={variant} className="ml-2">
        {priority === 'urgent' ? 'Επείγον' :
         priority === 'high' ? 'Υψηλή' :
         priority === 'medium' ? 'Μεσαία' :
         'Χαμηλή'}
      </Badge>
    );
  };

  // Group orders by shipping company for display
  const getOrdersGroupedByShippingCompany = (orders: Order[]) => {
    const grouped: Record<string, Order[]> = {};
    
    orders?.forEach(order => {
      const shippingCompany = order.shippingCompany || 'Άμεση Παράδοση';
      if (!grouped[shippingCompany]) {
        grouped[shippingCompany] = [];
      }
      grouped[shippingCompany].push(order);
    });
    
    return grouped;
  };

  // Render component
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Δρομολόγια</h1>
          <p className="text-muted-foreground">Διαχείριση δρομολογίων παράδοσης</p>
        </div>
        <div className="flex gap-2">
          <Select 
            value={statusFilter} 
            onValueChange={setStatusFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Φίλτρο κατάστασης" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλα τα δρομολόγια</SelectItem>
              <SelectItem value="proposed">Προτεινόμενα</SelectItem>
              <SelectItem value="active">Ενεργά</SelectItem>
              <SelectItem value="completed">Ολοκληρωμένα</SelectItem>
              <SelectItem value="cancelled">Ακυρωμένα</SelectItem>
            </SelectContent>
          </Select>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus size={16} />
                Νέο Δρομολόγιο
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>Δημιουργία Νέου Δρομολογίου</DialogTitle>
                <DialogDescription>
                  Συμπληρώστε τα στοιχεία του νέου δρομολογίου παράδοσης
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details">Στοιχεία Δρομολογίου</TabsTrigger>
                  <TabsTrigger value="orders">Επιλογή Παραγγελιών</TabsTrigger>
                </TabsList>
                
                <TabsContent value="details">
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
                        <Label htmlFor="notes">Σημειώσεις</Label>
                        <Textarea
                          id="notes"
                          name="notes"
                          value={formData.notes || ''}
                          onChange={handleInputChange}
                          rows={3}
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
                </TabsContent>
                
                <TabsContent value="orders">
                  <div className="py-2">
                    <div className="flex items-center space-x-2 mb-4">
                      <Label htmlFor="search-orders" className="sr-only">Αναζήτηση παραγγελιών</Label>
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="search-orders"
                          placeholder="Αναζήτηση παραγγελιών..."
                          className="pl-8"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <Select
                        value={orderFilter}
                        onValueChange={setOrderFilter}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Φίλτρο παραγγελιών" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Όλες οι παραγγελίες</SelectItem>
                          <SelectItem value="priority">Με προτεραιότητα</SelectItem>
                          <SelectItem value="byShipping">Ανά μεταφορική</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {orderFilter === 'byShipping' && (
                        <Select
                          value={selectedShippingCompany || ''}
                          onValueChange={setSelectedShippingCompany}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Μεταφορική" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Όλες οι μεταφορικές</SelectItem>
                            {shippingCompanies?.map((company: any) => (
                              <SelectItem key={company.id || company.name} value={company.name}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    
                    <ScrollArea className="h-[350px] rounded-md border p-4">
                      {isLoadingAvailableOrders ? (
                        <div className="text-center p-4">Φόρτωση διαθέσιμων παραγγελιών...</div>
                      ) : availableOrders?.length > 0 ? (
                        <div className="space-y-4">
                          {availableOrders.map((order: Order) => (
                            <div 
                              key={order.id} 
                              className={`flex items-center space-x-2 p-2 rounded-md ${
                                selectedOrders.includes(order.id) 
                                  ? 'bg-primary/20' 
                                  : 'hover:bg-muted/50'
                              }`}
                              onClick={() => handleOrderSelection(order.id)}
                            >
                              <Checkbox 
                                checked={selectedOrders.includes(order.id)}
                                onCheckedChange={() => handleOrderSelection(order.id)}
                                className="mr-2"
                              />
                              <div className="flex-1">
                                <div className="font-medium flex items-center">
                                  {order.orderNumber} - {order.customerName}
                                  {getPriorityBadge(order.priority)}
                                </div>
                                <div className="text-sm text-muted-foreground flex justify-between mt-1">
                                  <span>Κιβώτια: {order.boxCount || 0}</span>
                                  <span>Περιοχή: {order.area || '-'}</span>
                                  <span>Μεταφορική: {order.shippingCompany || 'Άμεση Παράδοση'}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center p-4">
                          <p className="text-muted-foreground">Δεν υπάρχουν διαθέσιμες παραγγελίες</p>
                          <Button 
                            className="mt-4" 
                            variant="outline"
                            onClick={() => {
                              console.log("Manual refresh of orders");
                              refetchAvailableOrders();
                            }}
                          >
                            Ανανέωση Λίστας
                          </Button>
                        </div>
                      )}
                    </ScrollArea>
                    
                    <div className="flex justify-between items-center mt-4">
                      <div className="text-sm">
                        Επιλεγμένες παραγγελίες: <strong>{selectedOrders.length}</strong>
                      </div>
                      <Button onClick={handleSubmit} disabled={selectedOrders.length === 0}>
                        Δημιουργία με επιλεγμένες παραγγελίες
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
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
                    <TableCell>{itinerary.itineraryNumber}</TableCell>
                    <TableCell>
                      {itinerary.departureDate 
                        ? format(new Date(itinerary.departureDate), 'dd/MM/yyyy HH:mm', { locale: el })
                        : '-'}
                    </TableCell>
                    <TableCell>{itinerary.driverName || '-'}</TableCell>
                    <TableCell>{itinerary.shippingCompany || 'Άμεση Παράδοση'}</TableCell>
                    <TableCell className="text-center">{itinerary.totalBoxes || 0}</TableCell>
                    <TableCell>
                      <Badge variant={
                        itinerary.status === 'proposed' ? 'outline' :
                        itinerary.status === 'active' ? 'default' : 
                        itinerary.status === 'completed' ? 'success' : 
                        'destructive'
                      }>
                        {itinerary.status === 'proposed' && 'Προτεινόμενο'}
                        {itinerary.status === 'active' && 'Ενεργό'}
                        {itinerary.status === 'completed' && 'Ολοκληρωμένο'}
                        {itinerary.status === 'cancelled' && 'Ακυρωμένο'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleViewOrders(itinerary)}
                          title="Προβολή παραγγελιών"
                        >
                          <Package size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handlePrintItinerary(itinerary.id)}
                          title="Εκτύπωση δρομολογίου"
                        >
                          <Printer size={16} />
                        </Button>
                        {itinerary.status === 'proposed' && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleUpdateStatus(itinerary.id, 'active')}
                            title="Επιβεβαίωση δρομολογίου"
                          >
                            <CheckCircle2 size={16} className="text-green-500" />
                          </Button>
                        )}
                        {itinerary.status === 'active' && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleUpdateStatus(itinerary.id, 'completed')}
                            title="Ολοκλήρωση δρομολογίου"
                          >
                            <CalendarDays size={16} className="text-blue-500" />
                          </Button>
                        )}
                        {(itinerary.status === 'proposed' || itinerary.status === 'active') && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleUpdateStatus(itinerary.id, 'cancelled')}
                            title="Ακύρωση δρομολογίου"
                          >
                            <XCircle size={16} className="text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center p-8">
              <p className="text-muted-foreground">Δεν υπάρχουν δρομολόγια ακόμα</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus size={16} className="mr-2" />
                Δημιουργία Νέου Δρομολογίου
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders dialog */}
      <Dialog open={isOrdersDialogOpen} onOpenChange={setIsOrdersDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Παραγγελίες Δρομολογίου {selectedItinerary?.itineraryNumber}</DialogTitle>
            <DialogDescription>
              Λίστα παραγγελιών που περιλαμβάνονται στο δρομολόγιο
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isLoadingOrders ? (
              <div className="text-center p-4">Φόρτωση παραγγελιών...</div>
            ) : itineraryOrders?.length > 0 ? (
              <ScrollArea className="h-[400px]">
                {/* Group orders by shipping company */}
                {Object.entries(getOrdersGroupedByShippingCompany(itineraryOrders)).map(([company, orders]) => (
                  <div key={company} className="mb-6">
                    <h3 className="font-semibold text-lg mb-2 flex items-center">
                      <Truck size={16} className="mr-2" />
                      {company}
                      <Badge variant="outline" className="ml-2">
                        {orders.length} παραγγελίες
                      </Badge>
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Αριθμός</TableHead>
                          <TableHead>Πελάτης</TableHead>
                          <TableHead className="text-center">Κιβώτια</TableHead>
                          <TableHead>Περιοχή</TableHead>
                          <TableHead className="text-right">Ενέργειες</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order: Order) => (
                          <TableRow key={order.id}>
                            <TableCell>{order.orderNumber}</TableCell>
                            <TableCell>{order.customerName}</TableCell>
                            <TableCell className="text-center">{order.boxCount || 0}</TableCell>
                            <TableCell>{order.area || '-'}</TableCell>
                            <TableCell className="text-right">
                              {selectedItinerary?.status !== 'completed' && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleRemoveOrder(order.id)}
                                  title="Αφαίρεση από το δρομολόγιο"
                                >
                                  <Trash size={16} className="text-red-500" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Separator className="my-4" />
                  </div>
                ))}
              </ScrollArea>
            ) : (
              <div className="text-center p-4">
                <p className="text-muted-foreground">Δεν υπάρχουν παραγγελίες στο δρομολόγιο</p>
              </div>
            )}
          </div>
          <DialogFooter>
            {selectedItinerary && selectedItinerary.status !== 'completed' && (
              <Button 
                onClick={() => {
                  setIsOrdersDialogOpen(false);
                  setIsAddOrderDialogOpen(true);
                }}
                className="flex items-center gap-2"
              >
                <Plus size={16} />
                Προσθήκη Παραγγελιών
              </Button>
            )}
            <Button 
              onClick={() => handlePrintItinerary(selectedItinerary?.id || 0)}
              variant="outline"
              className="flex items-center gap-2"
              disabled={!selectedItinerary}
            >
              <Printer size={16} />
              Εκτύπωση
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => setIsOrdersDialogOpen(false)}
            >
              Κλείσιμο
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add orders dialog */}
      <Dialog open={isAddOrderDialogOpen} onOpenChange={setIsAddOrderDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Προσθήκη Παραγγελιών στο Δρομολόγιο</DialogTitle>
            <DialogDescription>
              Επιλέξτε παραγγελίες για προσθήκη στο δρομολόγιο {selectedItinerary?.itineraryNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center space-x-2 mb-4">
            <Label htmlFor="search-orders-add" className="sr-only">Αναζήτηση παραγγελιών</Label>
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-orders-add"
                placeholder="Αναζήτηση παραγγελιών..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select
              value={orderFilter}
              onValueChange={setOrderFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Φίλτρο παραγγελιών" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλες οι παραγγελίες</SelectItem>
                <SelectItem value="priority">Με προτεραιότητα</SelectItem>
                <SelectItem value="byShipping">Ανά μεταφορική</SelectItem>
              </SelectContent>
            </Select>
            
            {orderFilter === 'byShipping' && (
              <Select
                value={selectedShippingCompany || ''}
                onValueChange={setSelectedShippingCompany}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Μεταφορική" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Όλες οι μεταφορικές</SelectItem>
                  {shippingCompanies?.map((company: any) => (
                    <SelectItem key={company.id || company.name} value={company.name}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <div className="py-4">
            <ScrollArea className="h-[400px] rounded-md border p-4">
              {isLoadingAvailableOrders ? (
                <div className="text-center p-4">Φόρτωση διαθέσιμων παραγγελιών...</div>
              ) : availableOrders?.length > 0 ? (
                <div className="space-y-4">
                  {availableOrders.map((order: Order) => (
                    <div 
                      key={order.id} 
                      className={`flex items-center space-x-2 p-3 rounded-md ${
                        selectedOrders.includes(order.id) 
                          ? 'bg-primary/20' 
                          : 'hover:bg-muted/50'
                      } cursor-pointer`}
                      onClick={() => handleOrderSelection(order.id)}
                    >
                      <Checkbox 
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={() => handleOrderSelection(order.id)}
                        className="mr-2"
                      />
                      <div className="flex-1">
                        <div className="font-medium flex items-center">
                          {order.orderNumber} - {order.customerName}
                          {getPriorityBadge(order.priority)}
                        </div>
                        <div className="text-sm text-muted-foreground flex justify-between mt-1">
                          <span>Κιβώτια: {order.boxCount || 0}</span>
                          <span>Περιοχή: {order.area || '-'}</span>
                          <span>Μεταφορική: {order.shippingCompany || 'Άμεση Παράδοση'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-4">
                  <p className="text-muted-foreground">Δεν υπάρχουν διαθέσιμες παραγγελίες</p>
                </div>
              )}
            </ScrollArea>
          </div>
          
          <DialogFooter>
            <div className="flex-1 text-sm">
              Επιλεγμένες παραγγελίες: <strong>{selectedOrders.length}</strong>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setIsAddOrderDialogOpen(false)}
            >
              Ακύρωση
            </Button>
            <Button 
              onClick={handleAddOrders}
              disabled={selectedOrders.length === 0}
            >
              Προσθήκη Επιλεγμένων
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm itinerary dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Επιβεβαίωση Δρομολογίου</DialogTitle>
            <DialogDescription>
              Θέλετε να επιβεβαιώσετε το δρομολόγιο "{newlyCreatedItinerary?.itineraryNumber}"?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>Μετά την επιβεβαίωση, το δρομολόγιο θα οριστικοποιηθεί για παράδοση.</p>
            <div className="mt-4 p-3 bg-muted rounded-md">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium">Ημερομηνία:</div>
                <div>{newlyCreatedItinerary?.departureDate ? format(new Date(newlyCreatedItinerary.departureDate), 'dd/MM/yyyy HH:mm', { locale: el }) : '-'}</div>
                
                <div className="font-medium">Οδηγός:</div>
                <div>{newlyCreatedItinerary?.driverName || '-'}</div>
                
                <div className="font-medium">Μεταφορική:</div>
                <div>{newlyCreatedItinerary?.shippingCompany || 'Άμεση Παράδοση'}</div>
                
                <div className="font-medium">Κιβώτια:</div>
                <div>{newlyCreatedItinerary?.totalBoxes || 0}</div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsConfirmDialogOpen(false)}
            >
              Ακύρωση
            </Button>
            <Button 
              onClick={() => {
                if (newlyCreatedItinerary) {
                  confirmItineraryMutation.mutate({ itineraryId: newlyCreatedItinerary.id });
                }
              }}
              disabled={confirmItineraryMutation.isPending}
            >
              {confirmItineraryMutation.isPending ? 'Επεξεργασία...' : 'Επιβεβαίωση & Εκτύπωση'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print preview dialog */}
      <Dialog open={isPrintPreviewOpen} onOpenChange={setIsPrintPreviewOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Προεπισκόπηση Εκτύπωσης</DialogTitle>
            <DialogDescription>
              Δρομολόγιο: {selectedItinerary?.itineraryNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isLoadingPrintPreview ? (
              <div className="text-center p-4">Φόρτωση προεπισκόπησης...</div>
            ) : (
              <div className="border rounded-md p-6 bg-white">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold">ΦΟΡΜΑ ΔΡΟΜΟΛΟΓΙΟΥ</h2>
                  <p className="text-lg">{selectedItinerary?.itineraryNumber}</p>
                  <p>{selectedItinerary?.departureDate ? format(new Date(selectedItinerary.departureDate), 'dd/MM/yyyy HH:mm', { locale: el }) : '-'}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="font-semibold">Στοιχεία Οδηγού:</p>
                    <p>{selectedItinerary?.driverName || '-'}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Στοιχεία Οχήματος:</p>
                    <p>{selectedItinerary?.vehicleInfo || '-'}</p>
                  </div>
                  {selectedItinerary?.shippingCompany && (
                    <div className="col-span-2">
                      <p className="font-semibold">Μεταφορική Εταιρεία:</p>
                      <p>{selectedItinerary.shippingCompany}</p>
                    </div>
                  )}
                  {selectedItinerary?.notes && (
                    <div className="col-span-2">
                      <p className="font-semibold">Σημειώσεις:</p>
                      <p>{selectedItinerary.notes}</p>
                    </div>
                  )}
                </div>
                
                <Separator className="my-4" />
                
                {/* Group orders by shipping company in preview */}
                {itineraryOrders?.length > 0 ? (
                  <div>
                    <h3 className="font-bold text-lg mb-4">Λίστα Παραγγελιών</h3>
                    {Object.entries(getOrdersGroupedByShippingCompany(itineraryOrders)).map(([company, orders]) => (
                      <div key={company} className="mb-6">
                        <h4 className="font-semibold text-md mb-2 flex items-center bg-muted p-2 rounded">
                          <Truck size={16} className="mr-2" />
                          {company}
                          <Badge variant="outline" className="ml-2">
                            {orders.length} παραγγελίες
                          </Badge>
                        </h4>
                        <table className="w-full border-collapse mb-4">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Αριθμός</th>
                              <th className="text-left py-2">Πελάτης</th>
                              <th className="text-center py-2">Κιβώτια</th>
                              <th className="text-left py-2">Περιοχή</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orders.map((order: Order) => (
                              <tr key={order.id} className="border-b">
                                <td className="py-2">{order.orderNumber}</td>
                                <td className="py-2">{order.customerName}</td>
                                <td className="py-2 text-center">{order.boxCount || 0}</td>
                                <td className="py-2">{order.area || '-'}</td>
                              </tr>
                            ))}
                            <tr className="font-semibold">
                              <td colSpan={2} className="py-2 text-right">Σύνολο:</td>
                              <td className="py-2 text-center">
                                {orders.reduce((sum, order) => sum + (order.boxCount || 0), 0)}
                              </td>
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ))}
                    
                    <div className="mt-6 font-semibold flex justify-between border-t pt-4">
                      <span>Συνολικά Κιβώτια:</span>
                      <span>{selectedItinerary?.totalBoxes || 0}</span>
                    </div>
                    
                    <div className="mt-8 grid grid-cols-2 gap-8">
                      <div>
                        <p className="mb-4">Υπογραφή Οδηγού:</p>
                        <div className="border-b border-dashed h-10"></div>
                      </div>
                      <div>
                        <p className="mb-4">Ημερομηνία & Ώρα:</p>
                        <div className="border-b border-dashed h-10"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <p className="text-muted-foreground">Δεν υπάρχουν παραγγελίες στο δρομολόγιο</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsPrintPreviewOpen(false)}
            >
              Ακύρωση
            </Button>
            <Button 
              onClick={handleActualPrint}
              className="flex items-center gap-2"
            >
              <Printer size={16} />
              Εκτύπωση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}