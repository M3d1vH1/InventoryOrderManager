import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ProductSearch from "@/components/products/ProductSearch";
import { format } from "date-fns";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

import {
  Form,
  FormControl,
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
import { PackageOpen, AlertTriangle, ShoppingCart } from "lucide-react";

interface Customer {
  id: number;
  name: string;
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
    orderDate: string;
    notes?: string;
    status?: 'pending' | 'picked' | 'shipped' | 'cancelled';
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
  notes: z.string().optional(),
  // Add these fields but we'll handle them separately from the API request
  orderDate: z.string().min(1, { message: "Order date is required" }),
  items: z.array(z.object({ 
    productId: z.number(), 
    quantity: z.number().min(1) 
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
  email: z.string().email({ message: "Invalid email address" }).optional().nullable(),
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
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItemInput[]>([]);
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  const [currentSearchValue, setCurrentSearchValue] = useState("");
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
  }
  
  const [previousProducts, setPreviousProducts] = useState<ProductWithOrderCount[]>([]);
  const [unshippedProducts, setUnshippedProducts] = useState<UnshippedProduct[]>([]);

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
      orderDate: initialData?.orderDate || format(new Date(), "yyyy-MM-dd"),
      notes: initialData?.notes || "",
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

  // Effect to fetch previous products when customer changes
  useEffect(() => {
    const customerName = form.watch('customerName');
    
    // Clear previous products when customer name changes
    if (!customerName || customerName.trim() === '') {
      setPreviousProducts([]);
      setUnshippedProducts([]);
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
      
      // Execute both fetches
      fetchPreviousProducts();
      fetchUnshippedProducts();
    } else {
      setPreviousProducts([]);
      setUnshippedProducts([]);
    }
  }, [form.watch('customerName'), customers]);

  useEffect(() => {
    // Update form items field when orderItems changes
    form.setValue('items', orderItems.map(item => ({
      productId: item.productId,
      quantity: item.quantity
    })));
  }, [orderItems, form]);

  const createOrderMutation = useMutation({
    mutationFn: async (values: OrderFormValues) => {
      // Send only the data that the server expects
      return apiRequest({
        url: '/api/orders',
        method: 'POST',
        body: JSON.stringify({
          customerName: values.customerName,
          notes: values.notes,
          items: values.items
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
      // Send only the data that the server expects
      return apiRequest({
        url: `/api/orders/${id}`,
        method: 'PATCH',
        body: JSON.stringify({
          customerName: values.customerName,
          notes: values.notes,
          items: values.items
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
      });
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders', initialData?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders/recent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
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
      updateOrderMutation.mutate({ id: initialData.id, values });
    } else {
      console.log("Creating order:", values);
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
      quantity: 1 
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
    newItems[index].quantity = quantity;
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
        {/* Partial fulfillment info alert */}
        <Alert className="mb-6 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">{t('orders.form.partialFulfillmentTitle')}</AlertTitle>
          <AlertDescription className="text-amber-700">
            {t('orders.form.partialFulfillmentDescription')}
          </AlertDescription>
        </Alert>
      
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
                        <Command className="rounded-lg border border-input">
                          <CommandInput
                            placeholder={t('orders.form.typeCustomerName')}
                            className="h-12 text-base"
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isLoadingCustomers}
                          />
                          {field.value.length > 0 && (
                            <CommandList>
                              <CommandEmpty className="py-4 text-center">
                                <p className="mb-3 text-base">{t('orders.form.noCustomersFound')}</p>
                                <Button 
                                  onClick={() => {
                                    setCurrentSearchValue(field.value);
                                    customerForm.setValue('name', field.value);
                                    setIsNewCustomerDialogOpen(true);
                                  }}
                                  className="h-10 text-base"
                                >
                                  <i className="fas fa-plus mr-2"></i> {t('orders.form.create')} "{field.value}"
                                </Button>
                              </CommandEmpty>
                              <CommandGroup>
                                {customers
                                  ?.filter(customer => 
                                    customer.name.toLowerCase().includes(field.value.toLowerCase()))
                                  .map(customer => (
                                    <CommandItem
                                      key={customer.id}
                                      value={customer.name}
                                      className="h-10 text-base"
                                      onSelect={(value) => {
                                        field.onChange(value);
                                      }}
                                    >
                                      {customer.name}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          )}
                        </Command>
                      </FormControl>
                    </div>
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
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <FormLabel className="text-base font-medium">{t('orders.form.products')}</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 text-base px-4"
                  onClick={() => setIsProductSearchOpen(true)}
                >
                  <i className="fas fa-plus mr-2"></i> {t('orders.form.addProduct')}
                </Button>
              </div>
              
              {/* Unshipped products reminder section */}
              {unshippedProducts.length > 0 && (
                <div className="mb-4">
                  <Alert className="mb-4 border-amber-500 bg-amber-50">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <AlertTitle className="text-amber-800">
                      {t('orders.form.unshippedProductsTitle')}
                    </AlertTitle>
                    <AlertDescription className="text-amber-700">
                      {t('orders.form.unshippedProductsDescription')}
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {unshippedProducts.map((product) => (
                      <div 
                        key={product.id}
                        className="bg-amber-50 border border-amber-200 rounded-md p-3 hover:border-amber-400 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-sm text-amber-900">{product.name}</div>
                            <div className="text-xs text-amber-800">SKU: {product.sku}</div>
                            <div className="text-xs text-amber-700 mt-1">
                              Order: {product.orderNumber} ({new Date(product.orderDate).toLocaleDateString()})
                            </div>
                          </div>
                          <Badge variant="outline" className="border-amber-500 text-amber-800 bg-amber-100">
                            {product.status === 'pending' ? 'Pending' : 'Picked'}
                          </Badge>
                        </div>
                        <div className="flex justify-between mt-2 text-xs">
                          <span className="text-amber-800">
                            Quantity: <span className="font-medium">{product.quantity}</span>
                          </span>
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="default" 
                            className="h-6 px-2 py-0 text-xs bg-amber-600 hover:bg-amber-700"
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
                            <PackageOpen className="h-3 w-3 mr-1" /> Add to Order
                          </Button>
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
                        className="bg-white border border-slate-200 rounded-md p-3 hover:border-primary cursor-pointer transition-colors"
                        onClick={() => addProduct(product)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-sm">{product.name}</div>
                            <div className="text-xs text-slate-500">SKU: {product.sku}</div>
                          </div>
                          <div className="text-xs bg-slate-100 px-2 py-1 rounded-full">
                            {product.orderCount > 1 
                              ? `Ordered ${product.orderCount} times` 
                              : "Ordered once"}
                          </div>
                        </div>
                        <div className="flex justify-between mt-2 text-xs">
                          <span>
                            Stock: <span className={`font-medium ${
                              (product.currentStock || 0) <= (product.minStockLevel || 0) 
                                ? 'text-red-600' 
                                : 'text-green-600'
                            }`}>{product.currentStock || 0}</span>
                          </span>
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 px-2 py-0 text-xs hover:bg-primary hover:text-white"
                          >
                            <i className="fas fa-plus text-xs mr-1"></i> Add
                          </Button>
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
                              <div className="text-sm text-slate-500">SKU: {item.product?.sku}</div>
                            </td>
                            <td className="py-4 px-4">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
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
                              <button 
                                type="button" 
                                className="flex items-center justify-center p-2 rounded-full bg-red-100 text-red-500 hover:bg-red-200 hover:text-red-700 min-h-[44px] min-w-[44px]"
                                onClick={() => removeProduct(index)}
                              >
                                <i className="fas fa-trash text-lg"></i>
                              </button>
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
                  <i className="fas fa-times mr-2"></i> {t('common.cancel')}
                </Button>
              ) : (
                <Link href="/orders">
                  <Button 
                    type="button" 
                    variant="outline"
                    className="h-12 text-base px-6"
                  >
                    <i className="fas fa-arrow-left mr-2"></i> {t('orders.form.backToOrders')}
                  </Button>
                </Link>
              )}
              <Button 
                type="submit" 
                className="h-12 text-base px-6"
                disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
              >
                {createOrderMutation.isPending || updateOrderMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i> {isEditMode ? t('orders.form.updating') : t('orders.form.creating')}
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-2"></i> {isEditMode ? t('orders.form.updateOrder') : t('orders.form.createOrder')}
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
                  {t('common.cancel')}
                </Button>
                <Button 
                  type="submit" 
                  className="h-12 text-base"
                  disabled={customerMutation.isPending}
                >
                  {customerMutation.isPending ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i> {t('customers.form.creating')}
                    </>
                  ) : (
                    <>
                      <i className="fas fa-plus mr-2"></i> {t('customers.form.createCustomer')}
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
