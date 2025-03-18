import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { exportData } from '@/lib/utils';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Loader2, MoreHorizontal, Plus, Search, FileDown } from 'lucide-react';

// Define a schema for the customer form
const customerFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  vatNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  email: z.string().email({ message: "Invalid email address" }).optional().or(z.literal("")),
  phone: z.string().optional(),
  contactPerson: z.string().optional(),
  preferredShippingCompany: z.enum(['dhl', 'fedex', 'ups', 'usps', 'royal_mail', 'other']).optional(),
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
  preferredShippingCompany: 'dhl' | 'fedex' | 'ups' | 'usps' | 'royal_mail' | 'other' | null;
  customShippingCompany: string | null;
  notes: string | null;
  createdAt: Date;
}

const Customers = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [viewDetailsId, setViewDetailsId] = useState<number | null>(null);
  
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
      preferredShippingCompany: customer.preferredShippingCompany || undefined,
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
    
    const lookup: Record<string, string> = {
      dhl: 'DHL',
      fedex: 'FedEx',
      ups: 'UPS',
      usps: 'USPS',
      royal_mail: 'Royal Mail',
      other: 'Other'
    };
    
    return lookup[company] || company;
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
      'Preferred Shipping': formatShippingCompany(customer.preferredShippingCompany),
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
              <Button variant="outline">
                <FileDown className="h-4 w-4 mr-2" />
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
          
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
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
            <Input 
              placeholder="Search customers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button type="submit" size="icon">
              <Search className="h-4 w-4" />
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
                    <TableHead>Name</TableHead>
                    <TableHead>VAT Number</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Preferred Shipping</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer: Customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.vatNumber || '-'}</TableCell>
                      <TableCell>{customer.contactPerson || '-'}</TableCell>
                      <TableCell>{customer.country || '-'}</TableCell>
                      <TableCell>{formatShippingCompany(customer.preferredShippingCompany)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
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
                        <Input placeholder="info@acmecorp.com" {...field} />
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
                  name="preferredShippingCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Shipping Company</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select shipping company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="dhl">DHL</SelectItem>
                          <SelectItem value="fedex">FedEx</SelectItem>
                          <SelectItem value="ups">UPS</SelectItem>
                          <SelectItem value="usps">USPS</SelectItem>
                          <SelectItem value="royal_mail">Royal Mail</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
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
                >
                  {createCustomerMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                        <Input placeholder="info@acmecorp.com" {...field} />
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
                  name="preferredShippingCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Shipping Company</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select shipping company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="dhl">DHL</SelectItem>
                          <SelectItem value="fedex">FedEx</SelectItem>
                          <SelectItem value="ups">UPS</SelectItem>
                          <SelectItem value="usps">USPS</SelectItem>
                          <SelectItem value="royal_mail">Royal Mail</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
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
                >
                  {updateCustomerMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                  <h3 className="text-sm font-medium text-muted-foreground">Preferred Shipping</h3>
                  <p className="text-base">{formatShippingCompany(customerDetails.preferredShippingCompany)}</p>
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
              
              <DialogFooter>
                <Button variant="outline" onClick={() => handleEditCustomer(customerDetails)}>
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedCustomer && deleteCustomerMutation.mutate(selectedCustomer.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCustomerMutation.isPending}
            >
              {deleteCustomerMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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