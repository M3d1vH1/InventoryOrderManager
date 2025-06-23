import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
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
import { MapPin, QrCode, ScanBarcode, Truck, RefreshCcw, CheckCircle2, FileText, Info, Printer, PackageCheck, AlertTriangle } from "lucide-react";
import { BarcodeScanner, EnhancedBarcodeScanner } from "@/components/barcode";
import ShippingLabelPreview from "@/components/shipping/ShippingLabelPreview";

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
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  orderDate: string;
  status: 'pending' | 'picked' | 'shipped' | 'cancelled';
  area?: string; // For shipping company
  notes?: string;
  items?: OrderItem[];
}

const PickList = ({ order }: { order: Order }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
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
  const [showShippingCompanyDialog, setShowShippingCompanyDialog] = useState(false);
  const [selectedShippingCompany, setSelectedShippingCompany] = useState('');
  const [pendingLabelGeneration, setPendingLabelGeneration] = useState<{boxCount: number} | null>(null);
  const [showOutOfStockDialog, setShowOutOfStockDialog] = useState(false);
  const [outOfStockItem, setOutOfStockItem] = useState<{itemId: number, productName: string} | null>(null);
  const [newShippingCompany, setNewShippingCompany] = useState('');
  const [customerCurrentShippingCompany, setCustomerCurrentShippingCompany] = useState('');

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const { data: shippingCompanies = [] } = useQuery<string[]>({
    queryKey: ['/api/shipping-companies'],
  });

  // Mutation to update customer shipping company
  const updateCustomerShippingMutation = useMutation({
    mutationFn: async ({ customerId, shippingCompany }: { customerId: number; shippingCompany: string }) => {
      return apiRequest({
        url: `/api/customers/${customerId}/shipping-company`,
        method: 'PUT',
        body: JSON.stringify({ shippingCompany }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({
        title: 'Shipping Company Updated',
        description: 'Customer shipping preference has been updated for future orders.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update shipping company',
        variant: 'destructive',
      });
    },
  });

  // Initialize actual quantities and prepare order items when order changes
  useEffect(() => {
    if (order.items && order.items.length > 0) {
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
      
      // Create order items with products (product data is already included in order.items from server)
      const itemsWithProducts = order.items.map(item => {
        return {
          ...item,
          picked: !!pickedItems[item.id],
          actualQuantity: newQuantities[item.id] || item.quantity
        };
      });
      setOrderItemsWithProducts(itemsWithProducts);
    }
  }, [order.items, pickedItems]);

  // Initialize shipping company selection with customer's current preference
  useEffect(() => {
    if (showShippingCompanyDialog && order.customerName) {
      const fetchCustomerShippingInfo = async () => {
        try {
          const response = await fetch(`/api/shipping/customer/${encodeURIComponent(order.customerName)}`);
          if (response.ok) {
            const customer = await response.json();
            if (customer) {
              // Determine current shipping company preference
              let currentShippingCompany = '';
              if (customer.preferredShippingCompany === 'other' && customer.billingCompany) {
                currentShippingCompany = customer.billingCompany;
                setSelectedShippingCompany(customer.billingCompany);
              } else if (customer.shippingCompany) {
                currentShippingCompany = customer.shippingCompany;
                setSelectedShippingCompany(customer.shippingCompany);
              } else if (customer.preferredShippingCompany && customer.preferredShippingCompany !== 'other') {
                currentShippingCompany = customer.preferredShippingCompany;
                setSelectedShippingCompany(customer.preferredShippingCompany);
              }
              
              // Set the current shipping company for display
              setCustomerCurrentShippingCompany(currentShippingCompany);
              console.log('Set customer current shipping company:', currentShippingCompany);
            }
          }
        } catch (error) {
          console.warn('Failed to fetch customer shipping info:', error);
        }
      };
      
      fetchCustomerShippingInfo();
    }
  }, [showShippingCompanyDialog, order.customerName]);

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
          itemQuantities: itemQuantities,
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
        title: t('orderPickingPage.orderStatusUpdated'),
        description: hasPartialFulfillment 
          ? t('orderPickingPage.partialOrderApproved')
          : t('orderPickingPage.orderMarkedAsPicked'),
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
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleItemPick = (itemId: number) => {
    setPickedItems(prev => {
      const newState = { ...prev, [itemId]: !prev[itemId] };
      
      // Store order item ID in localStorage for barcode scanning
      if (newState[itemId]) {
        localStorage.setItem('activeOrderId', order.id.toString());
        localStorage.setItem('activeOrderItemId', itemId.toString());
      }
      
      return newState;
    });
  };
  
  const handleActualQuantityChange = (itemId: number, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      // If setting to 0, show confirmation dialog
      if (numValue === 0) {
        const item = orderItemsWithProducts.find(item => item.id === itemId);
        if (item && item.product) {
          setOutOfStockItem({
            itemId: itemId,
            productName: item.product.name
          });
          setShowOutOfStockDialog(true);
          return; // Don't set the value yet, wait for confirmation
        }
      }
      
      // Update the actual quantities state
      setActualQuantities(prev => ({
        ...prev,
        [itemId]: numValue
      }));
      
      // Auto-check the item if quantity is set
      if (numValue >= 0) {
        setPickedItems(prev => ({
          ...prev,
          [itemId]: true
        }));
      }
    }
  };

  // Handle out of stock confirmation
  const handleOutOfStockConfirm = () => {
    if (outOfStockItem) {
      setActualQuantities(prev => ({
        ...prev,
        [outOfStockItem.itemId]: 0
      }));
      
      // Auto-check the item
      setPickedItems(prev => ({
        ...prev,
        [outOfStockItem.itemId]: true
      }));
    }
    
    setShowOutOfStockDialog(false);
    setOutOfStockItem(null);
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
      // Store box count and show shipping company selection dialog
      setPendingLabelGeneration({ boxCount });
      setShowShippingCompanyDialog(true);
    } else {
      // Show toast if skipping
      toast({
        title: t('orderPickingPage.labelsSkipped'),
        description: t('orderPickingPage.skipLabelsDescription'),
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

  // Handle shipping company selection and proceed with label generation
  const handleShippingCompanySelected = async () => {
    const companyToUse = newShippingCompany.trim() || selectedShippingCompany;
    
    if (!companyToUse || !pendingLabelGeneration) {
      toast({
        title: 'Σφάλμα',
        description: 'Παρακαλώ επιλέξτε ή εισάγετε εταιρεία αποστολής',
        variant: 'destructive',
      });
      return;
    }

    // Get customer ID from order and update shipping preference
    try {
      const response = await fetch(`/api/shipping/customer/${encodeURIComponent(order.customerName)}`);
      if (response.ok) {
        const customer = await response.json();
        if (customer) {
          // Update customer's shipping company preference using custom field priority
          await updateCustomerShippingMutation.mutateAsync({
            customerId: customer.id,
            shippingCompany: companyToUse,
          });
        }
      }
    } catch (error) {
      console.warn('Failed to update customer shipping preference:', error);
    }

    // Generate labels with the selected shipping company
    await generateShippingLabelsWithCompany(order, pendingLabelGeneration.boxCount, companyToUse);
    
    // Clean up state
    setShowShippingCompanyDialog(false);
    setPendingLabelGeneration(null);
    setSelectedShippingCompany('');
    setNewShippingCompany('');
    setCustomerCurrentShippingCompany('');
  };
  
  // State to manage label preview
  const [showLabelPreview, setShowLabelPreview] = useState(false);
  const [labelPreviewData, setLabelPreviewData] = useState<{
    content: string;
    boxNumber: number;
    totalBoxes: number;
  } | null>(null);
  
  // Function to generate shipping labels with custom shipping company
  const generateShippingLabelsWithCompany = async (order: Order, boxCount: number, customShippingCompany?: string) => {
    // Only proceed if we have a valid box count from user input
    if (boxCount < 1) {
      toast({
        title: t('common.error'),
        description: t('orderPickingPage.boxCountError'),
        variant: "destructive"
      });
      return;
    }
    
    // Log the exact user-specified box count to ensure it's being used
    console.log(`Using user-specified box count: ${boxCount} with custom shipping company: ${customShippingCompany}`);
    
    // Create the JScript commands for the CAB EOS1 printer with all requested customer information
    const createLabelJScript = async (boxNumber: number, totalBoxes: number): Promise<string> => {
      // Get essential information
      const formattedDate = new Date(order.orderDate).toLocaleDateString();
      
      // Get the real customer information for this order using the dedicated endpoint
      let customerAddress = "";
      let customerPhone = "";
      let shippingCompany = customShippingCompany || "N/A"; // Use provided shipping company first
      
      try {
        // Using our new dedicated endpoint to get customer information for shipping labels
        const response = await fetch(`/api/shipping/customer/${encodeURIComponent(order.customerName)}`);
        
        if (response.ok) {
          const customer = await response.json();
          
          if (customer) {
            // Format the complete address from customer data parts
            const addressParts = [
              customer.address,
              customer.city,
              customer.postalCode,
              customer.country
            ].filter(Boolean); // Remove empty parts
            
            customerAddress = addressParts.join(", ");
            customerPhone = customer.phone || "";
            
            // Use custom shipping company if provided, otherwise use customer's current computed company
            if (!customShippingCompany) {
              shippingCompany = customer.currentShippingCompany || "N/A";
            }
            
            console.log("Debug shipping company:", {
              customShippingCompany,
              currentShippingCompany: customer.currentShippingCompany,
              finalValue: shippingCompany
            });
            
            console.log(`Found customer data for shipping label: ${customer.name}, Shipping: ${shippingCompany}`);
          }
        } else {
          console.log("No customer data found for shipping label. Using order name only.");
        }
      } catch (error) {
        console.error("Error fetching customer details for shipping label:", error);
      }
      
      // Based on CAB EOS manual - JScript programming language for CAB printer
      return `
m m
J
H 100,0,T
S l1;0,0,68,71,100

; Using T command to create text label instead of GI for image (which isn't working)
T 25,10,0,3,pt14,b;OLIVE OIL COMPANY

; Order number - very prominent
T 10,40,0,3,pt14,b;Order: ${order.orderNumber}

; Customer information section - as requested
T 10,65,0,3,pt12,b;Customer: ${order.customerName}
T 10,85,0,3,pt10;Address: ${customerAddress}
T 10,105,0,3,pt10;Phone: ${customerPhone}

; Shipping company - very important information
T 10,130,0,3,pt13,b;Shipping: ${shippingCompany}

; Box information - clearly visible
T 10,160,0,3,pt16,b;BOX ${boxNumber} OF ${totalBoxes}

; Print command
A 1
`;
    };
    
    try {
      // Show preview of the first label - properly handle async
      const firstLabelContent = await createLabelJScript(1, boxCount);
      
      // Set preview data and show preview dialog
      setLabelPreviewData({
        content: firstLabelContent,
        boxNumber: 1,
        totalBoxes: boxCount
      });
      setShowLabelPreview(true);
      
    } catch (error: any) {
      console.error('Label generation error:', error);
      toast({
        title: 'Σφάλμα Δημιουργίας Ετικετών',
        description: error.message || 'Αποτυχία δημιουργίας ετικετών αποστολής',
        variant: "destructive"
      });
    }
  };

  // Original function to generate shipping labels (kept for backward compatibility)
  const generateShippingLabels = async (order: Order, boxCount: number) => {
    await generateShippingLabelsWithCompany(order, boxCount);
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
        title: t('orderPickingPage.itemScanned'),
        description: `${orderItem.product?.name} ${t('orderPickingPage.itemMarkedAsPicked')}`,
      });
    } else if (!orderItem) {
      toast({
        title: t('orderPickingPage.barcodeNotFound'),
        description: t('orderPickingPage.noMatchingProduct'),
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

  // Check if all items are picked (or processed with 0 quantity)
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
    <TooltipProvider>
      {/* Shipping Label Preview Dialog */}
      {labelPreviewData && (
        <ShippingLabelPreview
          open={showLabelPreview}
          onOpenChange={setShowLabelPreview}
          labelContent={labelPreviewData.content}
          orderId={order.id}
          orderNumber={order.orderNumber}
          boxNumber={labelPreviewData.boxNumber}
          totalBoxes={labelPreviewData.totalBoxes}
        />
      )}
      
      {/* Approval Dialog for Partial Fulfillment */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('orderPickingPage.pickList.approvalRequired')}</DialogTitle>
            <DialogDescription>
              {t('orderPickingPage.pickList.approvalDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Alert variant="destructive" className="mb-4">
              <AlertTitle className="flex items-center">
                <span className="bg-red-100 p-1 rounded-full mr-2">
                  <Info className="h-4 w-4 text-red-600" />
                </span>
                {t('orderPickingPage.pickList.insufficientStock')}
              </AlertTitle>
              <AlertDescription>
                {t('orderPickingPage.pickList.insufficientStockDescription')}
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="approval-notes" className="text-sm font-medium">
                  {t('orderPickingPage.pickList.notesForApproval')}
                </Label>
                <textarea 
                  id="approval-notes"
                  className="w-full mt-1 p-2 border rounded-md"
                  rows={3}
                  placeholder={t('orderPickingPage.pickList.notesPlaceholder')}
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
              {t('orderPickingPage.pickList.cancel')}
            </Button>
            
            {/* Only show this button if current user is admin or manager */}
            {(user?.role === 'admin' || user?.role === 'manager') ? (
              <Button 
                type="submit"
                onClick={handleApprovePartialFulfillment}
                disabled={updateOrderStatusMutation.isPending}
              >
                {updateOrderStatusMutation.isPending ? t('orderPickingPage.pickList.approving') : t('orderPickingPage.pickList.approvePartialFulfillment')}
              </Button>
            ) : (
              <div className="text-sm text-slate-500 italic">
                {t('orderPickingPage.pickList.contactManager')}
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shipping Company Selection Dialog */}
      <Dialog open={showShippingCompanyDialog} onOpenChange={setShowShippingCompanyDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Επιλογή Εταιρείας Αποστολής</DialogTitle>
            <DialogDescription>
              Επιλέξτε την εταιρεία αποστολής για αυτή την παραγγελία. Θα ενημερωθεί η προτίμηση του πελάτη για μελλοντικές παραγγελίες.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-4">
              {/* Show current customer shipping company */}
              <div className="bg-blue-50 p-3 rounded-md">
                <div className="text-sm font-medium text-blue-800">
                  Τρέχουσα εταιρεία πελάτη: <span className="font-bold">{customerCurrentShippingCompany || 'Δεν έχει οριστεί'}</span>
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Πελάτης: {order.customerName}
                </div>
              </div>
              
              <div>
                <Label htmlFor="shipping-company" className="text-sm font-medium">
                  Επιλογή Εταιρείας Αποστολής
                </Label>
                <select
                  id="shipping-company"
                  className="w-full mt-1 p-2 border rounded-md"
                  value={selectedShippingCompany}
                  onChange={(e) => setSelectedShippingCompany(e.target.value)}
                >
                  <option value="">Επιλέξτε εταιρεία αποστολής...</option>
                  {customerCurrentShippingCompany && (
                    <option value={customerCurrentShippingCompany} className="font-bold bg-blue-100">
                      {customerCurrentShippingCompany} (Τρέχουσα προτίμηση)
                    </option>
                  )}
                  {shippingCompanies
                    .filter(company => company !== customerCurrentShippingCompany)
                    .map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-4">
                <Label htmlFor="new-shipping-company" className="text-sm font-medium">
                  Ή προσθέστε νέα εταιρεία:
                </Label>
                <Input
                  id="new-shipping-company"
                  placeholder="Όνομα νέας εταιρείας αποστολής"
                  value={newShippingCompany}
                  onChange={(e) => setNewShippingCompany(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              {(selectedShippingCompany || newShippingCompany.trim()) && (
                <div className="text-sm text-slate-600 bg-blue-50 p-3 rounded-md">
                  Η εταιρεία <strong>{newShippingCompany.trim() || selectedShippingCompany}</strong> θα αποθηκευτεί ως προτιμώμενη εταιρεία αποστολής για μελλοντικές παραγγελίες.
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowShippingCompanyDialog(false);
                setPendingLabelGeneration(null);
                setSelectedShippingCompany('');
                setNewShippingCompany('');
                setCustomerCurrentShippingCompany('');
              }}
            >
              Ακύρωση
            </Button>
            
            <Button 
              type="submit"
              onClick={handleShippingCompanySelected}
              disabled={(!selectedShippingCompany && !newShippingCompany.trim()) || updateCustomerShippingMutation.isPending}
            >
              {updateCustomerShippingMutation.isPending ? 'Ενημέρωση...' : 'Δημιουργία Ετικετών'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <div className="flex items-center">
              <Truck className="h-5 w-5 mr-2 text-blue-500" />
              <span>{t('orderPickingPage.pickList.title')}: {order.orderNumber}</span>
            </div>
            <Badge variant={order.status === 'pending' ? "default" : "outline"} className={order.status !== 'pending' ? "border-green-500 text-green-700 bg-green-50" : ""}>
              {order.status === 'pending' ? t('orderPickingPage.pickList.pending') : t('orderPickingPage.pickList.picked')}
            </Badge>
          </CardTitle>
          <CardDescription>
            {t('orderPickingPage.pickList.customer')}: {order.customerName} | {t('orderPickingPage.pickList.orderDate')}: {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}
          </CardDescription>
        </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <div className="flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-1 text-slate-500" />
              <span className="text-sm font-medium">{t('orderPickingPage.pickList.pickingProgress')}</span>
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
              {t('orderPickingPage.pickList.allItemsPicked')}
            </p>
          )}
        </div>
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1">
            <div className="relative">
              <Input
                placeholder={t('orderPickingPage.pickList.searchPlaceholder')}
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
              {t('orderPickingPage.pickList.sortByLocation')}
            </Button>
            
            <EnhancedBarcodeScanner 
              onBarcodeScanned={(barcode, mode) => {
                // Store order ID in localStorage for enhanced scanner integration
                localStorage.setItem('activeOrderId', order.id.toString());
                
                // Process the barcode scan
                const product = products.find(p => 
                  p.barcode === barcode || p.sku === barcode
                );
                
                if (!product) {
                  toast({
                    title: t("orders.pickList.barcodeNotFound"),
                    description: `${barcode}`,
                    variant: "destructive"
                  });
                  return;
                }
                
                // Find the order item that uses this product
                const orderItem = orderItemsWithProducts.find(
                  item => item.productId === product.id
                );
                
                if (!orderItem) {
                  toast({
                    title: t("orders.pickList.productNotInOrder"),
                    description: product.name,
                    variant: "destructive"
                  });
                  return;
                }
                
                // Store the specific order item ID for the barcode API
                localStorage.setItem('activeOrderItemId', orderItem.id.toString());
                
                // Mark this item as picked
                handleItemPick(orderItem.id);
                
                // Update scanned barcode UI indicator
                setLastScannedBarcode(barcode);
                
                toast({
                  title: t("orders.pickList.itemPicked"),
                  description: product.name,
                });
              }}
              buttonText={t("scanner.scanProduct")}
              buttonVariant="outline"
              buttonSize="sm"
              modalTitle={t("scanner.scanProduct")}
              initialMode="picking"
            />
          </div>
        </div>
        
        {/* Last scanned barcode notification */}
        {lastScannedBarcode && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center mb-1">
              <ScanBarcode className="h-4 w-4 mr-2 text-blue-500" />
              <p className="text-sm font-medium text-blue-700">{t('orderPickingPage.pickList.barcodeScanned')}</p>
            </div>
            <p className="text-sm text-blue-600">
              {t('orderPickingPage.pickList.lastScanned')}: <span className="font-mono font-medium">{lastScannedBarcode}</span>
            </p>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">{t('orderPickingPage.pickList.picked')}</TableHead>
              <TableHead>{t('orderPickingPage.pickList.sku')}</TableHead>
              <TableHead>{t('orderPickingPage.pickList.product')}</TableHead>
              <TableHead>{t('orderPickingPage.pickList.location')}</TableHead>
              <TableHead className="text-right">{t('orderPickingPage.pickList.requested')}</TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {t('orderPickingPage.pickList.actualShipped')}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-slate-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-48">{t('orderPickingPage.pickList.zeroQuantityHelp')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
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
                  <div className="font-medium flex items-center gap-2">
                    {item.product?.name || t('orderPickingPage.pickList.unknownProduct')}
                    {actualQuantities[item.id] === 0 && (
                      <div className="rounded-full bg-orange-100 p-1">
                        <AlertTriangle className="h-3 w-3 text-orange-600" />
                      </div>
                    )}
                  </div>
                  {item.product?.currentStock !== undefined && item.product.currentStock < item.quantity && (
                    <div className="flex items-center mt-1">
                      <div className="rounded-full bg-red-100 p-1 mr-1">
                        <Info className="h-3 w-3 text-red-500" />
                      </div>
                      <span className="text-xs text-red-500">
                        {t('orderPickingPage.pickList.lowStock')}: {item.product?.currentStock} {t('orderPickingPage.pickList.of')} {item.quantity} {t('orderPickingPage.pickList.needed')}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {item.product?.location || (
                    <>
                      {item.product?.category === "widgets" && t('orderPickingPage.pickList.aisleA')}
                      {item.product?.category === "connectors" && t('orderPickingPage.pickList.aisleB')}
                      {item.product?.category === "default" && t('orderPickingPage.pickList.aisleA')}
                      {item.product?.location || t('orderPickingPage.pickList.warehouse')}
                      {item.product?.category === "other" && t('orderPickingPage.pickList.aisleE')}
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
                      value={actualQuantities[item.id] !== undefined ? actualQuantities[item.id] : item.quantity}
                      onChange={(e) => handleActualQuantityChange(item.id, e.target.value)}
                      disabled={order.status !== 'pending'}
                      className="w-20 text-right p-2 border rounded"
                      aria-label={`${t('orderPickingPage.pickList.actualQuantityFor')} ${item.product?.name}`}
                    />
                    {actualQuantities[item.id] !== undefined && actualQuantities[item.id] !== item.quantity && pickedItems[item.id] && (
                      <div className="text-xs text-amber-600 mt-1 text-right">
                        {actualQuantities[item.id] === 0 ? 
                          t('orderPickingPage.pickList.outOfStock') : 
                          `${t('orderPickingPage.pickList.missing')}: ${item.quantity - actualQuantities[item.id]}`
                        }
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
              <p className="text-sm font-medium">{t('orderPickingPage.pickList.orderNotes')}:</p>
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
            {t('orderPickingPage.pickList.resetPickedItems')}
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
            {t('orderPickingPage.pickList.markAllPicked')}
          </Button>
        </div>
        
        <Button 
          onClick={completePickList} 
          disabled={!allItemsPicked || order.status !== 'pending' || updateOrderStatusMutation.isPending}
          className="w-full sm:w-auto text-base py-6 px-8 font-medium"
          size="lg"
        >
          {updateOrderStatusMutation.isPending ? (
            t('orderPickingPage.pickList.updating')
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-5 w-5" />
              {t('orderPickingPage.pickList.completePickList')}
              {allItemsPicked && order.status === 'pending' && (
                <span className="ml-1">({order.items?.length} {t('orderPickingPage.pickList.items')})</span>
              )}
            </>
          )}
        </Button>
      </CardFooter>

      {/* Box Count Dialog */}
      <Dialog open={showBoxCountDialog} onOpenChange={setShowBoxCountDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-base">
              <PackageCheck className="mr-2 h-5 w-5 text-blue-500 flex-shrink-0" />
              <span className="truncate">{t('orderPickingPage.pickList.boxCountForLabels')}</span>
            </DialogTitle>
            <DialogDescription className="text-sm">
              {t('orderPickingPage.pickList.boxCountDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="boxCount" className="text-sm">{t('orderPickingPage.pickList.numberOfBoxes')}</Label>
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
                  <Printer className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0" />
                  <p className="text-sm font-medium text-blue-700 truncate">{t('orderPickingPage.pickList.labelPreview')}</p>
                </div>
                <p className="text-sm text-blue-600">
                  {t('orderPickingPage.pickList.labelPreviewDescription')}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowBoxCountDialog(false)}
            >
              {t('orderPickingPage.pickList.cancel')}
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="secondary"
                onClick={(e) => {
                  e.preventDefault();
                  handleCompleteWithBoxCount(true);
                }} 
                disabled={updateOrderStatusMutation.isPending}
                className="text-sm"
              >
                {updateOrderStatusMutation.isPending ? t('orderPickingPage.pickList.processing') : t('orderPickingPage.pickList.skipPrinting')}
              </Button>
              <Button 
                onClick={(e) => {
                  e.preventDefault();
                  handleCompleteWithBoxCount(false);
                }} 
                disabled={boxCount < 1 || updateOrderStatusMutation.isPending}
                className="text-sm"
              >
                {updateOrderStatusMutation.isPending ? t('orderPickingPage.pickList.processing') : t('orderPickingPage.pickList.printLabels')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Out of Stock Confirmation Dialog */}
      <Dialog open={showOutOfStockDialog} onOpenChange={setShowOutOfStockDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-orange-600" />
              Επιβεβαίωση Έλλειψης Αποθέματος
            </DialogTitle>
            <DialogDescription>
              Είστε βέβαιοι ότι θέλετε να σημειώσετε αυτό το προϊόν ως μη διαθέσιμο (0 ποσότητα);
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Alert variant="default" className="mb-4 border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-800">
                Σήμανση ως Έλλειψη Αποθέματος
              </AlertTitle>
              <AlertDescription className="text-orange-700">
                <strong>{outOfStockItem?.productName}</strong> θα προστεθεί στις εκκρεμείς παραγγελίες
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowOutOfStockDialog(false);
                setOutOfStockItem(null);
              }}
            >
              Ακύρωση
            </Button>
            
            <Button 
              type="submit"
              onClick={handleOutOfStockConfirm}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Επιβεβαίωση Έλλειψης
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
    </TooltipProvider>
  );
};

export default PickList;