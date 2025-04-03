import { useState, useEffect } from "react";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ClickableField from "@/components/common/ClickableField";
import { capitalizeFirstLetter } from "@/lib/utils";

interface Customer {
  id: number;
  name: string;
}

const customerFormSchema = z.object({
  name: z.string().min(1, {
    message: "Customer name is required.",
  }),
  vatNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(), 
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  contactPerson: z.string().optional(),
  preferredShippingCompany: z.string().optional(),
  notes: z.string().optional(),
});

interface Product {
  id: number;
  name: string;
  sku: string;
  currentStock: number;
  minStockLevel: number;
}

const orderFormSchema = z.object({
  customerName: z.string().min(1, {
    message: "Customer name is required.",
  }),
  area: z.string().optional(),
  orderDate: z.string().min(1, {
    message: "Order date is required.",
  }),
  estimatedShippingDate: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["pending", "picked", "shipped", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

interface OrderItemInput {
  productId: number;
  product?: Product;
  quantity: number;
}

// Define props
interface OrderFormProps {
  initialData?: {
    id?: number;
    orderNumber?: string;
    customerName: string;
    area?: string;
    orderDate: string;
    estimatedShippingDate?: string;
    notes?: string;
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

// Define form types
type OrderFormValues = z.infer<typeof orderFormSchema>;
type CustomerFormValues = z.infer<typeof customerFormSchema>;

// Main component
const OrderForm = ({
  initialData = {
    customerName: '',
    area: '',
    orderDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending' as const,
    priority: 'medium' as const,
  },
  isEditMode = false,
  onCancel,
  onSuccess,
}: OrderFormProps = {}) => {
  // Translation hook
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { playSound } = useNotifications();
  
  // Form initialization
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customerName: initialData.customerName || '',
      area: initialData.area || '',
      orderDate: initialData.orderDate || format(new Date(), 'yyyy-MM-dd'),
      estimatedShippingDate: initialData.estimatedShippingDate || '',
      notes: initialData.notes || '',
      status: initialData.status || 'pending',
      priority: initialData.priority || 'medium',
    },
  });
  
  // Create new customer form
  const customerForm = useForm<CustomerFormValues>({
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
      preferredShippingCompany: '',
      notes: '',
    },
  });
  
  // State management
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItemInput[]>(
    initialData.items 
      ? initialData.items.map(item => ({
          productId: item.productId,
          product: item.product,
          quantity: item.quantity
        }))
      : []
  );
  const [selectedTab, setSelectedTab] = useState("order-details");
  const [expandedAccordions, setExpandedAccordions] = useState<string[]>([]);
  
  interface ProductWithOrderCount extends Product {
    orderCount: number;
  }
  
  const [suggestedProducts, setSuggestedProducts] = useState<ProductWithOrderCount[]>([]);
  
  interface UnshippedProduct extends Product {
    quantity: number;
    orderNumber: string;
    orderDate: string;
    status: 'pending' | 'picked' | 'shipped' | 'cancelled';
  }
  
  const [unshippedProducts, setUnshippedProducts] = useState<UnshippedProduct[]>([]);
  
  // Set up API queries and mutations
  const { data: customers = [] } = useQuery({
    queryKey: ['/api/customers'],
    select: (data) => data as Customer[],
  });
  
  // Get unshipped items when customer is selected
  useEffect(() => {
    if (form.watch("customerName")) {
      // Get unshipped products for this customer
      apiRequest(`/api/unshipped-products?customerName=${encodeURIComponent(form.watch("customerName"))}`)
        .then(data => {
          setUnshippedProducts(data);
        })
        .catch(error => {
          console.error("Error fetching unshipped products:", error);
        });
      
      // Get suggested products for this customer
      apiRequest(`/api/suggested-products?customerName=${encodeURIComponent(form.watch("customerName"))}`)
        .then(data => {
          setSuggestedProducts(data);
        })
        .catch(error => {
          console.error("Error fetching suggested products:", error);
        });
      
      // Get customer area for new orders
      if (!isEditMode && !initialData.area) {
        apiRequest(`/api/customers/area?customerName=${encodeURIComponent(form.watch("customerName"))}`)
          .then(data => {
            if (data && data.area) {
              form.setValue("area", data.area);
            }
          })
          .catch(error => {
            console.error("Error fetching customer area:", error);
          });
      }
    }
  }, [form.watch("customerName")]);
  
  // Customer mutation
  const customerMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      return await apiRequest("/api/customers", {
        method: "POST",
        data: values,
      });
    },
    onSuccess: (data) => {
      if (data) {
        setIsNewCustomerDialogOpen(false);
        form.setValue("customerName", data.name);
        queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
        toast({
          title: t('customers.form.customerCreated'),
          description: t('customers.form.customerCreatedSuccess'),
        });
        playSound('success');
        customerForm.reset();
      }
    },
    onError: (error) => {
      console.error("Error creating customer:", error);
      toast({
        title: t('common.error'),
        description: t('customers.form.customerCreationError'),
        variant: "destructive",
      });
    },
  });
  
  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (values: OrderFormValues) => {
      return await apiRequest("/api/orders", {
        method: "POST",
        data: {
          ...values,
          items: orderItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        },
      });
    },
    onSuccess: (data) => {
      if (data) {
        toast({
          title: t('orders.form.orderCreated'),
          description: t('orders.form.orderCreatedSuccess', { orderNumber: data.orderNumber }),
        });
        playSound('success');
        
        // Reset form or redirect
        if (onSuccess) {
          onSuccess();
        } else {
          form.reset();
          setOrderItems([]);
        }
      }
    },
    onError: (error) => {
      console.error("Error creating order:", error);
      toast({
        title: t('common.error'),
        description: t('orders.form.orderCreationError'),
        variant: "destructive",
      });
    },
  });
  
  // Update order mutation
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: OrderFormValues }) => {
      return await apiRequest(`/api/orders/${id}`, {
        method: "PATCH",
        data: {
          ...values,
          items: orderItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        },
      });
    },
    onSuccess: (data) => {
      if (data) {
        toast({
          title: t('orders.form.orderUpdated'),
          description: t('orders.form.orderUpdatedSuccess'),
        });
        playSound('success');
        
        // Reset form or redirect
        if (onSuccess) {
          onSuccess();
        }
      }
    },
    onError: (error) => {
      console.error("Error updating order:", error);
      toast({
        title: t('common.error'),
        description: t('orders.form.orderUpdateError'),
        variant: "destructive",
      });
    },
  });
  
  // Form submission handler
  const onSubmit = (values: OrderFormValues) => {
    if (orderItems.length === 0) {
      toast({
        title: t('common.warning'),
        description: t('orders.form.noItemsWarning'),
        variant: "warning",
      });
      return;
    }
    
    if (isEditMode && initialData.id) {
      updateOrderMutation.mutate({ id: initialData.id, values });
    } else {
      createOrderMutation.mutate(values);
    }
  };
  
  // Helper function to handle adding product to order
  const addProduct = (product: Product) => {
    // Check if already in orderItems
    const existingItemIndex = orderItems.findIndex(item => item.productId === product.id);
    
    if (existingItemIndex >= 0) {
      // Update quantity if already added
      const newItems = [...orderItems];
      newItems[existingItemIndex].quantity += 1;
      setOrderItems(newItems);
    } else {
      // Add as new item
      setOrderItems([
        ...orderItems,
        {
          productId: product.id,
          product: product,
          quantity: 1 
        }
      ]);
    }
  };
  
  // Remove product from order
  const removeProduct = (index: number) => {
    const newItems = [...orderItems];
    newItems.splice(index, 1);
    setOrderItems(newItems);
  };
  
  const updateQuantity = (index: number, quantity: number) => {
    const newItems = [...orderItems];
    // Set the quantity directly without forcing a minimum value
    newItems[index].quantity = quantity;
    setOrderItems(newItems);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="sticky top-0 z-10 bg-white p-4 border-b border-slate-200 flex justify-between items-center">
        <h2 className="font-semibold text-lg">
          {isEditMode 
            ? `${t('orders.editOrder')}${initialData?.orderNumber ? ` ${initialData.orderNumber}` : ''}` 
            : t('orders.form.createNewOrder')}
        </h2>
        <div className="flex items-center gap-2">
          {isEditMode && onCancel ? (
            <Button 
              type="button" 
              variant="outline" 
              className="h-10"
              onClick={onCancel}
            >
              <i className="fas fa-times mr-2"></i>
              {t('common.cancel')}
            </Button>
          ) : null}
          <Button 
            type="button" 
            className="h-10"
            onClick={form.handleSubmit(onSubmit)}
            disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
          >
            {createOrderMutation.isPending || updateOrderMutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {isEditMode ? t('orders.form.updating') : t('orders.form.creating')}
              </>
            ) : (
              <>
                <i className={`fas ${isEditMode ? 'fa-save' : 'fa-plus'} mr-2`}></i>
                {isEditMode ? t('orders.form.saveOrder') : t('orders.form.createOrder')}
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
        <div className="md:col-span-2 space-y-6">
          <Tabs 
            value={selectedTab} 
            onValueChange={setSelectedTab}
            className="w-full"
          >
            <TabsList className="w-full justify-start mb-6">
              <TabsTrigger value="order-details" className="text-base px-4 py-2">
                <i className="fas fa-clipboard-list mr-2"></i>
                {t('orders.form.orderDetails')}
              </TabsTrigger>
              <TabsTrigger value="shipping-info" className="text-base px-4 py-2">
                <i className="fas fa-truck mr-2"></i>
                {t('orders.form.shippingInfo')}
              </TabsTrigger>
              {unshippedProducts.length > 0 && (
                <TabsTrigger value="unshipped-items" className="text-base px-4 py-2">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  {t('orders.form.unshippedItems')}
                  <Badge variant="outline" className="ml-2">{unshippedProducts.length}</Badge>
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="order-details" className="mt-0">
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">{t('orders.form.basicInfo')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Form {...form}>
                      <div className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="flex-1">
                            <FormField
                              control={form.control}
                              name="customerName"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-base font-medium">{t('orders.form.customer')}*</FormLabel>
                                  <div className="flex gap-2">
                                    <FormControl>
                                      <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                      >
                                        <SelectTrigger className="h-12 text-base">
                                          <SelectValue placeholder={t('orders.form.selectCustomer')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {customers.map((customer) => (
                                            <SelectItem 
                                              key={customer.id} 
                                              value={customer.name}
                                              className="text-base py-3"
                                            >
                                              {customer.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </FormControl>
                                    <Button
                                      type="button"
                                      className="h-12 flex-shrink-0"
                                      onClick={() => setIsNewCustomerDialogOpen(true)}
                                    >
                                      <i className="fas fa-plus"></i>
                                    </Button>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <FormField
                            control={form.control}
                            name="area"
                            render={({ field }) => (
                              <FormItem className="flex-1 md:w-1/3">
                                <FormLabel className="text-base font-medium">{t('orders.form.area')}</FormLabel>
                                <FormControl>
                                  <Input className="h-12 text-base" {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="flex flex-col md:flex-row gap-4">
                          <FormField
                            control={form.control}
                            name="orderDate"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel className="text-base font-medium">{t('orders.form.orderDate')}*</FormLabel>
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
                              <FormItem className="flex-1">
                                <FormLabel className="text-base font-medium">{t('orders.form.estShippingDate')}</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="date" 
                                    className="h-12 text-base"
                                    {...field} 
                                    value={field.value || ''} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        {isEditMode && (
                          <div className="flex flex-col md:flex-row gap-4">
                            <FormField
                              control={form.control}
                              name="status"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-base font-medium">{t('orders.form.status')}</FormLabel>
                                  <FormControl>
                                    <Select
                                      value={field.value}
                                      onValueChange={field.onChange}
                                    >
                                      <SelectTrigger className="h-12 text-base">
                                        <SelectValue placeholder={t('orders.form.selectStatus')} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending" className="text-base py-3">
                                          {t('orders.status.pending')}
                                        </SelectItem>
                                        <SelectItem value="picked" className="text-base py-3">
                                          {t('orders.status.picked')}
                                        </SelectItem>
                                        <SelectItem value="shipped" className="text-base py-3">
                                          {t('orders.status.shipped')}
                                        </SelectItem>
                                        <SelectItem value="cancelled" className="text-base py-3">
                                          {t('orders.status.cancelled')}
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="priority"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-base font-medium">{t('orders.form.priority')}</FormLabel>
                                  <FormControl>
                                    <Select
                                      value={field.value || 'medium'}
                                      onValueChange={field.onChange}
                                    >
                                      <SelectTrigger className="h-12 text-base">
                                        <SelectValue placeholder={t('orders.form.selectPriority')} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="low" className="text-base py-3">
                                          {t('orders.priority.low')}
                                        </SelectItem>
                                        <SelectItem value="medium" className="text-base py-3">
                                          {t('orders.priority.medium')}
                                        </SelectItem>
                                        <SelectItem value="high" className="text-base py-3">
                                          {t('orders.priority.high')}
                                        </SelectItem>
                                        <SelectItem value="urgent" className="text-base py-3">
                                          {t('orders.priority.urgent')}
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                        
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-medium">{t('orders.form.notes')}</FormLabel>
                              <FormControl>
                                <Textarea 
                                  className="min-h-[100px] text-base"
                                  {...field} 
                                  value={field.value || ''} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </Form>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="shipping-info" className="mt-0">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">{t('orders.form.shippingDetails')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {form.watch("customerName") ? (
                    <div className="space-y-4">
                      <p>{t('orders.form.shippingInfoWillBeAutoFilled')}</p>
                      <p className="text-muted-foreground">{t('orders.form.toChangeShippingInfoEditCustomer')}</p>
                      <div className="flex justify-end">
                        <Link href={`/customers`} className="text-primary hover:underline">
                          {t('orders.form.editCustomerDetails')} <i className="fas fa-arrow-right ml-1"></i>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p>{t('orders.form.selectCustomerFirst')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {unshippedProducts.length > 0 && (
              <TabsContent value="unshipped-items" className="mt-0">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">{t('orders.form.unshippedItems')}</CardTitle>
                    <CardDescription className="text-base">
                      {t('orders.form.theseItemsAreFromPreviousOrders')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {unshippedProducts.map((item, index) => (
                        <div key={index} className="flex items-center p-4 border rounded-lg hover:bg-slate-50">
                          <div className="flex-1">
                            <div className="font-medium text-base">{item.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {t('orders.form.orderNumber')}: {item.orderNumber} | 
                              {t('orders.form.quantity')}: {item.quantity} | 
                              {t('orders.form.date')}: {item.orderDate}
                            </div>
                          </div>
                          <Button 
                            type="button" 
                            variant="outline"
                            className="h-10"
                            onClick={() => addProduct(item)}
                          >
                            <i className="fas fa-plus-circle mr-2"></i>
                            {t('orders.form.addToOrder')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex justify-between items-center">
                <span>{t('orders.form.orderItems')}</span>
                <span className="text-base text-muted-foreground">
                  {orderItems.length} {t('orders.form.items')}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProductSearch onAddProduct={addProduct} />
              
              {orderItems.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b flex items-center text-sm font-medium">
                    <div className="flex-1">{t('orders.form.product')}</div>
                    <div className="w-20 text-center">{t('orders.form.qty')}</div>
                    <div className="w-12 text-center"></div>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {orderItems.map((item, index) => (
                      <div key={index} className="p-3 border-b last:border-b-0 flex items-center">
                        <div className="flex-1">
                          <div className="font-medium">
                            {item.product?.name || `Product ID: ${item.productId}`}
                          </div>
                          {item.product && (
                            <div className="text-sm text-muted-foreground">
                              SKU: {item.product.sku} | {t('products.stock')}: {item.product.currentStock}
                            </div>
                          )}
                        </div>
                        <div className="w-20 text-center">
                          <Input
                            type="number"
                            min="1"
                            className="h-10 w-16"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(index, parseInt(e.target.value, 10) || 0)}
                          />
                        </div>
                        <div className="w-12 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeProduct(index)}
                          >
                            <i className="fas fa-times text-red-500"></i>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 border-dashed border-2 border-gray-200 rounded-lg">
                  <p className="text-muted-foreground mb-2">
                    {t('orders.form.noItemsAdded')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('orders.form.searchForProductsToAdd')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {suggestedProducts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">{t('orders.form.frequentlyOrdered')}</CardTitle>
                <CardDescription>
                  {t('orders.form.productsBasedOnHistory')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {suggestedProducts.map((product, index) => (
                    <div 
                      key={index}
                      className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer flex items-center"
                      onClick={() => addProduct(product)}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          SKU: {product.sku} | {t('products.stock')}: {product.currentStock}
                        </div>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {product.orderCount}x
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
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