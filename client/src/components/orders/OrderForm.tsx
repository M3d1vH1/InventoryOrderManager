import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Alert, 
  AlertDescription, 
  AlertTitle 
} from "@/components/ui/alert";

import { 
  PackageOpen, 
  ShoppingCart, 
  Clipboard, 
  Plus, 
  Search, 
  Check, 
  X, 
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Users,
  Tag
} from "lucide-react";

// Define the currency formatter
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

// Define validation schemas
const orderFormSchema = z.object({
  customerName: z.string().min(2, { message: "Please select a customer" }),
  area: z.string().optional(),
  orderDate: z.string().min(1, { message: "Order date is required" }),
  estimatedShippingDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  shippingCompany: z.string().optional(),
  notes: z.string().optional(),
});

// Define the new customer form schema
const customerFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  preferredShippingCompany: z.string().optional(),
});

// This would typically be imported
const ProductSearch = ({ isOpen, onClose, onSelectProduct }: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { t } = useTranslation();
  
  const { data: products = [] } = useQuery({
    queryKey: ['/api/products/search', searchTerm],
    enabled: isOpen && !!searchTerm,
  });
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('products.searchProducts')}</DialogTitle>
          <DialogDescription>
            {t('products.searchDescription')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            className="pl-8" 
            placeholder={t('products.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {searchTerm && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {products.map((product: any) => (
              <div 
                key={product.id}
                className="flex justify-between items-center border rounded-lg p-3 hover:border-slate-400 cursor-pointer transition-colors"
                onClick={() => {
                  onSelectProduct(product);
                  onClose();
                }}
              >
                <div>
                  <p className="text-sm text-slate-500">{product.sku}</p>
                  <p className="font-medium">{product.name}</p>
                  <div className="text-sm mt-1">
                    <span className={`${
                      product.currentStock < product.minStockLevel 
                        ? 'text-red-600' 
                        : 'text-green-600'
                    }`}>
                      {t('products.inStock')}: {product.currentStock}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="font-medium">{formatCurrency(product.price || 0)}</p>
                </div>
              </div>
            ))}
            
            {products.length === 0 && (
              <div className="col-span-2 text-center p-6">
                <p className="text-slate-500">
                  {t('products.noProductsFound')}
                </p>
              </div>
            )}
          </div>
        )}
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface Customer {
  id: number;
  name: string;
  preferredShippingCompany?: string;
  customShippingCompany?: string;
  shippingCompany?: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  currentStock: number;
  minStockLevel: number;
  categoryId?: number;
  category?: {
    id: number;
    name: string;
    color?: string;
  };
  price?: number;
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

type OrderFormValues = z.infer<typeof orderFormSchema>;
type CustomerFormValues = z.infer<typeof customerFormSchema>;

const OrderForm = ({
  initialData = {
    customerName: '',
    orderDate: format(new Date(), 'yyyy-MM-dd'),
  },
  isEditMode = false,
  onCancel,
  onSuccess
}: OrderFormProps = {}) => {
  // State variables
  const [activeTab, setActiveTab] = useState<string>("customer");
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItemInput[]>(
    initialData.items?.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      product: item.product
    })) || []
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Customer form setup
  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      preferredShippingCompany: "",
    }
  });

  // Order form setup
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customerName: initialData.customerName || "",
      area: initialData.area || "",
      orderDate: initialData.orderDate || format(new Date(), 'yyyy-MM-dd'),
      estimatedShippingDate: initialData.estimatedShippingDate || "",
      notes: initialData.notes || "",
      priority: initialData.priority || "medium",
      shippingCompany: initialData.shippingCompany || "",
    },
  });

  // i18n
  const { t } = useTranslation();
  const { toast } = useToast();

  // Fetch customers for the dropdown
  const { data: customers = [] } = useQuery({
    queryKey: ['/api/customers'],
    enabled: activeTab === "customer", 
  });

  // Filtered customers based on search term
  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm.trim()) return customers;
    return customers.filter((customer: Customer) =>
      customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase())
    );
  }, [customers, customerSearchTerm]);

  // Fetch product categories
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
    enabled: activeTab === "products",
  });

  // Get products from selected customer's previous orders
  const { data: previousProducts = [] } = useQuery({
    queryKey: ['/api/customers/products', form.getValues().customerName],
    enabled: !!form.getValues().customerName && activeTab === "products"
  });

  // Group products by category
  const productsByCategory = useMemo(() => {
    const groups: { [key: string]: { name: string; color: string; items: Product[] } } = {};
    
    previousProducts.forEach((product: Product) => {
      const categoryName = product.category?.name || 'Uncategorized';
      const categoryColor = product.category?.color || '#CBD5E1';
      
      if (!groups[categoryName]) {
        groups[categoryName] = {
          name: categoryName,
          color: categoryColor,
          items: []
        };
      }
      
      groups[categoryName].items.push(product);
    });
    
    return Object.values(groups).filter(group => 
      selectedCategories.length === 0 || selectedCategories.includes(group.name)
    );
  }, [previousProducts, selectedCategories]);

  // Calculate order total
  const orderTotal = useMemo(() => {
    return orderItems.reduce((total, item) => {
      const price = item.product?.price || 0;
      return total + (price * item.quantity);
    }, 0);
  }, [orderItems]);

  // Handle customer selection
  const handleCustomerSelect = (customerName: string) => {
    const selectedCustomer = customers.find(
      (c: Customer) => c.name === customerName
    );
    
    if (selectedCustomer) {
      // Set area based on the selected customer's previous data
      const customerArea = form.getValues().area || "";
      if (!customerArea) {
        const lastOrder = customers.find((c: any) => 
          c.name === customerName && c.lastOrder && c.lastOrder.area
        )?.lastOrder;
        
        if (lastOrder?.area) {
          form.setValue("area", lastOrder.area);
        }
      }
      
      // Set shipping company from customer's preferences
      setShippingCompanyFromCustomer(selectedCustomer);
    }
    
    form.setValue("customerName", customerName);
  };

  // Create new customer mutation
  const customerMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      return await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      }).then(res => res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setIsNewCustomerDialogOpen(false);
      form.setValue("customerName", data.name);
      toast({
        title: t('customers.created'),
        description: t('customers.createSuccess'),
      });
      
      // Set shipping company from new customer data
      if (data.preferredShippingCompany) {
        form.setValue("shippingCompany", data.preferredShippingCompany);
      }
    },
    onError: () => {
      toast({
        title: t('customers.createError'),
        description: t('customers.createErrorDescription'),
        variant: "destructive",
      });
    }
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (values: OrderFormValues) => {
      const orderData = {
        ...values,
        items: orderItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      };
      
      return await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      }).then(res => res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: t('orders.created'),
        description: t('orders.createSuccess'),
      });
      if (onSuccess) onSuccess();
    },
    onError: () => {
      toast({
        title: t('orders.createError'),
        description: t('orders.createErrorDescription'),
        variant: "destructive",
      });
    }
  });

  // Update order mutation
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: OrderFormValues }) => {
      const orderData = {
        ...values,
        items: orderItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      };
      
      return await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      }).then(res => res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: t('orders.updated'),
        description: t('orders.updateSuccess'),
      });
      if (onSuccess) onSuccess();
    },
    onError: () => {
      toast({
        title: t('orders.updateError'),
        description: t('orders.updateErrorDescription'),
        variant: "destructive",
      });
    }
  });

  const onSubmit = (values: OrderFormValues) => {
    if (!orderItems.length) {
      toast({
        title: t('orders.form.noItems'),
        description: t('orders.form.pleaseAddItems'),
        variant: "destructive",
      });
      return;
    }
    
    if (isEditMode && initialData.id) {
      updateOrderMutation.mutate({ id: initialData.id, values });
    } else {
      createOrderMutation.mutate(values);
    }
  };

  const addProduct = (product: Product) => {
    const existingItemIndex = orderItems.findIndex(
      item => item.productId === product.id
    );
    
    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += 1;
      setOrderItems(updatedItems);
    } else {
      // Add new item
      setOrderItems([
        ...orderItems,
        {
          productId: product.id,
          product,
          quantity: 1
        }
      ]);
    }
    
    toast({
      title: t('orders.form.productAdded'),
      description: t('orders.form.productAddedToOrder', { product: product.name }),
    });
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      setOrderItems(orderItems.filter(item => item.productId !== productId));
    } else {
      // Update quantity
      setOrderItems(orderItems.map(item => 
        item.productId === productId ? { ...item, quantity } : item
      ));
    }
  };

  const removeProduct = (productId: number) => {
    setOrderItems(orderItems.filter(item => item.productId !== productId));
    
    toast({
      title: t('orders.form.productRemoved'),
      description: t('orders.form.productRemovedFromOrder'),
    });
  };

  const setShippingCompanyFromCustomer = (customer: Customer) => {
    if (customer.preferredShippingCompany) {
      form.setValue("shippingCompany", customer.preferredShippingCompany);
    } else if (customer.customShippingCompany) {
      form.setValue("shippingCompany", customer.customShippingCompany);
    } else if (customer.shippingCompany) {
      form.setValue("shippingCompany", customer.shippingCompany);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow pb-6">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <h2 className="font-semibold text-lg">
          {isEditMode 
            ? <span className="flex items-center">
                <PackageOpen className="h-5 w-5 mr-2 text-slate-600" />
                {`${t('orders.editOrder')}${initialData?.orderNumber ? ` ${initialData.orderNumber}` : ''}`}
              </span>
            : <span className="flex items-center">
                <PackageOpen className="h-5 w-5 mr-2 text-slate-600" />
                {t('orders.form.createNewOrder')}
              </span>
          }
        </h2>
        
        {/* Tab navigation */}
        <Tabs defaultValue="customer" onValueChange={setActiveTab} value={activeTab} className="w-auto">
          <TabsList className="grid grid-cols-3 w-[400px]">
            <TabsTrigger value="customer" className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>{t('orders.form.customerInfo')}</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center space-x-1">
              <ShoppingCart className="h-4 w-4" />
              <span>{t('orders.form.products')}</span>
            </TabsTrigger>
            <TabsTrigger value="review" className="flex items-center space-x-1">
              <Clipboard className="h-4 w-4" />
              <span>{t('orders.form.review')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Order summary sticky panel */}
          <div className="fixed top-24 right-6 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-10">
            <div className="p-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
              <h3 className="font-semibold text-slate-900">{t('orders.form.orderSummary')}</h3>
            </div>
            <div className="p-3">
              <div className="space-y-2 mb-4">
                <p className="text-sm text-slate-500">{t('orders.form.itemsInOrder')}:</p>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {orderItems.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">{t('orders.form.noItemsAdded')}</p>
                  ) : (
                    orderItems.map(item => (
                      <div key={item.productId} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                        <div className="flex-1">
                          <p className="font-medium truncate" title={item.product?.name}>
                            {item.product?.name}
                          </p>
                          <p className="text-xs text-slate-500">{item.quantity} × {formatCurrency(item.product?.price || 0)}</p>
                        </div>
                        <p className="font-medium text-slate-700">
                          {formatCurrency((item.product?.price || 0) * item.quantity)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="border-t border-slate-200 pt-3 mb-4">
                <div className="flex justify-between items-center font-semibold">
                  <span>{t('orders.form.total')}:</span>
                  <span>{formatCurrency(orderTotal)}</span>
                </div>
              </div>
              
              <Button
                type="button"
                className="w-full"
                onClick={() => setIsProductSearchOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" /> {t('orders.form.addProduct')}
              </Button>
            </div>
          </div>
        </Tabs>
      </div>
      
      {/* Partial fulfillment info alert - only show when there's at least one item exceeding stock */}
      {orderItems.some(item => item.quantity > (item.product?.currentStock || 0)) && (
        <Alert className="mb-6 mx-6 mt-4 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">{t('orders.form.partialFulfillmentTitle')}</AlertTitle>
          <AlertDescription className="text-amber-700">
            {t('orders.form.partialFulfillmentDescription')}
          </AlertDescription>
        </Alert>
      )}
    
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div style={{ marginRight: '280px' }} className="px-6">
            {activeTab === "customer" && (
              <div className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-base font-medium">{t('orders.form.customer')}</FormLabel>
                      <div className="relative">
                        <div className="flex items-center space-x-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                              type="text"
                              className="pl-9 h-10 text-base"
                              placeholder={t('orders.form.searchCustomers')}
                              value={customerSearchTerm}
                              onChange={(e) => setCustomerSearchTerm(e.target.value)}
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setIsNewCustomerDialogOpen(true)}
                          >
                            <Plus className="h-4 w-4 mr-1" /> {t('orders.form.new')}
                          </Button>
                        </div>
                        
                        {customerSearchTerm && filteredCustomers.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded-md bg-white py-1 shadow-lg border border-slate-200">
                            {filteredCustomers.map((customer: Customer) => (
                              <div
                                key={customer.id}
                                className="px-3 py-2 cursor-pointer hover:bg-slate-100 transition-colors"
                                onClick={() => {
                                  handleCustomerSelect(customer.name);
                                  setCustomerSearchTerm("");
                                }}
                              >
                                <div className="font-medium">{customer.name}</div>
                                {customer.preferredShippingCompany && (
                                  <div className="text-xs text-slate-500">
                                    {t('orders.form.preferredShipping')}: {customer.preferredShippingCompany}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-3">
                        <Input
                          type="text"
                          className="h-10 text-base"
                          {...field}
                          readOnly
                          disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
                        />
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
                          className="h-10 text-base" 
                          {...field} 
                          value={field.value || ''} 
                          disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
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
                          className="h-10 text-base" 
                          {...field} 
                          disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
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
                          className="h-10 text-base" 
                          {...field} 
                          value={field.value || ''} 
                          disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
                        />
                      </FormControl>
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
                        disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 text-base">
                            <SelectValue placeholder={t('orders.form.selectPriority')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">{t('orders.priorities.low')}</SelectItem>
                          <SelectItem value="medium">{t('orders.priorities.medium')}</SelectItem>
                          <SelectItem value="high">{t('orders.priorities.high')}</SelectItem>
                          <SelectItem value="urgent">{t('orders.priorities.urgent')}</SelectItem>
                        </SelectContent>
                      </Select>
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
                          className="h-10 text-base" 
                          {...field} 
                          value={field.value || ''} 
                          disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">{t('orders.form.notes')}</FormLabel>
                        <FormControl>
                          <Textarea 
                            className="h-24 text-base" 
                            {...field} 
                            value={field.value || ''} 
                            disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="col-span-2 flex justify-end space-x-4 mt-6">
                  {isEditMode ? (
                    <Button 
                      type="button" 
                      variant="outline"
                      className="h-12 text-base px-6"
                      onClick={onCancel}
                      disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
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
              </div>
              </div>
            )}
            
            {/* Products Tab Content */}
            {activeTab === "products" && (
              <div className="mt-4">
              <div className="space-y-6">
                {/* Category filters */}
                <div className="mb-6">
                  <h3 className="text-base font-medium mb-2">{t('orders.form.filterByCategory')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category: any) => (
                      <Button
                        key={category.id}
                        type="button"
                        variant={selectedCategories.includes(category.name) ? "default" : "outline"}
                        size="sm"
                        className="rounded-full"
                        onClick={() => {
                          if (selectedCategories.includes(category.name)) {
                            setSelectedCategories(selectedCategories.filter(c => c !== category.name));
                          } else {
                            setSelectedCategories([...selectedCategories, category.name]);
                          }
                        }}
                      >
                        <span 
                          className="h-3 w-3 rounded-full mr-1"
                          style={{ backgroundColor: category.color || '#CBD5E1' }}
                        />
                        {category.name}
                      </Button>
                    ))}
                    {selectedCategories.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setSelectedCategories([])}
                      >
                        {t('orders.form.clearFilters')}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Customer's previous products */}
                {previousProducts.length > 0 ? (
                  <div className="space-y-6">
                    {productsByCategory.map(group => (
                      <div key={group.name} className="space-y-3">
                        <div className="flex items-center">
                          <span 
                            className="h-3 w-3 rounded-full mr-2"
                            style={{ backgroundColor: group.color }}
                          />
                          <div className="text-lg font-medium text-slate-700 mb-2">
                            {group.name}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {group.items.map((product) => (
                            <div 
                              key={product.id}
                              className="flex justify-between border rounded-lg p-3 hover:border-slate-400 transition-colors bg-white"
                            >
                              <div className="flex-1">
                                <div className="flex items-center mb-1">
                                  <Tag className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                                  <p className="text-sm text-slate-500">{product.sku}</p>
                                </div>
                                <p className="font-medium mb-1">{product.name}</p>
                                <div className="flex items-center text-sm">
                                  <span className={`${
                                    product.currentStock < product.minStockLevel 
                                      ? 'text-red-600' 
                                      : 'text-green-600'
                                  }`}>
                                    {t('products.inStock')}: {product.currentStock}
                                  </span>
                                </div>
                                <div className="mt-2 text-sm font-medium">
                                  {formatCurrency(product.price || 0)}
                                </div>
                              </div>
                              
                              <div className="flex flex-col space-y-2 items-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="px-3"
                                  onClick={() => addProduct(product)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                                
                                {orderItems.find(item => item.productId === product.id) && (
                                  <div className="flex items-center space-x-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 w-7 p-0"
                                      onClick={() => {
                                        const item = orderItems.find(i => i.productId === product.id);
                                        if (item) {
                                          updateQuantity(product.id, item.quantity - 1);
                                        }
                                      }}
                                    >
                                      -
                                    </Button>
                                    <Input
                                      type="number"
                                      min="1"
                                      className="h-7 w-14 text-center"
                                      value={orderItems.find(i => i.productId === product.id)?.quantity || 0}
                                      onChange={(e) => updateQuantity(product.id, parseInt(e.target.value, 10) || 0)}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 w-7 p-0"
                                      onClick={() => {
                                        const item = orderItems.find(i => i.productId === product.id);
                                        if (item) {
                                          updateQuantity(product.id, item.quantity + 1);
                                        }
                                      }}
                                    >
                                      +
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 border rounded-lg bg-slate-50">
                    <div className="flex justify-center">
                      <ShoppingCart className="h-10 w-10 text-slate-400 mb-2" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-700 mb-1">
                      {t('orders.form.noProductsFound')}
                    </h3>
                    <p className="text-slate-500 mb-4">
                      {t('orders.form.noProductsFoundDescription')}
                    </p>
                    <Button
                      type="button"
                      onClick={() => setIsProductSearchOpen(true)}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      {t('orders.form.searchProducts')}
                    </Button>
                  </div>
                )}
                
                <div className="flex justify-end mt-6">
                  <Button 
                    type="button"
                    className="h-12 text-base px-6"
                    onClick={() => setActiveTab("review")}
                  >
                    <Clipboard className="h-4 w-4 mr-2" />
                    {t('orders.form.reviewOrder')}
                  </Button>
                </div>
              </div>
              </div>
            )}
            
            {/* Review Tab Content */}
            {activeTab === "review" && (
              <div className="mt-4">
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 bg-slate-50 p-4 rounded-lg">
                  <div>
                    <h3 className="text-base font-medium text-slate-700 mb-1">{t('orders.form.customer')}</h3>
                    <p className="text-lg font-semibold">{form.getValues().customerName}</p>
                    <p className="text-slate-500">{form.getValues().area || t('orders.form.noAreaSpecified')}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-base font-medium text-slate-700 mb-1">{t('orders.form.orderDetails')}</h3>
                    <p>
                      <span className="font-medium">{t('orders.form.orderDate')}:</span> {form.getValues().orderDate}
                    </p>
                    {form.getValues().estimatedShippingDate && (
                      <p>
                        <span className="font-medium">{t('orders.form.estimatedShippingDate')}:</span> {form.getValues().estimatedShippingDate}
                      </p>
                    )}
                    <p>
                      <span className="font-medium">{t('orders.form.priority')}:</span> {t(`orders.priorities.${form.getValues().priority}`)}
                    </p>
                    {form.getValues().shippingCompany && (
                      <p>
                        <span className="font-medium">{t('orders.form.shippingCompany')}:</span> {form.getValues().shippingCompany}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Order items table */}
                <div>
                  <h3 className="text-lg font-medium text-slate-700 mb-3">{t('orders.form.orderItems')}</h3>
                  
                  {orderItems.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th scope="col" className="p-3 text-left text-sm font-semibold text-slate-700">
                              {t('orders.form.product')}
                            </th>
                            <th scope="col" className="p-3 text-left text-sm font-semibold text-slate-700">
                              {t('orders.form.sku')}
                            </th>
                            <th scope="col" className="p-3 text-center text-sm font-semibold text-slate-700">
                              {t('orders.form.quantity')}
                            </th>
                            <th scope="col" className="p-3 text-right text-sm font-semibold text-slate-700">
                              {t('orders.form.price')}
                            </th>
                            <th scope="col" className="p-3 text-right text-sm font-semibold text-slate-700">
                              {t('orders.form.subtotal')}
                            </th>
                            <th scope="col" className="p-3 text-center text-sm font-semibold text-slate-700">
                              {t('orders.form.actions')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {orderItems.map((item) => (
                            <tr key={item.productId}>
                              <td className="p-3 text-sm">
                                <span className="font-medium">{item.product?.name}</span>
                                {item.quantity > (item.product?.currentStock || 0) && (
                                  <p className="text-xs text-red-600 mt-1">
                                    {t('orders.form.insufficientStock', {
                                      available: item.product?.currentStock || 0,
                                      requested: item.quantity
                                    })}
                                  </p>
                                )}
                              </td>
                              <td className="p-3 text-sm text-slate-500">
                                {item.product?.sku}
                              </td>
                              <td className="p-3 text-sm text-center">
                                <div className="flex items-center justify-center">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 w-7 p-0"
                                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                  >
                                    -
                                  </Button>
                                  <Input
                                    type="number"
                                    min="1"
                                    className="h-7 w-14 mx-2 text-center"
                                    value={item.quantity}
                                    onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value, 10) || 0)}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 w-7 p-0"
                                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                  >
                                    +
                                  </Button>
                                </div>
                              </td>
                              <td className="p-3 text-sm text-right">
                                {formatCurrency(item.product?.price || 0)}
                              </td>
                              <td className="p-3 text-sm font-medium text-right">
                                {formatCurrency((item.product?.price || 0) * item.quantity)}
                              </td>
                              <td className="p-3 text-sm text-center">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => removeProduct(item.productId)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50">
                          <tr>
                            <td colSpan={4} className="p-3 text-right text-sm font-semibold">
                              {t('orders.form.total')}:
                            </td>
                            <td className="p-3 text-right text-base font-bold">
                              {formatCurrency(orderTotal)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center p-8 border rounded-lg bg-slate-50">
                      <ShoppingCart className="h-10 w-10 text-slate-400 mb-2 mx-auto" />
                      <h3 className="text-lg font-medium text-slate-700 mb-1">
                        {t('orders.form.noItemsAdded')}
                      </h3>
                      <p className="text-slate-500 mb-4">
                        {t('orders.form.pleaseAddItems')}
                      </p>
                      <Button
                        type="button"
                        onClick={() => setActiveTab("products")}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        {t('orders.form.goToProducts')}
                      </Button>
                    </div>
                  )}
                </div>
                
                {form.getValues().notes && (
                  <div>
                    <h3 className="text-base font-medium text-slate-700 mb-1">{t('orders.form.notes')}</h3>
                    <p className="text-slate-600 p-3 bg-slate-50 rounded-lg">{form.getValues().notes}</p>
                  </div>
                )}
                
                <div className="flex justify-end space-x-4 pt-6 border-t">
                  {isEditMode ? (
                    <Button 
                      type="button" 
                      variant="outline"
                      className="h-12 text-base px-6"
                      onClick={onCancel}
                      disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
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
                    disabled={createOrderMutation.isPending || updateOrderMutation.isPending || orderItems.length === 0}
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
              </div>
              </div>
            )}
          </div>
        </form>
      </Form>
      
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