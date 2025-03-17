import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  product?: Product;
  picked?: boolean;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  minStockLevel: number;
  currentStock: number;
  description?: string;
}

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  orderDate: string;
  status: 'pending' | 'picked' | 'shipped' | 'cancelled';
  notes?: string;
  items?: OrderItem[];
}

const PickList = ({ order }: { order: Order }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pickedItems, setPickedItems] = useState<Record<number, boolean>>({});
  const [progress, setProgress] = useState(0);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  // Load product details for each order item
  const orderItemsWithProducts = order.items?.map(item => {
    const product = products.find(p => p.id === item.productId);
    return {
      ...item,
      product,
      picked: !!pickedItems[item.id]
    };
  }) || [];

  const updateOrderStatusMutation = useMutation({
    mutationFn: async (status: 'pending' | 'picked' | 'shipped' | 'cancelled') => {
      return apiRequest('PATCH', `/api/orders/${order.id}/status`, {
        status
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Order status updated",
        description: "The order has been marked as picked",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleItemPick = (itemId: number) => {
    setPickedItems(prev => {
      const newState = { ...prev, [itemId]: !prev[itemId] };
      return newState;
    });
  };

  const completePickList = () => {
    updateOrderStatusMutation.mutate('picked');
  };

  // Calculate progress whenever pickedItems changes
  useEffect(() => {
    if (order.items && order.items.length > 0) {
      const pickedCount = Object.values(pickedItems).filter(Boolean).length;
      const totalItems = order.items.length;
      const newProgress = Math.round((pickedCount / totalItems) * 100);
      setProgress(newProgress);
    }
  }, [pickedItems, order.items]);

  // Check if all items are picked
  const allItemsPicked = order.items && 
    order.items.length > 0 && 
    order.items.every(item => pickedItems[item.id]);

  if (!order.items || order.items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-slate-500">No items in this order</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Pick List: {order.orderNumber}</span>
          <Badge variant={order.status === 'pending' ? "default" : "outline"} className={order.status !== 'pending' ? "border-green-500 text-green-700 bg-green-50" : ""}>
            {order.status === 'pending' ? "Pending" : "Picked"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Customer: {order.customerName} | Order Date: {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium">Picking Progress</span>
            <span className="text-sm font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Picked</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderItemsWithProducts.map((item) => (
              <TableRow key={item.id} className={item.picked ? "bg-slate-50" : ""}>
                <TableCell>
                  <Checkbox 
                    checked={item.picked}
                    onCheckedChange={() => handleItemPick(item.id)}
                    disabled={order.status !== 'pending'}
                  />
                </TableCell>
                <TableCell className="font-mono">{item.product?.sku || "N/A"}</TableCell>
                <TableCell>{item.product?.name || "Unknown Product"}</TableCell>
                <TableCell>
                  {item.product?.category === "widgets" && "Aisle A"}
                  {item.product?.category === "connectors" && "Aisle B"}
                  {item.product?.category === "brackets" && "Aisle C"}
                  {item.product?.category === "mounts" && "Aisle D"}
                  {item.product?.category === "other" && "Aisle E"}
                </TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {order.notes && (
          <div className="mt-4 p-3 bg-slate-50 rounded-md border border-slate-200">
            <p className="text-sm font-medium mb-1">Order Notes:</p>
            <p className="text-sm text-slate-600">{order.notes}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button 
          onClick={completePickList} 
          disabled={!allItemsPicked || order.status !== 'pending' || updateOrderStatusMutation.isPending}
        >
          {updateOrderStatusMutation.isPending ? "Updating..." : "Complete Pick List"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PickList;