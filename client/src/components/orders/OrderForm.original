import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PackageOpen, ShoppingCart, Clipboard } from "lucide-react";

// Simple schema for example
const orderFormSchema = z.object({
  customerName: z.string().min(2),
  notes: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

interface OrderFormProps {
  initialData?: any;
  isEditMode?: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
}

export const OrderFormNew = ({
  initialData = {},
  isEditMode = false,
  onCancel, 
  onSuccess
}: OrderFormProps) => {
  // State variables
  const [activeTab, setActiveTab] = useState<string>("customer");
  
  // Form setup
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customerName: initialData.customerName || "",
      notes: initialData.notes || "",
    },
  });
  
  // i18n
  const { t } = useTranslation();
  
  const onSubmit = (values: OrderFormValues) => {
    console.log(values);
    if (onSuccess) onSuccess();
  };
  
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <h2 className="font-semibold text-lg">
          {isEditMode ? "Edit Order" : "Create New Order"}
        </h2>
        
        {/* Tab navigation */}
        <Tabs defaultValue="customer" onValueChange={setActiveTab} value={activeTab}>
          <TabsList className="grid grid-cols-3 w-[400px]">
            <TabsTrigger value="customer" className="flex items-center">
              <PackageOpen className="h-4 w-4 mr-2" />
              <span>Customer Info</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center">
              <ShoppingCart className="h-4 w-4 mr-2" />
              <span>Products</span>
            </TabsTrigger>
            <TabsTrigger value="review" className="flex items-center">
              <Clipboard className="h-4 w-4 mr-2" />
              <span>Review</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <div className="p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div style={{ marginRight: '280px' }}>
              {/* Customer Tab Content */}
              <TabsContent value="customer" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
              
              {/* Products Tab Content */}
              <TabsContent value="products" className="mt-0">
                <h3>Products Section</h3>
              </TabsContent>
              
              {/* Review Tab Content */}
              <TabsContent value="review" className="mt-0">
                <h3>Review Section</h3>
              </TabsContent>
              
              <div className="flex justify-end space-x-4 mt-6">
                <Button type="submit">
                  {isEditMode ? "Update Order" : "Create Order"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default OrderFormNew;