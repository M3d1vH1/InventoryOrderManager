import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { exportData } from '@/lib/utils';
import { format } from 'date-fns';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MoreHorizontal, Plus, Search, FileDown, X, ClipboardCheck, FileText, Eye } from 'lucide-react';

// Define a schema for the customer form
const customerFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  vatNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  email: z.union([z.string().email({ message: "Invalid email address" }), z.string().length(0), z.null()]).optional(),
  phone: z.string().optional(),
  contactPerson: z.string().optional(),
  shippingCompany: z.string().optional(),
  billingCompany: z.string().optional(), // Added billing company field
  notes: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

interface Customer {
  id: number;
  name: string;
  vatNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  contactPerson: string | null;
  shippingCompany: string | null;
  billingCompany: string | null; // Added billing company field
  preferredShippingCompany: string | null;
  notes: string | null;
  createdAt: Date;
}

// CSS styles for making form elements touch-friendly
const touchFriendlyStyle = "h-12 text-base";

const Customers = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [viewDetailsId, setViewDetailsId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query to fetch all customers
  const { data: customers = [], isLoading, isError } = useQuery<Customer[]>({
    queryKey: ['/api/customers', searchQuery],
    queryFn: async () => {
      const url = searchQuery 
        ? `/api/customers?q=${encodeURIComponent(searchQuery)}`
        : '/api/customers';
      return apiRequest<Customer[]>({
        url: url,
        method: 'GET'
      });
    }
  });

  // Query to fetch a single customer details
  const { data: customerDetails } = useQuery<Customer | null>({
    queryKey: ['/api/customers', viewDetailsId],
    queryFn: async () => {
      if (!viewDetailsId) return null;
      return apiRequest<Customer>({
        url: `/api/customers/${viewDetailsId}`,
        method: 'GET'
      });
    },
    enabled: viewDetailsId !== null,
  });
  
  // Define Order and OrderItem interfaces
  interface Product {
    id: number;
    name: string;
    sku: string;
    barcode?: string;
    category: string;
    description?: string;
    minStockLevel: number;
    currentStock: number;
    location?: string;
    unitsPerBox?: number;
  }

  interface OrderItem {
    id: number;
    orderId: number;
    productId: number;
    quantity: number;
    product?: Product;
  }

  interface Order {
    id: number;
    orderNumber: string;
    customerName: string;
    orderDate: string;
    status: 'pending' | 'picked' | 'shipped' | 'cancelled';
    notes?: string;
    hasShippingDocument?: boolean;
    items?: OrderItem[];
  }
  
  // Query to fetch customer orders when viewDetailsId changes
  const { data: customerOrders = [] } = useQuery<Order[]>({
    queryKey: ['/api/customers/orders', viewDetailsId],
    queryFn: async () => {
      if (!viewDetailsId) return [];
      return apiRequest<Order[]>({
        url: `/api/customers/${viewDetailsId}/orders`,
        method: 'GET'
      });
    },
    enabled: viewDetailsId !== null,
  });
  
  // Fetch specific order details with product details
  const { data: orderDetails, isLoading: isOrderDetailsLoading } = useQuery<Order>({
    queryKey: ['/api/orders', selectedOrder?.id],
    enabled: !!selectedOrder,
    queryFn: async () => {
      const response = await apiRequest({
        url: `/api/orders/${selectedOrder?.id}`,
      });
      
      // If order has items, fetch product details for each item
      if (response.items && response.items.length > 0) {
        const itemsWithProducts = await Promise.all(
          response.items.map(async (item: OrderItem) => {
            try {
              const productData = await apiRequest<Product>({
                url: `/api/products/${item.productId}`,
              });
              return { ...item, product: productData };
            } catch (error) {
              console.error(`Failed to fetch product ${item.productId}:`, error);
              return item;
            }
          })
        );
        
        return { ...response, items: itemsWithProducts };
      }
      
      return response;
    },
  });

  // Mutation for creating a new customer
  const createCustomerMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      return apiRequest<Customer>({
        url: '/api/customers',
        method: 'POST',
        body: JSON.stringify(values),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setIsCreateDialogOpen(false);
      // Reset the create form to its default values
      createForm.reset({
        name: '',
        vatNumber: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
        email: '',
        phone: '',
        contactPerson: '',
        shippingCompany: '',
        notes: '',
      });
      toast({
        title: "Success",
        description: "Customer created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create customer",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating an existing customer
  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: CustomerFormValues }) => {
      return apiRequest<Customer>({
        url: `/api/customers/${id}`,
        method: 'PATCH',
        body: JSON.stringify(values),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setIsEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Customer updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update customer",
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting a customer
  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest<void>({
        url: `/api/customers/${id}`,
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setIsDeleteAlertOpen(false);
      setSelectedCustomer(null);
      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete customer",
        variant: "destructive",
      });
    },
  });

  // Form for creating a new customer
  const createForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: '',
      vatNumber: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
      email: '',
      phone: '',
      contactPerson: '',
      shippingCompany: '',
      billingCompany: '',
      notes: '',
    },
  });

  // Form for editing an existing customer
  const editForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: '',
      vatNumber: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
      email: '',
      phone: '',
      contactPerson: '',
      shippingCompany: '',
      billingCompany: '',
      notes: '',
    },
  });

  // Handler for submitting the create form
  const onCreateSubmit = (values: CustomerFormValues) => {
    createCustomerMutation.mutate(values);
  };

  // Handler for submitting the edit form
  const onEditSubmit = (values: CustomerFormValues) => {
    if (selectedCustomer) {
      updateCustomerMutation.mutate({ id: selectedCustomer.id, values });
    }
  };

  // Handler for opening the edit dialog
  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    
    // Populate the edit form with the selected customer's data
    editForm.reset({
      name: customer.name,
      vatNumber: customer.vatNumber || undefined,
      address: customer.address || undefined,
      city: customer.city || undefined,
      state: customer.state || undefined,
      postalCode: customer.postalCode || undefined,
      country: customer.country || undefined,
      email: customer.email || undefined,
      phone: customer.phone || undefined,
      contactPerson: customer.contactPerson || undefined,
      shippingCompany: customer.shippingCompany || undefined,
      billingCompany: customer.billingCompany || undefined,
      notes: customer.notes || undefined,
    });
    
    setIsEditDialogOpen(true);
  };

  // Handler for opening the delete confirmation dialog
  const handleDeleteCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDeleteAlertOpen(true);
  };

  // Handler for viewing customer details
  const handleViewCustomer = (id: number) => {
    setViewDetailsId(id);
  };

  // Handler for viewing order details
  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsOrderDialogOpen(true);
  };

  // Handler for closing the order dialog
  const handleOrderDialogClose = () => {
    setIsOrderDialogOpen(false);
    setSelectedOrder(null);
  };

  // Handler for closing the create dialog
  const handleCreateDialogClose = () => {
    createForm.reset();
    setIsCreateDialogOpen(false);
  };

  // Handler for closing the edit dialog
  const handleEditDialogClose = () => {
    editForm.reset();
    setIsEditDialogOpen(false);
    setSelectedCustomer(null);
  };

  // Function to format shipping company names for display
  const formatShippingCompany = (company: string | null) => {
    if (!company) return 'None';
    return company;
  };
  
  // Function to sort customers based on the current sort criteria
  const sortedCustomers = [...customers].sort((a, b) => {
    const aValue = a[sortBy as keyof Customer];
    const bValue = b[sortBy as keyof Customer];
    
    // Handle null values
    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return sortOrder === 'asc' ? 1 : -1;
    if (bValue === null) return sortOrder === 'asc' ? -1 : 1;
    
    // Perform string comparison for sorting
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    }
    
    // Fallback for other types
    return sortOrder === 'asc' 
      ? (aValue > bValue ? 1 : -1) 
      : (bValue > aValue ? 1 : -1);
  });
  
  // Toggle sorting when clicking on table headers
  const handleSort = (column: string) => {
    if (sortBy === column) {
      // If clicking the same column, toggle the sort order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a different column, set it as the sort column and default to ascending
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Function to export customer data
  const handleExport = (format: string) => {
    if (customers.length === 0) {
      toast({
        title: "Export Failed",
        description: "No customer data to export",
        variant: "destructive",
      });
      return;
    }

    // Transform customers for export (clean up nulls)
    const customersForExport = customers.map((customer: Customer) => ({
      ID: customer.id,
      Name: customer.name,
      'VAT Number': customer.vatNumber || '',
      Address: customer.address || '',
      City: customer.city || '',
      State: customer.state || '',
      'Postal Code': customer.postalCode || '',
      Country: customer.country || '',
      Email: customer.email || '',
      Phone: customer.phone || '',
      'Contact Person': customer.contactPerson || '',
      'Shipping Company': formatShippingCompany(customer.shippingCompany),
      'Billing Company': formatShippingCompany(customer.billingCompany),
      Notes: customer.notes || '',
      'Created': new Date(customer.createdAt).toLocaleDateString()
    }));

    exportData(customersForExport, format, 'Customers');
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Customers</h1>
        
        <div className="flex space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-12 text-base px-4">
                <FileDown className="h-5 w-5 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="h-12 text-base px-4"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
          <CardDescription>
            Manage your customer information
          </CardDescription>
          <div className="flex w-full max-w-sm items-center space-x-2 mt-2">
            <div className="relative w-full">
              <Input 
                placeholder="Search customers..." 
                className={touchFriendlyStyle + (searchQuery ? " pr-10" : "")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 h-full"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4 text-slate-400" />
                </Button>
              )}
            </div>
            <Button type="submit" size="icon" className="h-12 w-12">
              <Search className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-muted-foreground">
              Error loading customers
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No customers found
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Name
                        {sortBy === 'name' && (
                          <span className="ml-1">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('vatNumber')}
                    >
                      <div className="flex items-center">
                        VAT Number
                        {sortBy === 'vatNumber' && (
                          <span className="ml-1">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('contactPerson')}
                    >
                      <div className="flex items-center">
                        Contact Person
                        {sortBy === 'contactPerson' && (
                          <span className="ml-1">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('country')}
                    >
                      <div className="flex items-center">
                        Country
                        {sortBy === 'country' && (
                          <span className="ml-1">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('shippingCompany')}
                    >
                      <div className="flex items-center">
                        Shipping Company
                        {sortBy === 'shippingCompany' && (
                          <span className="ml-1">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('billingCompany')}
                    >
                      <div className="flex items-center">
                        Billing Company
                        {sortBy === 'billingCompany' && (
                          <span className="ml-1">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCustomers.map((customer: Customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.vatNumber || '-'}</TableCell>
                      <TableCell>{customer.contactPerson || '-'}</TableCell>
                      <TableCell>{customer.country || '-'}</TableCell>
                      <TableCell>{formatShippingCompany(customer.shippingCompany)}</TableCell>
                      <TableCell>{formatShippingCompany(customer.billingCompany)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-10 w-10">
                              <MoreHorizontal className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewCustomer(customer.id)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditCustomer(customer)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDeleteCustomer(customer)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Create Customer Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter the customer details below
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name*</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT Number</FormLabel>
                      <FormControl>
                        <Input placeholder="VAT12345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="info@acmecorp.com" 
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
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 234 567 8900" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="shippingCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shipping Company</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter shipping company" 
                          className="h-12 text-base" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="billingCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Company</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter billing company" 
                          className="h-12 text-base" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="pt-2">
                <h3 className="text-lg font-medium mb-2">Address Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Business St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="New York" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State/Province</FormLabel>
                        <FormControl>
                          <Input placeholder="NY" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input placeholder="10001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="United States" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <FormField
                control={createForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional information about this customer"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createCustomerMutation.isPending}
                  className="h-12 text-lg"
                >
                  {createCustomerMutation.isPending && (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  )}
                  Create Customer
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update the customer details
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name*</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT Number</FormLabel>
                      <FormControl>
                        <Input placeholder="VAT12345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="info@acmecorp.com" 
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 234 567 8900" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="shippingCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shipping Company</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter shipping company" 
                          className="h-12 text-base" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="billingCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Company</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter billing company" 
                          className="h-12 text-base" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="pt-2">
                <h3 className="text-lg font-medium mb-2">Address Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Business St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="New York" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State/Province</FormLabel>
                        <FormControl>
                          <Input placeholder="NY" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input placeholder="10001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="United States" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional information about this customer"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={updateCustomerMutation.isPending}
                  className="h-12 text-lg"
                >
                  {updateCustomerMutation.isPending && (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  )}
                  Update Customer
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Customer Details Dialog */}
      <Dialog open={viewDetailsId !== null} onOpenChange={() => setViewDetailsId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
          </DialogHeader>
          
          {customerDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Company Name</h3>
                  <p className="text-base">{customerDetails.name}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">VAT Number</h3>
                  <p className="text-base">{customerDetails.vatNumber || '-'}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Contact Person</h3>
                  <p className="text-base">{customerDetails.contactPerson || '-'}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Email</h3>
                  <p className="text-base">{customerDetails.email || '-'}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Phone</h3>
                  <p className="text-base">{customerDetails.phone || '-'}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Shipping Company</h3>
                  <p className="text-base">{formatShippingCompany(customerDetails.shippingCompany)}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Billing Company</h3>
                  <p className="text-base">{formatShippingCompany(customerDetails.billingCompany)}</p>
                </div>
              </div>
              
              <div className="bg-muted p-4 rounded-md">
                <h3 className="text-sm font-medium mb-2">Address</h3>
                <p className="text-base">{customerDetails.address || '-'}</p>
                <p className="text-base">
                  {[
                    customerDetails.city,
                    customerDetails.state,
                    customerDetails.postalCode
                  ].filter(Boolean).join(', ')}
                </p>
                <p className="text-base">{customerDetails.country || '-'}</p>
              </div>
              
              {customerDetails.notes && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Notes</h3>
                  <p className="text-base whitespace-pre-line">{customerDetails.notes}</p>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Created At</h3>
                <p className="text-base">{new Date(customerDetails.createdAt).toLocaleString()}</p>
              </div>
              
              {/* Order History Section */}
              <div className="pt-4 border-t">
                <h3 className="text-lg font-semibold mb-3">Order History</h3>
                {customerOrders.length === 0 ? (
                  <p className="text-muted-foreground">No orders found for this customer</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.orderNumber}</TableCell>
                            <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  order.status === 'shipped' ? 'default' : 
                                  order.status === 'picked' ? 'outline' : 
                                  order.status === 'cancelled' ? 'destructive' : 
                                  'secondary'
                                }
                                className={
                                  order.status === 'shipped' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 
                                  order.status === 'picked' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' : 
                                  order.status === 'cancelled' ? '' : 
                                  ''
                                }
                              >
                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="h-8"
                                onClick={() => handleViewOrder(order)}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => handleEditCustomer(customerDetails)}
                  className="h-12 text-lg"
                >
                  Edit Customer
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Order Details Dialog */}
      <Dialog open={isOrderDialogOpen} onOpenChange={handleOrderDialogClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Order Details
              {orderDetails && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({orderDetails.orderNumber})
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              View the complete details of this order.
            </DialogDescription>
          </DialogHeader>
          
          {isOrderDetailsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orderDetails ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Order Number</h3>
                  <p className="text-base">{orderDetails.orderNumber}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Customer</h3>
                  <p className="text-base">{orderDetails.customerName}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Date</h3>
                  <p className="text-base">{format(new Date(orderDetails.orderDate), "MMMM dd, yyyy")}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Status</h3>
                  <Badge 
                    className={
                      orderDetails.status === 'shipped' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 
                      orderDetails.status === 'picked' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' : 
                      orderDetails.status === 'cancelled' ? '' : 
                      'bg-blue-100 text-blue-800 hover:bg-blue-100'
                    }
                  >
                    {orderDetails.status.charAt(0).toUpperCase() + orderDetails.status.slice(1)}
                  </Badge>
                </div>
              </div>
              
              {orderDetails.notes && (
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Order Notes</h3>
                  <p className="text-base">{orderDetails.notes}</p>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-2">Order Items</h3>
                {orderDetails.items && orderDetails.items.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderDetails.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.product ? item.product.name : `Product ID: ${item.productId}`}
                            </TableCell>
                            <TableCell>{item.product ? item.product.sku : '-'}</TableCell>
                            <TableCell>{item.product ? item.product.category : '-'}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-slate-500 italic">No items found for this order.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Order details not available</p>
          )}
          
          <DialogFooter>
            <Button onClick={handleOrderDialogClose} className="h-10">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the customer{' '}
              <span className="font-medium">{selectedCustomer?.name}</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12 text-base">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedCustomer && deleteCustomerMutation.mutate(selectedCustomer.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-12 text-base"
              disabled={deleteCustomerMutation.isPending}
            >
              {deleteCustomerMutation.isPending && (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Customers;