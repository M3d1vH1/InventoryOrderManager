import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import ProductSearch from "@/components/products/ProductSearch";
import { format } from "date-fns";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { PackageOpen, AlertTriangle, ShoppingCart, Plus, Trash2, ArrowLeft, X, Loader2, Check, 
         Package, Calendar, TruckIcon, Clipboard, Grid, Grid3X3, Layers, Tag, Filter, Search } from "lucide-react";

interface Customer {
  id: number;
  name: string;
  preferredShippingCompany?: string;
  billingCompany?: string; // Changed from customShippingCompany
  shippingCompany?: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  currentStock: number;
  minStockLevel: number;
}

interface OrderItemInput {
  productId: number;
  product?: Product;
  quantity: number;
}

interface OrderFormProps {
  initialData?: {
    id?: number;
    orderNumber?: string;
    customerName: string;
    area?: string;
    orderDate: string;
    estimatedShippingDate?: string;
    notes?: string;
    shippingCompany?: string;
    billingCompany?: string;
    status?: 'pending' | 'picked' | 'shipped' | 'cancelled';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    items?: {
      id: number;
      productId: number;
      quantity: number;
      product?: Product;
    }[];
  };
  isEditMode?: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
}

// Extended schema based on backend schema
const orderFormSchema = z.object({
  customerName: z.string().min(2, { message: "Please select a customer" }),
  area: z.string().optional(),
  notes: z.string().optional(),
  shippingCompany: z.string().optional(),
  billingCompany: z.string().optional(),
  // Add these fields but we'll handle them separately from the API request
  orderDate: z.string().min(1, { message: "Order date is required" }),
  estimatedShippingDate: z.string().min(1, { message: "Estimated shipping date is required" }),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  items: z.array(z.object({ 
    productId: z.number(), 
    quantity: z.number() // Allow any number, including zero, to permit users to enter quantity manually
  })).min(1, { message: "At least one product is required" })
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

// Define the new customer form schema
const customerFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  vatNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  email: z.union([z.string().email({ message: "Invalid email address" }), z.string().length(0), z.null()]).optional(),
  phone: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  preferredShippingCompany: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

const OrderForm = ({ 
  initialData, 
  isEditMode = false, 
  onCancel, 
  onSuccess 
}: OrderFormProps = {}) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItemInput[]>([]);
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  const [currentSearchValue, setCurrentSearchValue] = useState("");
  
  // Add state for active tab
  const [activeTab, setActiveTab] = useState('customer'); // 'customer', 'products', 'review'
  
  // Add state for product category filter
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  // Extended Product type to include orderCount from API response
  interface ProductWithOrderCount extends Product {
    orderCount: number;
  }
  
  // Product from unshipped orders
  interface UnshippedProduct extends Product {
    quantity: number;
    orderNumber: string;
    orderDate: string;
    status: 'pending' | 'picked' | 'shipped' | 'cancelled';
    orderId: number;
  }
  
  interface GroupedUnshippedProducts {
    [orderNumber: string]: {
      orderNumber: string;
      orderDate: string;
      items: UnshippedProduct[];
    };
  }
  
  const [previousProducts, setPreviousProducts] = useState<ProductWithOrderCount[]>([]);
  const [unshippedProducts, setUnshippedProducts] = useState<UnshippedProduct[]>([]);
  
  // Grouped unshipped products by order
  const groupedUnshippedProducts: GroupedUnshippedProducts = useMemo(() => {
    const grouped: GroupedUnshippedProducts = {};
    
    unshippedProducts.forEach(product => {
      if (!grouped[product.orderNumber]) {
        grouped[product.orderNumber] = {
          orderNumber: product.orderNumber,
          orderDate: product.orderDate,
          items: []
        };
      }
      
      grouped[product.orderNumber].items.push(product);
    });
    
    return grouped;
  }, [unshippedProducts]);

  const { data: customers, isLoading: isLoadingCustomers } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });
  
  // Customer form using react-hook-form
  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      vatNumber: null,
      address: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      email: null,
      phone: null,
      contactPerson: null,
      preferredShippingCompany: null,
      notes: null,
    },
  });
  
  // Customer creation mutation
  const customerMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      return apiRequest({
        url: '/api/customers',
        method: 'POST',
        body: JSON.stringify(values),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Customer created",
        description: "New customer has been added successfully.",
      });
      
      // Update the order form with the new customer
      form.setValue('customerName', data.name);
      
      // Close the dialog and reset the customer form
      setIsNewCustomerDialogOpen(false);
      customerForm.reset();
      
      // Refresh customers query
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
    },
    onError: (error) => {
      toast({
        title: "Error creating customer",
        description: error.message || "Failed to create customer. Please try again.",
        variant: "destructive",
      });
    }
  });

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customerName: initialData?.customerName || "",
      area: initialData?.area || "",
      orderDate: initialData?.orderDate || format(new Date(), "yyyy-MM-dd"),
      estimatedShippingDate: initialData?.estimatedShippingDate || format(new Date(new Date().setDate(new Date().getDate() + 5)), "yyyy-MM-dd"),
      priority: initialData?.priority || 'medium',
      notes: initialData?.notes || "",
      shippingCompany: initialData?.shippingCompany || "",
      billingCompany: initialData?.billingCompany || "",
      items: initialData?.items?.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      })) || []
    }
  });

  // Initialize orderItems from initialData if provided
  useEffect(() => {
    if (initialData?.items && initialData.items.length > 0 && orderItems.length === 0) {
      setOrderItems(initialData.items.map(item => ({
        productId: item.productId,
        product: item.product,
        quantity: item.quantity
      })));
    }
  }, [initialData]);
  
  // Function to fetch and set the area from a customer's previous orders
  const fetchCustomerAreaFromPreviousOrders = async (customerName: string) => {
    try {
      // Get all orders for this customer
      const response = await fetch(`/api/orders/customer/${encodeURIComponent(customerName)}`);
      
      if (!response.ok) {
        console.warn(`Failed to fetch previous orders for customer ${customerName}`);
        return;
      }
      
      const orders = await response.json();
      
      // If there are previous orders with area information, use the most recent one
      const ordersWithArea = orders.filter((order: any) => order.area && order.area.trim() !== '');
      
      if (ordersWithArea.length > 0) {
        // Sort by date descending to get the most recent order first
        ordersWithArea.sort((a: any, b: any) => 
          new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
        );
        
        const mostRecentArea = ordersWithArea[0].area;
        
        // Set the area in the form
        if (mostRecentArea && form.getValues('area') === '') {
          form.setValue('area', mostRecentArea);
          console.log(`Set area to ${mostRecentArea} from customer's most recent order`);
        }
      }
    } catch (error) {
      console.error('Error fetching customer area from previous orders:', error);
    }
  };
  
  // Function to set shipping company and billing company from customer data
  const setShippingCompanyFromCustomer = (customer: Customer) => {
    console.log('Customer data received:', customer);
    
    let shippingCompany = '';
    
    // Use preferred shipping company if available
    if (customer.preferredShippingCompany) {
      shippingCompany = customer.preferredShippingCompany;
      console.log('Using preferred shipping company:', shippingCompany);
    } 
    // Otherwise use the regular shipping company if available
    else if (customer.shippingCompany) {
      shippingCompany = customer.shippingCompany;
      console.log('Using regular shipping company:', shippingCompany);
    }
    else {
      console.log('No shipping company found in customer data');
    }
    
    if (shippingCompany) {
      form.setValue('shippingCompany', shippingCompany);
      console.log(`Set shipping company to ${shippingCompany} from customer data`);
    }
    
    // Set billing company if available in customer data
    if (customer.billingCompany) {
      form.setValue('billingCompany', customer.billingCompany);
      console.log(`Set billing company to ${customer.billingCompany} from customer data`);
    }
    else {
      console.log('No billing company found in customer data');
    }
  };

  // Define a state for unshipped items warning
  const [unshippedItemsWarning, setUnshippedItemsWarning] = useState<{
    hasUnshippedItems: boolean;
    unshippedItemsCount: number;
    hasAuthorizedUnshippedItems: boolean;
    pendingOrders: number;
  } | null>(null);
  
  // Import the notification context
  const { playNotificationSound } = useNotifications();
  
  // Effect to fetch previous products when customer changes
  useEffect(() => {
    const customerName = form.watch('customerName');
    
    // Clear previous products when customer name changes
    if (!customerName || customerName.trim() === '') {
      setPreviousProducts([]);
      setUnshippedProducts([]);
      setUnshippedItemsWarning(null);
      return;
    }
    
    // Don't fetch for very short names (likely just typing)
    if (customerName.length < 3) {
      return;
    }
    
    // Check if this matches a known customer (not just typing a new name)
    const matchedCustomer = customers?.find(c => 
      c.name.toLowerCase() === customerName.toLowerCase()
    );
    
    if (matchedCustomer) {
      // Fetch if customer has unshipped items immediately for notification
      const checkForUnshippedItems = async () => {
        try {
          const encodedName = encodeURIComponent(customerName);
          const response = await fetch(`/api/customers/${encodedName}/has-unshipped-items`);
          if (response.ok) {
            const data = await response.json();
            setUnshippedItemsWarning(data);
            
            // Play a notification sound if customer has unfulfilled items
            if (data.hasUnshippedItems) {
              // Use the notification context to play a sound
              playNotificationSound('warning');
            }
          } else {
            console.error("Failed to check for unshipped items:", await response.text());
            setUnshippedItemsWarning(null);
          }
        } catch (error) {
          console.error("Error checking for unshipped items:", error);
          setUnshippedItemsWarning(null);
        }
      };
      
      // Fetch previous products for this customer
      const fetchPreviousProducts = async () => {
        try {
          const encodedName = encodeURIComponent(customerName);
          const response = await fetch(`/api/customers/${encodedName}/previous-products`);
          if (response.ok) {
            const data = await response.json();
            setPreviousProducts(data);
          } else {
            console.error("Failed to fetch previous products:", await response.text());
            setPreviousProducts([]);
          }
        } catch (error) {
          console.error("Error fetching previous products:", error);
          setPreviousProducts([]);
        }
      };
      
      // Fetch unshipped products from previous orders
      const fetchUnshippedProducts = async () => {
        try {
          const encodedName = encodeURIComponent(customerName);
          const response = await fetch(`/api/customers/${encodedName}/unshipped-products`);
          if (response.ok) {
            const data = await response.json();
            setUnshippedProducts(data);
          } else {
            console.error("Failed to fetch unshipped products:", await response.text());
            setUnshippedProducts([]);
          }
        } catch (error) {
          console.error("Error fetching unshipped products:", error);
          setUnshippedProducts([]);
        }
      };
      
      // Execute all fetches
      checkForUnshippedItems();
      fetchPreviousProducts();
      fetchUnshippedProducts();
      
      // Fetch and set area from previous orders
      fetchCustomerAreaFromPreviousOrders(customerName);
      
      // Set shipping company from customer data
      setShippingCompanyFromCustomer(matchedCustomer);
    } else {
      setPreviousProducts([]);
      setUnshippedProducts([]);
      setUnshippedItemsWarning(null);
    }
  }, [form.watch('customerName'), customers, playNotificationSound]);

  useEffect(() => {
    // Update form items field when orderItems changes
    console.log("orderItems changed, updating form items", orderItems);
    const formattedItems = orderItems.map(item => ({
      productId: item.productId,
      quantity: item.quantity
    }));
    console.log("Setting form items value to:", formattedItems);
    form.setValue('items', formattedItems);
    
    // Verify that the items are set correctly
    setTimeout(() => {
      const currentItems = form.getValues('items');
      console.log("Current form items after update:", currentItems);
    }, 100);
  }, [orderItems, form]);

  const createOrderMutation = useMutation({
    mutationFn: async (values: OrderFormValues) => {
      // Ensure user is authenticated
      if (!user || !user.id) {
        throw new Error("You must be logged in to create an order");
      }

      // Log the items again right before sending
      console.log("Items being sent in API request:", values.items);
      console.log("orderItems length before sending:", orderItems.length);
      
      // Make sure we're sending all the items from our orderItems state
      // Create a copy of the form values but replace items with our orderItems state
      const itemsToSend = orderItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }));
      
      console.log("Final items to send:", itemsToSend);

      // Send only the data that the server expects
      return apiRequest({
        url: '/api/orders',
        method: 'POST',
        body: JSON.stringify({
          customerName: values.customerName,
          area: values.area,
          notes: values.notes,
          items: itemsToSend, // Use our directly mapped items from state
          estimatedShippingDate: values.estimatedShippingDate,
          priority: values.priority,
          shippingCompany: values.shippingCompany,
          billingCompany: values.billingCompany,
          createdById: user.id
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Order created",
        description: "Order has been created successfully.",
      });
      // Reset form and state
      form.reset();
      setOrderItems([]);
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders/recent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      console.error("Order creation error:", error);
      toast({
        title: "Error creating order",
        description: error.message || "Failed to create order. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: OrderFormValues }) => {
      // Ensure user is authenticated
      if (!user || !user.id) {
        throw new Error("You must be logged in to update an order");
      }
      
      // Show confirmation prompt before proceeding with the update
      if (!confirm(t('orders.form.confirmUpdate'))) {
        throw new Error("Order update cancelled by user");
      }
      
      // Log the items again right before sending
      console.log("Items being sent in update API request:", values.items);
      console.log("orderItems length before sending update:", orderItems.length);
      
      // Make sure we're sending all the items from our orderItems state
      // Create a copy of the form values but replace items with our orderItems state
      const itemsToSend = orderItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }));
      
      console.log("Final items to send in update:", itemsToSend);
      
      // Send only the data that the server expects
      return apiRequest({
        url: `/api/orders/${id}`,
        method: 'PATCH',
        body: JSON.stringify({
          customerName: values.customerName,
          area: values.area,
          notes: values.notes,
          items: itemsToSend, // Use our directly mapped items from state
          estimatedShippingDate: values.estimatedShippingDate,
          priority: values.priority,
          shippingCompany: values.shippingCompany,
          billingCompany: values.billingCompany,
          updatedById: user.id
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Order updated",
        description: "Order has been updated successfully.",
        variant: "default",
      });
      
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders', initialData?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders/recent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      // Clear form and state
      form.reset();
      setOrderItems([]);
      
      // Navigate back to orders list after successful update
      window.location.href = "/orders";
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      // Check if it's a user cancellation
      if (error.message === "Order update cancelled by user") {
        // Silently handle cancellation, don't show an error toast
        return;
      }
      
      console.error("Order update error:", error);
      toast({
        title: "Error updating order",
        description: error.message || "Failed to update order. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (values: OrderFormValues) => {
    if (isEditMode && initialData?.id) {
      console.log("Updating order:", initialData.id, values);
      console.log("Order items being submitted:", values.items);
      console.log("Current orderItems state:", orderItems);
      updateOrderMutation.mutate({ id: initialData.id, values });
    } else {
      console.log("Creating order:", values);
      console.log("Order items being submitted:", values.items);
      console.log("Current orderItems state:", orderItems);
      createOrderMutation.mutate(values);
    }
  };

  const addProduct = (product: Product) => {
    if (orderItems.some(item => item.productId === product.id)) {
      toast({
        title: "Product already added",
        description: "This product is already in your order.",
        variant: "destructive",
      });
      return;
    }
    
    setOrderItems([...orderItems, { 
      productId: product.id, 
      product,
      quantity: 0 // Start with empty (zero) quantity instead of defaulting to 1
    }]);
    
    setIsProductSearchOpen(false);
  };

  const removeProduct = (index: number) => {
    const newItems = [...orderItems];
    newItems.splice(index, 1);
    setOrderItems(newItems);
  };

  const updateQuantity = (index: number, quantity: number) => {
    const newItems = [...orderItems];
    // Set the quantity with a minimum value of 1 to prevent negative or zero quantities
    newItems[index].quantity = Math.max(1, quantity);
    setOrderItems(newItems);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-slate-200">
        <h2 className="font-semibold text-lg">
          {isEditMode 
            ? `${t('orders.editOrder')}${initialData?.orderNumber ? ` ${initialData.orderNumber}` : ''}` 
            : t('orders.form.createNewOrder')}
        </h2>
      </div>
      <div className="p-4">
        {/* Customer has unshipped items warning - shown when customer is selected */}
        {unshippedItemsWarning && unshippedItemsWarning.hasUnshippedItems && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-orange-800 text-sm">
                <AlertTriangle className="h-4 w-4 mr-2 text-orange-500 flex-shrink-0" />
                <span>
                  <span className="font-medium">This customer has {unshippedItemsWarning.unshippedItemsCount} unfulfilled item{unshippedItemsWarning.unshippedItemsCount !== 1 ? 's' : ''}</span>
                  {unshippedItemsWarning.pendingOrders > 0 && ` and ${unshippedItemsWarning.pendingOrders} pending order${unshippedItemsWarning.pendingOrders !== 1 ? 's' : ''}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {unshippedItemsWarning.hasAuthorizedUnshippedItems && (
                  <Badge className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200 px-2 py-0.5 text-xs">
                    Authorized
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Partial fulfillment info alert - only show when there's at least one item exceeding stock */}
        {orderItems.some(item => item.quantity > (item.product?.currentStock || 0)) && (
          <Alert className="mb-6 bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">{t('orders.form.partialFulfillmentTitle')}</AlertTitle>
            <AlertDescription className="text-amber-700">
              {t('orders.form.partialFulfillmentDescription')}
            </AlertDescription>
          </Alert>
        )}
      
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-base font-medium">{t('orders.form.customer')}</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Select 
                          onValueChange={(value) => {
                            console.log('Customer selected:', value);
                            field.onChange(value);
                            
                            // Get the matched customer to retrieve area info from previous orders
                            const selectedCustomer = customers?.find(c => 
                              c.name === value
                            );
                            
                            // If we have a matched customer, look for their previous orders to get area info
                            if (selectedCustomer) {
                              fetchCustomerAreaFromPreviousOrders(value);
                              
                              // Set the shipping company from the customer data
                              setShippingCompanyFromCustomer(selectedCustomer);
                            }
                          }}
                          value={field.value}
                        >
                          <SelectTrigger className="h-12 text-base">
                            <SelectValue placeholder={t('orders.form.typeCustomerName')} />
                          </SelectTrigger>
                          <SelectContent>
                            {isLoadingCustomers ? (
                              <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              </div>
                            ) : (
                              <>
                                {(customers || []).map(customer => (
                                  <SelectItem
                                    key={customer.id}
                                    value={customer.name}
                                    className="h-10 text-base"
                                  >
                                    {customer.name}
                                  </SelectItem>
                                ))}
                                
                                <Button 
                                  onClick={() => {
                                    setCurrentSearchValue(field.value || '');
                                    customerForm.setValue('name', field.value || '');
                                    setIsNewCustomerDialogOpen(true);
                                  }}
                                  className="h-10 text-base w-full mt-2"
                                >
                                  <Plus className="h-4 w-4 mr-2" /> {t('orders.form.createNewCustomer')}
                                </Button>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">{t('orders.form.area')}</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder={t('orders.form.areaPlaceholder')}
                        className="h-12 text-base" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="orderDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">{t('orders.form.orderDate')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        className="h-12 text-base"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="estimatedShippingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">{t('orders.form.estimatedShippingDate')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        className="h-12 text-base"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="shippingCompany"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">{t('orders.form.shippingCompany')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="text" 
                        className="h-12 text-base"
                        placeholder={t('orders.form.shippingCompanyPlaceholder')}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      {t('orders.form.shippingCompanyDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="billingCompany"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">{t('orders.form.billingCompany') || "Billing Company"}</FormLabel>
                    <FormControl>
                      <Input 
                        type="text" 
                        className="h-12 text-base"
                        placeholder={t('orders.form.billingCompanyPlaceholder') || "Enter billing company name"}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      {t('orders.form.billingCompanyDescription') || "The company that will be invoiced"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">{t('orders.form.priority')}</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-12 text-base">
                          <SelectValue placeholder={t('orders.form.selectPriority')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">
                          <div className="flex items-center">
                            <span className="h-2 w-2 rounded-full bg-slate-400 mr-2"></span>
                            {t('orders.form.priorities.low')}
                          </div>
                        </SelectItem>
                        <SelectItem value="medium">
                          <div className="flex items-center">
                            <span className="h-2 w-2 rounded-full bg-blue-500 mr-2"></span>
                            {t('orders.form.priorities.medium')}
                          </div>
                        </SelectItem>
                        <SelectItem value="high">
                          <div className="flex items-center">
                            <span className="h-2 w-2 rounded-full bg-orange-500 mr-2"></span>
                            {t('orders.form.priorities.high')}
                          </div>
                        </SelectItem>
                        <SelectItem value="urgent">
                          <div className="flex items-center">
                            <span className="h-2 w-2 rounded-full bg-red-500 mr-2"></span>
                            {t('orders.form.priorities.urgent')}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <FormLabel className="text-base font-medium">{t('orders.form.products')}</FormLabel>
                <Button
                  type="button"
                  className="h-12 text-base px-4 bg-primary hover:bg-primary/90 text-white"
                  onClick={() => setIsProductSearchOpen(true)}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" /> {t('orders.form.addProduct')}
                </Button>
              </div>
              
              {/* Unshipped products reminder section - now more prominent */}
              {unshippedProducts.length > 0 && (
                <div id="unshipped-products-section" className="mb-4 border-2 border-amber-300 rounded-lg p-4 bg-amber-50 shadow-md">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center text-amber-800">
                      <AlertTriangle className="h-5 w-5 mr-2 text-amber-600 flex-shrink-0" /> 
                      <span className="text-base font-semibold">{t('orders.form.unshippedProductsTitle')} ({unshippedProducts.length})</span>
                    </div>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-9 bg-amber-600 hover:bg-amber-700 text-white font-medium"
                      onClick={() => {
                        // Add all unshipped products at once
                        let newOrderItems = [...orderItems];
                        let addedCount = 0;
                        
                        unshippedProducts.forEach(product => {
                          // Check if product already exists in order
                          const existingItemIndex = newOrderItems.findIndex(item => item.productId === product.id);
                          
                          if (existingItemIndex >= 0) {
                            // Update existing item quantity
                            newOrderItems[existingItemIndex] = {
                              ...newOrderItems[existingItemIndex],
                              quantity: newOrderItems[existingItemIndex].quantity + product.quantity
                            };
                          } else {
                            // Add as new item
                            newOrderItems.push({
                              productId: product.id,
                              product,
                              quantity: product.quantity
                            });
                          }
                          addedCount++;
                        });
                        
                        setOrderItems(newOrderItems);
                        
                        if (addedCount > 0) {
                          toast({
                            title: t('orders.form.productsAdded'),
                            description: t('orders.form.allUnshippedItemsAdded', { count: addedCount }),
                          });
                        }
                      }}
                    >
                      <PackageOpen className="h-4 w-4 mr-2" /> {t('orders.form.addAllUnshippedItems')}
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Display grouped by order */}
                    {Object.values(groupedUnshippedProducts).map((group) => (
                      <div key={group.orderNumber} className="border border-amber-200 rounded-md bg-white p-3">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-100">
                          <div>
                            <h4 className="font-medium text-amber-900">
                              {t('orders.form.fromOrder')}: <span className="font-bold">{group.orderNumber}</span>
                            </h4>
                            <p className="text-sm text-amber-700">
                              {new Date(group.orderDate).toLocaleDateString()} • {group.items.length} {t('orders.form.items')}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-amber-500 hover:bg-amber-600 border-amber-500 hover:border-amber-600 text-white h-9"
                            onClick={() => {
                              // Add all items from this order group
                              let newOrderItems = [...orderItems];
                              let addedCount = 0;
                              
                              group.items.forEach(product => {
                                // Check if product already exists in order
                                const existingItemIndex = newOrderItems.findIndex(item => item.productId === product.id);
                                
                                if (existingItemIndex >= 0) {
                                  // Update existing item quantity
                                  newOrderItems[existingItemIndex] = {
                                    ...newOrderItems[existingItemIndex],
                                    quantity: newOrderItems[existingItemIndex].quantity + product.quantity
                                  };
                                } else {
                                  // Add as new item
                                  newOrderItems.push({
                                    productId: product.id,
                                    product,
                                    quantity: product.quantity
                                  });
                                }
                                addedCount++;
                              });
                              
                              setOrderItems(newOrderItems);
                              
                              if (addedCount > 0) {
                                toast({
                                  title: t('orders.form.productsAdded'),
                                  description: `${addedCount} ${t('orders.form.itemsAddedFromOrder', { orderNumber: group.orderNumber })}`,
                                });
                              }
                            }}
                          >
                            <Package className="h-4 w-4 mr-2" /> {t('orders.form.addAllItemsFromOrder')}
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {group.items.map((product) => (
                            <div 
                              key={product.id}
                              className="bg-amber-50 border border-amber-200 rounded-md p-3 hover:border-amber-400 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="font-medium text-base text-amber-900">{product.name}</div>
                                  <div className="text-sm text-amber-800">{t('orders.form.sku')}: {product.sku}</div>
                                </div>
                                <Badge variant="outline" className="border-amber-500 text-amber-800 bg-amber-100">
                                  {product.status === 'pending' ? t('orders.form.pending') : t('orders.form.picked')}
                                </Badge>
                              </div>
                              <div className="flex justify-between mt-3 items-center">
                                <span className="text-sm text-amber-800">
                                  {t('orders.form.quantity')}: <span className="font-medium text-base">{product.quantity}</span>
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="bg-amber-500 hover:bg-amber-600 border-amber-500 hover:border-amber-600 text-white h-8 px-2"
                                  onClick={() => {
                                    // Check if product already exists in order
                                    const existingItem = orderItems.find(item => item.productId === product.id);
                                    
                                    if (existingItem) {
                                      // If it exists, update the quantity to include the unshipped quantity
                                      const updatedItems = orderItems.map(item => 
                                        item.productId === product.id 
                                          ? { ...item, quantity: item.quantity + product.quantity }
                                          : item
                                      );
                                      setOrderItems(updatedItems);
                                      
                                      toast({
                                        title: t('orders.form.productQuantityUpdated'),
                                        description: t('orders.form.unshippedItemAddedToExisting'),
                                      });
                                    } else {
                                      // Otherwise add it as a new item with the unshipped quantity
                                      setOrderItems([...orderItems, { 
                                        productId: product.id, 
                                        product,
                                        quantity: product.quantity 
                                      }]);
                                      
                                      toast({
                                        title: t('orders.form.productAdded'),
                                        description: t('orders.form.unshippedItemAddedToOrder'),
                                      });
                                    }
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-1" /> {t('orders.form.addToOrder')}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Previous products suggestions section */}
              {previousProducts.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center text-base font-medium text-slate-700 mb-2">
                    <ShoppingCart className="h-4 w-4 mr-2" /> {t('orders.form.previousProductsFromCustomer')}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {previousProducts.slice(0, 6).map((product) => (
                      <div 
                        key={product.id}
                        className="bg-white border border-slate-200 rounded-md p-3 hover:border-primary transition-colors relative"
                      >
                        <div className="flex items-start">
                          <Button 
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-full mr-3 flex-shrink-0 text-primary hover:bg-primary hover:text-white border-primary shadow-sm"
                            onClick={() => addProduct(product)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{product.name}</div>
                            <div className="text-xs text-slate-500 mb-1">{t('orders.form.sku')}: {product.sku}</div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs">
                                {t('orders.form.stock')}: <span className={`font-medium ${
                                  (product.currentStock || 0) <= (product.minStockLevel || 0) 
                                    ? 'text-red-600' 
                                    : 'text-green-600'
                                }`}>{product.currentStock || 0}</span>
                              </span>
                              <div className="text-xs bg-slate-100 px-2 py-1 rounded-full">
                                {product.orderCount > 1 
                                  ? t('orders.form.orderedMultipleTimes', { count: product.orderCount }) 
                                  : t('orders.form.orderedOnce')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="bg-slate-50 p-4 rounded-md">
                {orderItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="py-3 px-4 text-left font-semibold text-base">{t('orders.form.productColumn')}</th>
                          <th className="py-3 px-4 text-left font-semibold text-base w-24">{t('orders.form.quantityColumn')}</th>
                          <th className="py-3 px-4 text-left font-semibold text-base">{t('orders.form.stockColumn')}</th>
                          <th className="py-3 px-4 text-left font-semibold text-base w-20">{t('orders.form.actionsColumn')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map((item, index) => (
                          <tr key={index} className="border-b border-slate-200">
                            <td className="py-4 px-4">
                              <div className="text-base font-medium">{item.product?.name}</div>
                              <div className="text-sm text-slate-500">{t('orders.form.sku')}: {item.product?.sku}</div>
                            </td>
                            <td className="py-4 px-4">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity === 0 ? '' : item.quantity}
                                onChange={(e) => {
                                  // Allow empty value or positive numbers only
                                  const parsedValue = parseInt(e.target.value);
                                  const newValue = e.target.value === '' ? 0 : (isNaN(parsedValue) || parsedValue < 1) ? 1 : parsedValue;
                                  updateQuantity(index, newValue);
                                }}
                                placeholder="Qty"
                                className={`w-full h-12 text-base ${item.quantity > (item.product?.currentStock || 0) ? 'border-amber-400' : ''}`}
                              />
                            </td>
                            <td className="py-4 px-4">
                              <div>
                                <span className="text-base">
                                  {t('orders.form.availableStock')}: {' '}
                                  <span className={`font-medium ${
                                    (item.product?.currentStock || 0) <= (item.product?.minStockLevel || 0) 
                                      ? 'text-red-600' 
                                      : 'text-green-600'
                                  }`}>
                                    {item.product?.currentStock || 0}
                                  </span>
                                </span>
                                {item.quantity > (item.product?.currentStock || 0) && (
                                  <div className="mt-1 text-sm text-amber-600 flex items-center">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {t('orders.form.partialFulfillment')}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <Button 
                                type="button" 
                                size="icon"
                                variant="outline"
                                className="flex items-center justify-center p-2 rounded-full bg-red-100 text-red-500 hover:bg-red-200 hover:text-red-700 border-red-200 min-h-[44px] min-w-[44px]"
                                onClick={() => removeProduct(index)}
                              >
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-slate-600 italic">
                    {t('orders.form.noProductsMessage')}
                  </div>
                )}
              </div>
              
              {form.formState.errors.items && (
                <p className="text-sm font-medium text-red-500 mt-2">
                  {form.formState.errors.items.message}
                </p>
              )}
            </div>
            
            {/* Removed duplicate billingCompany field - already present in customer info tab */}
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="mb-6">
                  <FormLabel className="text-base font-medium">{t('orders.form.notes')}</FormLabel>
                  <FormControl>
                    <Textarea 
                      rows={3} 
                      className="text-base p-4"
                      placeholder={t('orders.form.notesPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-4">
              {isEditMode && onCancel ? (
                <Button 
                  type="button" 
                  variant="outline"
                  className="h-12 text-base px-6"
                  onClick={onCancel}
                >
                  <X className="h-4 w-4 mr-2" /> {t('common.cancel')}
                </Button>
              ) : (
                <Button 
                  type="button" 
                  variant="outline"
                  className="h-12 text-base px-6"
                  onClick={() => {
                    // Clear the form state
                    form.reset();
                    setOrderItems([]);
                    // Navigate to orders page
                    window.location.href = "/orders";
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" /> {t('orders.form.backToOrders')}
                </Button>
              )}
              <Button 
                type="submit" 
                className="h-12 text-base px-6"
                disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
              >
                {createOrderMutation.isPending || updateOrderMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {isEditMode ? t('orders.form.updating') : t('orders.form.creating')}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" /> {isEditMode ? t('orders.form.updateOrder') : t('orders.form.createOrder')}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
      
      <ProductSearch 
        isOpen={isProductSearchOpen} 
        onClose={() => setIsProductSearchOpen(false)}
        onSelectProduct={addProduct}
      />
      
      {/* New Customer Dialog */}
      <Dialog open={isNewCustomerDialogOpen} onOpenChange={setIsNewCustomerDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{t('orders.form.addNewCustomer')}</DialogTitle>
            <DialogDescription className="text-base">
              {t('orders.form.customerDetailsInstructions')}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...customerForm}>
            <form onSubmit={customerForm.handleSubmit((values) => customerMutation.mutate(values))}>
              <div className="space-y-4 py-2">
                <FormField
                  control={customerForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">{t('customers.form.customerName')}*</FormLabel>
                      <FormControl>
                        <Input className="h-12 text-base" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={customerForm.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">{t('customers.form.vatNumber')}</FormLabel>
                      <FormControl>
                        <Input className="h-12 text-base" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={customerForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">{t('customers.form.address')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          className="h-20 text-base" 
                          {...field} 
                          value={field.value || ''} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={customerForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">{t('customers.form.city')}</FormLabel>
                        <FormControl>
                          <Input className="h-12 text-base" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={customerForm.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">{t('customers.form.stateProvince')}</FormLabel>
                        <FormControl>
                          <Input className="h-12 text-base" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={customerForm.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">{t('customers.form.postalCode')}</FormLabel>
                        <FormControl>
                          <Input className="h-12 text-base" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={customerForm.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">{t('customers.form.country')}</FormLabel>
                        <FormControl>
                          <Input className="h-12 text-base" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={customerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">{t('customers.form.email')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          className="h-12 text-base" 
                          {...field} 
                          value={field.value || ''} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={customerForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">{t('customers.form.phone')}</FormLabel>
                      <FormControl>
                        <Input className="h-12 text-base" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={customerForm.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">{t('customers.form.contactPerson')}</FormLabel>
                      <FormControl>
                        <Input className="h-12 text-base" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={customerForm.control}
                  name="preferredShippingCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">{t('customers.form.preferredShippingCompany')}</FormLabel>
                      <FormControl>
                        <Input 
                          className="h-12 text-base" 
                          placeholder={t('customers.form.enterShippingCompany')} 
                          {...field} 
                          value={field.value || ''} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={customerForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">{t('customers.form.notes')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          className="h-20 text-base" 
                          {...field} 
                          value={field.value || ''} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter className="pt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 text-base"
                  onClick={() => setIsNewCustomerDialogOpen(false)}
                >
                  <X className="h-4 w-4 mr-2" /> {t('common.cancel')}
                </Button>
                <Button 
                  type="submit" 
                  className="h-12 text-base"
                  disabled={customerMutation.isPending}
                >
                  {customerMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('customers.form.creating')}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" /> {t('customers.form.createCustomer')}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderForm;
