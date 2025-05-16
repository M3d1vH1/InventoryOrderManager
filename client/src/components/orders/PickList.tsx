import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MapPin, QrCode, ScanBarcode, Truck, RefreshCcw, CheckCircle2, FileText, Info, Printer, PackageCheck } from "lucide-react";
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
  const [orderItemsWithProducts, setOrderItemsWithProducts] = useState<(OrderItem & {product?: Product, picked?: boolean, actualQuantity?: number})[]>([]);
  const [showBoxCountDialog, setShowBoxCountDialog] = useState(false);
  const [boxCount, setBoxCount] = useState(1);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  // Initialize actual quantities and prepare order items when products or order changes
  useEffect(() => {
    if (order.items && order.items.length > 0 && products.length > 0) {
      // Initialize actual quantities
      const newQuantities: Record<number, number> = {};
      order.items.forEach(item => {
        if (actualQuantities[item.id] === undefined) {
          newQuantities[item.id] = item.quantity;
        } else {
          newQuantities[item.id] = actualQuantities[item.id];
        }
      });
      setActualQuantities(prev => ({...prev, ...newQuantities}));
      
      // Create order items with products
      const itemsWithProducts = order.items.map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
          ...item,
          product,
          picked: !!pickedItems[item.id],
          actualQuantity: newQuantities[item.id] || item.quantity
        };
      });
      setOrderItemsWithProducts(itemsWithProducts);
    }
  }, [order.items, products, pickedItems]);

  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [hasPartialFulfillment, setHasPartialFulfillment] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const { user } = useAuth(); // Import useAuth at the top

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ 
      status, 
      approvePartialFulfillment = false 
    }: { 
      status: 'pending' | 'picked' | 'shipped' | 'cancelled', 
      approvePartialFulfillment?: boolean 
    }) => {
      // Collect actual quantity data for items that have been picked
      const itemQuantities = orderItemsWithProducts
        .filter(item => item.picked)
        .map(item => ({
          orderItemId: item.id,
          productId: item.productId,
          requestedQuantity: item.quantity,
          actualQuantity: item.actualQuantity || item.quantity
        }));
      
      // Check if this is a partial fulfillment
      const isPartialFulfillment = itemQuantities.some(
        item => item.actualQuantity < item.requestedQuantity
      );
      
      // Set state for later use
      setHasPartialFulfillment(isPartialFulfillment);
      
      return apiRequest({
        url: `/api/orders/${order.id}/status`,
        method: 'PATCH',
        body: JSON.stringify({ 
          status,
          itemQuantities,
          approvePartialFulfillment
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
        description: hasPartialFulfillment 
          ? "The partial order has been approved and marked as picked" 
          : "The order has been marked as picked",
        variant: "default"
      });
      
      // Close any open dialogs
      setShowApprovalDialog(false);
    },
    onError: (error: any) => {
      // If this requires manager approval
      if (error.status === 403 && error.data?.requiresApproval) {
        setShowApprovalDialog(true);
        return;
      }
      
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
    }
  };

  const completePickList = () => {
    // Show box count dialog instead of immediately completing
    setShowBoxCountDialog(true);
  };
  
  const handleCompleteWithBoxCount = (skipPrinting = false) => {
    // Prepare data with actual quantities
    const itemsWithActualQuantities = orderItemsWithProducts
      .filter(item => item.picked)
      .map(item => ({
        orderItemId: item.id,
        productId: item.productId,
        requestedQuantity: item.quantity,
        actualQuantity: item.actualQuantity || item.quantity
      }));

    // Check if this is a partial fulfillment
    const isPartialFulfillment = itemsWithActualQuantities.some(
      item => item.actualQuantity < item.requestedQuantity
    );
    
    // Store for later use
    setHasPartialFulfillment(isPartialFulfillment);

    // Send the data to update the order status and create any unshipped items
    updateOrderStatusMutation.mutate({ 
      status: 'picked',
      // Always require explicit approval, even for admins and managers
      approvePartialFulfillment: false
    });
    
    // Print labels if not skipped
    if (!skipPrinting) {
      // Automatically generate shipping labels after order status is updated
      generateShippingLabels(order, boxCount);
    } else {
      // Show toast if skipping
      toast({
        title: "Labels skipped",
        description: "Order marked as picked without printing labels",
        variant: "default"
      });
    }
    
    // Close dialog
    setShowBoxCountDialog(false);
  };
  
  // Handle approval of partial fulfillment
  const handleApprovePartialFulfillment = () => {
    updateOrderStatusMutation.mutate({ 
      status: 'picked',
      approvePartialFulfillment: true 
    });
  };
  
  // Function to generate shipping labels using browser-based printing
  const generateShippingLabels = (order: Order, boxCount: number) => {
    // Only proceed if we have a valid box count from user input
    if (boxCount < 1) {
      toast({
        title: "Error",
        description: "Box count must be at least 1",
        variant: "destructive"
      });
      return;
    }
    
    // Log the exact user-specified box count to ensure it's being used
    console.log(`Using user-specified box count: ${boxCount}`);
    
    // Create the JScript commands for the CAB EOS1 printer (maintaining compatibility with existing format)
    const createLabelJScript = (boxNumber: number, totalBoxes: number) => {
      // Based on CAB EOS manual - JScript programming language
      return `
m m
J
H 100,0,T
S l1;0,0,68,71,100
T 25,25,0,3,pt9;Order: ${order.orderNumber}
T 25,50,0,3,pt8;Customer: ${order.customerName}
T 25,75,0,3,pt8;Date: ${new Date(order.orderDate).toLocaleDateString()}
T 25,100,0,3,pt12;BOX ${boxNumber} OF ${totalBoxes}
B 25,130,0,EAN13,60,0,3,3;${order.id.toString().padStart(12, '0')}
T 25,220,0,3,pt8;Warehouse Management System
A 1
`;
    };
    
    try {
      // Open browser printing for each label
      for (let i = 1; i <= boxCount; i++) {
        const jscript = createLabelJScript(i, boxCount);
        
        // Use browser-based printing via the PrintTemplate component
        const printUrl = `/print-template?content=${encodeURIComponent(jscript)}&orderNumber=${encodeURIComponent(order.orderNumber)}&autoPrint=false`;
        
        // Open in a new tab with a slight delay between each to prevent browser blocking
        setTimeout(() => {
          window.open(printUrl, `_blank_${i}`);
        }, i * 300); // 300ms delay between each window
      }
      
      toast({
        title: "Shipping labels ready",
        description: `${boxCount} label(s) opened in new tabs. Please click Print in each tab.`,
        variant: "default"
      });
      
      // Log to server for audit purposes without waiting for physical printing
      apiRequest({
        url: '/api/orders/log-label-print',
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          boxCount: boxCount,
          method: 'browser-print'
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch(error => {
        console.error("Failed to log label printing:", error);
      });
      
    } catch (error: any) {
      toast({
        title: "Error generating labels",
        description: error.message || "An error occurred while generating shipping labels",
        variant: "destructive"
      });
    }
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
    <>
      {/* Approval Dialog for Partial Fulfillment */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Partial Order Fulfillment Requires Approval</DialogTitle>
            <DialogDescription>
              This order cannot be fully fulfilled due to insufficient stock. Manager or admin approval is required to proceed with partial fulfillment.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Alert variant="destructive" className="mb-4">
              <AlertTitle className="flex items-center">
                <span className="bg-red-100 p-1 rounded-full mr-2">
                  <Info className="h-4 w-4 text-red-600" />
                </span>
                Insufficient Stock
              </AlertTitle>
              <AlertDescription>
                Some items in this order cannot be fulfilled with the current inventory. These items will be marked as "unshipped" and will require future fulfillment.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="approval-notes" className="text-sm font-medium">
                  Notes for Approval (Optional)
                </Label>
                <textarea 
                  id="approval-notes"
                  className="w-full mt-1 p-2 border rounded-md"
                  rows={3}
                  placeholder="Add any notes regarding this partial fulfillment"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
            >
              Cancel
            </Button>
            
            {/* Only show this button if current user is admin or manager */}
            {(user?.role === 'admin' || user?.role === 'manager') ? (
              <Button 
                type="submit"
                onClick={handleApprovePartialFulfillment}
                disabled={updateOrderStatusMutation.isPending}
              >
                {updateOrderStatusMutation.isPending ? "Approving..." : "Approve Partial Fulfillment"}
              </Button>
            ) : (
              <div className="text-sm text-slate-500 italic">
                Please contact a manager or administrator to approve this partial fulfillment.
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    
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
                  <div className="flex flex-col items-end">
                    <input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={item.actualQuantity || item.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 0 && val <= item.quantity) {
                          // Update directly in the array
                          const updatedItems = [...orderItemsWithProducts];
                          const index = updatedItems.findIndex(i => i.id === item.id);
                          if (index !== -1) {
                            updatedItems[index] = {
                              ...updatedItems[index],
                              actualQuantity: val
                            };
                            setOrderItemsWithProducts(updatedItems);
                          }
                        }
                      }}
                      disabled={order.status !== 'pending' || !item.picked}
                      className="w-20 text-right p-2 border rounded"
                      aria-label={`Actual quantity for ${item.product?.name}`}
                    />
                    {item.actualQuantity !== item.quantity && item.picked && (
                      <div className="text-xs text-amber-600 mt-1 text-right">
                        Missing: {item.quantity - (item.actualQuantity || 0)}
                      </div>
                    )}
                  </div>
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

      {/* Box Count Dialog */}
      <Dialog open={showBoxCountDialog} onOpenChange={setShowBoxCountDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <PackageCheck className="mr-2 h-5 w-5 text-blue-500" />
              Enter Box Count for Shipping Labels
            </DialogTitle>
            <DialogDescription>
              Specify how many boxes are used for this order. A shipping label will be generated for each box.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="boxCount">Number of Boxes</Label>
                <Input
                  id="boxCount"
                  type="number"
                  min={1}
                  value={boxCount}
                  onChange={(e) => setBoxCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full"
                />
              </div>
              
              <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                <div className="flex items-center mb-1">
                  <Printer className="h-4 w-4 mr-2 text-blue-500" />
                  <p className="text-sm font-medium text-blue-700">CAB EOS1 Label Information</p>
                </div>
                <p className="text-sm text-blue-600">
                  Labels will be printed with order number, customer name, and box numbers.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowBoxCountDialog(false)}
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="secondary"
                onClick={(e) => {
                  e.preventDefault();
                  handleCompleteWithBoxCount(true);
                }} 
                disabled={updateOrderStatusMutation.isPending}
              >
                {updateOrderStatusMutation.isPending ? "Processing..." : "Skip Label Printing"}
              </Button>
              <Button 
                onClick={(e) => {
                  e.preventDefault();
                  handleCompleteWithBoxCount(false);
                }} 
                disabled={boxCount < 1 || updateOrderStatusMutation.isPending}
              >
                {updateOrderStatusMutation.isPending ? "Processing..." : "Complete & Print Labels"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
    </>
  );
};

export default PickList;