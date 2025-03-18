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

const OrderForm = () => {
  const { toast } = useToast();
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItemInput[]>([]);

  const { data: customers, isLoading: isLoadingCustomers } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customerName: "",
      orderDate: format(new Date(), "yyyy-MM-dd"),
      notes: "",
      items: []
    }
  });

  useEffect(() => {
    // Update form items field when orderItems changes
    form.setValue('items', orderItems.map(item => ({
      productId: item.productId,
      quantity: item.quantity
    })));
  }, [orderItems, form]);

  const orderMutation = useMutation({
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

  const onSubmit = (values: OrderFormValues) => {
    console.log("Submitting order:", values);
    orderMutation.mutate(values);
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
        <h2 className="font-semibold text-lg">Create New Order</h2>
      </div>
      <div className="p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-base font-medium">Customer</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Command className="rounded-lg border border-input">
                          <CommandInput
                            placeholder="Type customer name..."
                            className="h-12 text-base"
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isLoadingCustomers}
                          />
                          {field.value.length > 0 && (
                            <CommandList>
                              <CommandEmpty>No customers found</CommandEmpty>
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
                    <FormLabel className="text-base font-medium">Order Date</FormLabel>
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
                <FormLabel className="text-base font-medium">Products</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 text-base px-4"
                  onClick={() => setIsProductSearchOpen(true)}
                >
                  <i className="fas fa-plus mr-2"></i> Add Product
                </Button>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-md">
                {orderItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="py-3 px-4 text-left font-semibold text-base">Product</th>
                          <th className="py-3 px-4 text-left font-semibold text-base w-24">Quantity</th>
                          <th className="py-3 px-4 text-left font-semibold text-base">Stock</th>
                          <th className="py-3 px-4 text-left font-semibold text-base w-20">Actions</th>
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
                                max={item.product?.currentStock || 999}
                                value={item.quantity}
                                onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                                className="w-full h-12 text-base"
                              />
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-base">
                                Available: {' '}
                                <span className={`font-medium ${
                                  (item.product?.currentStock || 0) <= (item.product?.minStockLevel || 0) 
                                    ? 'text-red-600' 
                                    : 'text-green-600'
                                }`}>
                                  {item.product?.currentStock || 0}
                                </span>
                              </span>
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
                    No products added. Click 'Add Product' to start building your order.
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
                  <FormLabel className="text-base font-medium">Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      rows={3} 
                      className="text-base p-4"
                      placeholder="Add any special instructions or notes about this order..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-4">
              <Link href="/orders">
                <Button 
                  type="button" 
                  variant="outline"
                  className="h-12 text-base px-6"
                >
                  <i className="fas fa-arrow-left mr-2"></i> Back to Orders
                </Button>
              </Link>
              <Button 
                type="submit" 
                className="h-12 text-base px-6"
                disabled={orderMutation.isPending}
              >
                {orderMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i> Creating...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-2"></i> Create Order
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
    </div>
  );
};

export default OrderForm;
