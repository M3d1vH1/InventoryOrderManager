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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MapPin, QrCode, ScanBarcode, Truck, RefreshCcw, CheckCircle2, FileText, Info } from "lucide-react";
import { BarcodeScanner } from "@/components/barcode";

interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  product?: Product;
  picked?: boolean;
  actualQuantity?: number;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  minStockLevel: number;
  currentStock: number;
  description?: string;
  location?: string;
  unitsPerBox?: number;
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
  const [actualQuantities, setActualQuantities] = useState<Record<number, number>>({});
  const [progress, setProgress] = useState(0);
  const [scanMode, setScanMode] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const [sortByLocation, setSortByLocation] = useState(false);
  const [searchSku, setSearchSku] = useState('');

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  // Initialize actual quantities if not already set
  useEffect(() => {
    if (order.items && order.items.length > 0) {
      setActualQuantities(prev => {
        const newQuantities = { ...prev };
        order.items?.forEach(item => {
          // If not already set, initialize with the requested quantity
          if (newQuantities[item.id] === undefined) {
            newQuantities[item.id] = item.quantity;
          }
        });
        return newQuantities;
      });
    }
  }, [order.items]);

  // Load product details for each order item
  const orderItemsWithProducts = order.items?.map(item => {
    const product = products.find(p => p.id === item.productId);
    return {
      ...item,
      product,
      picked: !!pickedItems[item.id],
      actualQuantity: actualQuantities[item.id] || item.quantity
    };
  }) || [];

  const updateOrderStatusMutation = useMutation({
    mutationFn: async (status: 'pending' | 'picked' | 'shipped' | 'cancelled', options?: any) => {
      // Collect actual quantity data for items that have been picked
      const itemQuantities = orderItemsWithProducts
        .filter(item => item.picked)
        .map(item => ({
          orderItemId: item.id,
          productId: item.productId,
          requestedQuantity: item.quantity,
          actualQuantity: item.actualQuantity || item.quantity
        }));
      
      return apiRequest({
        url: `/api/orders/${order.id}/status`,
        method: 'PATCH',
        body: JSON.stringify({ 
          status,
          itemQuantities
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/unshipped-items'] });
      toast({
        title: "Order status updated",
        description: "The order has been marked as picked",
        variant: "default"
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
  
  const handleActualQuantityChange = (itemId: number, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      // Update the actual quantities state
      setActualQuantities(prev => ({
        ...prev,
        [itemId]: numValue
      }));
      
      // Also update the orderItemsWithProducts array directly
      setOrderItemsWithProducts(currentItems => 
        currentItems.map(item => 
          item.id === itemId 
            ? { ...item, actualQuantity: numValue }
            : item
        )
      );
    }
  };

  const completePickList = () => {
    // Prepare data with actual quantities
    const itemsWithActualQuantities = orderItemsWithProducts
      .filter(item => item.picked)
      .map(item => ({
        orderItemId: item.id,
        productId: item.productId,
        requestedQuantity: item.quantity,
        actualQuantity: item.actualQuantity || item.quantity
      }));

    // Send the data to update the order status and create any unshipped items
    updateOrderStatusMutation.mutate('picked', {
      onSuccess: () => {
        // Check if any items have partial quantities
        const hasPartialQuantities = itemsWithActualQuantities.some(
          item => item.actualQuantity < item.requestedQuantity
        );

        if (hasPartialQuantities) {
          toast({
            title: "Partial order fulfilled",
            description: "Unshipped items have been created for items with insufficient quantity.",
            variant: "destructive"
          });
        }
      }
    });
  };
  
  // Handle barcode scan
  const handleBarcodeScanned = (barcode: string) => {
    setLastScannedBarcode(barcode);
    
    // Find the order item with matching product barcode
    const orderItem = orderItemsWithProducts.find(
      item => item.product?.barcode === barcode || item.product?.sku === barcode
    );
    
    if (orderItem && order.status === 'pending') {
      // Mark the item as picked
      handleItemPick(orderItem.id);
      toast({
        title: "Item scanned",
        description: `${orderItem.product?.name} has been marked as picked`,
      });
    } else if (!orderItem) {
      toast({
        title: "Barcode not found",
        description: "No matching product found in this order",
        variant: "destructive",
      });
    }
  };
  
  // Sort order items by location for more efficient picking
  const getSortedOrderItems = () => {
    if (!sortByLocation) {
      return orderItemsWithProducts;
    }
    
    // Sort by aisle/location
    return [...orderItemsWithProducts].sort((a, b) => {
      const locationA = a.product?.location || a.product?.category || '';
      const locationB = b.product?.location || b.product?.category || '';
      return locationA.localeCompare(locationB);
    });
  };
  
  // Filter order items by SKU search term
  const getFilteredOrderItems = () => {
    const sortedItems = getSortedOrderItems();
    
    if (!searchSku) {
      return sortedItems;
    }
    
    return sortedItems.filter(item => 
      item.product?.sku?.toLowerCase().includes(searchSku.toLowerCase()) ||
      item.product?.name?.toLowerCase().includes(searchSku.toLowerCase())
    );
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
          <div className="flex items-center">
            <Truck className="h-5 w-5 mr-2 text-blue-500" />
            <span>Pick List: {order.orderNumber}</span>
          </div>
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
            <div className="flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-1 text-slate-500" />
              <span className="text-sm font-medium">Picking Progress</span>
            </div>
            <span className="text-sm font-medium text-blue-600">{progress}%</span>
          </div>
          <div className="w-full h-3 bg-blue-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-500 ease-in-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          {progress === 100 && (
            <p className="text-xs text-green-600 mt-1 flex items-center">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              All items have been picked
            </p>
          )}
        </div>
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1">
            <div className="relative">
              <Input
                placeholder="Search by SKU or product name"
                value={searchSku}
                onChange={(e) => setSearchSku(e.target.value)}
                className="pl-8"
              />
              <QrCode className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSortByLocation(!sortByLocation)}
              className={sortByLocation ? "bg-slate-100" : ""}
            >
              <MapPin className="mr-1 h-4 w-4" />
              Sort by Location
            </Button>
            
            <BarcodeScanner 
              onBarcodeScanned={handleBarcodeScanned}
              buttonText={scanMode ? "Cancel Scan" : "Scan Barcode"}
              buttonVariant="outline"
              buttonSize="sm"
              modalTitle="Scan Product Barcode"
            />
          </div>
        </div>
        
        {/* Last scanned barcode notification */}
        {lastScannedBarcode && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center mb-1">
              <ScanBarcode className="h-4 w-4 mr-2 text-blue-500" />
              <p className="text-sm font-medium text-blue-700">Barcode Scanned</p>
            </div>
            <p className="text-sm text-blue-600">
              Last scanned: <span className="font-mono font-medium">{lastScannedBarcode}</span>
            </p>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Picked</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Requested</TableHead>
              <TableHead className="text-right">Actual Shipped</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {getFilteredOrderItems().map((item) => (
              <TableRow 
                key={item.id} 
                className={item.picked ? "bg-green-50 hover:bg-green-100" : 
                  (item.product?.currentStock !== undefined && item.product.currentStock < item.quantity) ? "bg-red-50 hover:bg-red-100" : ""}
              >
                <TableCell>
                  <Checkbox 
                    checked={item.picked}
                    onCheckedChange={() => handleItemPick(item.id)}
                    disabled={order.status !== 'pending'}
                  />
                </TableCell>
                <TableCell className="font-mono">{item.product?.sku || "N/A"}</TableCell>
                <TableCell>
                  <div className="font-medium">{item.product?.name || "Unknown Product"}</div>
                  {item.product?.currentStock !== undefined && item.product.currentStock < item.quantity && (
                    <div className="flex items-center mt-1">
                      <div className="rounded-full bg-red-100 p-1 mr-1">
                        <Info className="h-3 w-3 text-red-500" />
                      </div>
                      <span className="text-xs text-red-500">
                        Low stock: {item.product?.currentStock} of {item.quantity} needed
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {item.product?.location || (
                    <>
                      {item.product?.category === "widgets" && "Aisle A"}
                      {item.product?.category === "connectors" && "Aisle B"}
                      {item.product?.category === "default" && "Aisle A"}
                      {item.product?.location || "Warehouse"}
                      {item.product?.category === "other" && "Aisle E"}
                    </>
                  )}
                </TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    max={item.quantity}
                    value={item.actualQuantity}
                    onChange={(e) => handleActualQuantityChange(item.id, e.target.value)}
                    disabled={order.status !== 'pending' || !item.picked}
                    className="w-20 text-right ml-auto"
                    aria-label={`Actual quantity for ${item.product?.name}`}
                  />
                  {item.actualQuantity !== item.quantity && item.picked && (
                    <div className="text-xs text-amber-600 mt-1 text-right">
                      Missing: {item.quantity - (item.actualQuantity || 0)}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {order.notes && (
          <div className="mt-4 p-3 bg-slate-50 rounded-md border border-slate-200">
            <div className="flex items-center mb-1">
              <FileText className="h-4 w-4 mr-1 text-slate-500" />
              <p className="text-sm font-medium">Order Notes:</p>
            </div>
            <p className="text-sm text-slate-600">{order.notes}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              // Clear all picked items
              setPickedItems({});
            }}
            disabled={order.status !== 'pending'}
          >
            <RefreshCcw className="mr-1 h-4 w-4" />
            Reset Picked Items
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              // Mark all items as picked
              const newPickedItems: Record<number, boolean> = {};
              order.items?.forEach(item => {
                newPickedItems[item.id] = true;
              });
              setPickedItems(newPickedItems);
            }}
            disabled={order.status !== 'pending'}
          >
            <Truck className="mr-1 h-4 w-4" />
            Mark All Picked
          </Button>
        </div>
        
        <Button 
          onClick={completePickList} 
          disabled={!allItemsPicked || order.status !== 'pending' || updateOrderStatusMutation.isPending}
          className="w-full sm:w-auto text-base py-6 px-8 font-medium"
          size="lg"
        >
          {updateOrderStatusMutation.isPending ? (
            "Updating..."
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Complete Pick List
              {allItemsPicked && order.status === 'pending' && (
                <span className="ml-1">({order.items?.length} items)</span>
              )}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PickList;