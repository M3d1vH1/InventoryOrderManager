import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Printer, Edit, Trash, CalendarDays, Package } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useTranslation } from 'react-i18next';

// Simple types for our components
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
};

type Order = {
  id: number;
  orderNumber: string;
  customerName: string;
  boxCount: number;
};

export default function Itineraries() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isOrdersDialogOpen, setIsOrdersDialogOpen] = useState(false);
  const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null);
  
  // Form state for creating new itinerary
  const [formData, setFormData] = useState({
    itineraryNumber: '',
    departureDate: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
    driverName: '',
    vehicleInfo: '',
    shippingCompany: '',
    notes: ''
  });

  // Get all itineraries
  const { data: itineraries, isLoading } = useQuery({
    queryKey: ['/api/itineraries'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/itineraries', { method: 'GET' });
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
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('/api/itineraries', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to create itinerary');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('Itinerary created'),
        description: t('New delivery itinerary has been created successfully'),
      });
      setIsCreateDialogOpen(false);
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

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
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
  };

  // Submit form handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createItineraryMutation.mutate(formData);
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
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        itinerary.status === 'active' ? 'bg-green-100 text-green-800' :
                        itinerary.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {itinerary.status === 'active' ? 'Ενεργό' :
                         itinerary.status === 'completed' ? 'Ολοκληρώθηκε' :
                         'Ακυρώθηκε'}
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
                onClick={() => selectedItinerary && handlePrintItinerary(selectedItinerary.id)}
              >
                <Printer size={16} className="mr-2" />
                Εκτύπωση Λίστας
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}