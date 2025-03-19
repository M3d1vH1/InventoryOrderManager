import { useEffect, useState, useRef } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { 
  Eye, Edit, ClipboardCheck, 
  Truck, CheckSquare, AlertTriangle,
  Upload, FileText, FilePlus
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Label
} from "@/components/ui/label";
import OrderForm from "@/components/orders/OrderForm";

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  description?: string;
  minStockLevel: number;
  currentStock: number;
  location?: string;
  unitsPerBox?: number;
}

interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  product?: Product;
}

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  orderDate: string;
  status: 'pending' | 'picked' | 'shipped' | 'cancelled';
  notes?: string;
  items?: OrderItem[];
  hasShippingDocument?: boolean;
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'picked':
      return 'bg-blue-100 text-blue-800';
    case 'shipped':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
};

const Orders = () => {
  const { setCurrentPage } = useSidebar();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Document upload state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [orderToShip, setOrderToShip] = useState<Order | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('T△A document');
  const [documentNotes, setDocumentNotes] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [updateStatusOnUpload, setUpdateStatusOnUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      return apiRequest({
        url: `/api/orders/${orderId}/status`,
        method: 'PATCH',
        body: JSON.stringify({ status }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Order status updated",
        description: "The order status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update order status",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    setCurrentPage("Orders");
    
    // Check URL parameters for filters
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get("status");
    if (statusParam && ["pending", "picked", "shipped", "cancelled"].includes(statusParam)) {
      setStatusFilter(statusParam);
    }
  }, [setCurrentPage]);

  const filteredOrders = orders?.filter(order => {
    const matchesSearch = searchTerm === "" || 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Fetch specific order details with product details
  const { data: orderDetails, isLoading: isOrderDetailsLoading } = useQuery<Order>({
    queryKey: ['/api/orders', selectedOrder?.id],
    enabled: !!selectedOrder,
    queryFn: async () => {
      const response = await apiRequest({
        url: `/api/orders/${selectedOrder?.id}`,
      });
      
      // If order has items, fetch product details for each item
      if (response.items && response.items.length > 0) {
        const itemsWithProducts = await Promise.all(
          response.items.map(async (item: OrderItem) => {
            try {
              const productData = await apiRequest<Product>({
                url: `/api/products/${item.productId}`,
              });
              return { ...item, product: productData };
            } catch (error) {
              console.error(`Failed to fetch product ${item.productId}:`, error);
              return item;
            }
          })
        );
        
        return { ...response, items: itemsWithProducts };
      }
      
      return response;
    },
  });

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ 
      orderId, 
      file, 
      documentType, 
      notes,
      updateStatus 
    }: { 
      orderId: number; 
      file: File; 
      documentType: string; 
      notes?: string;
      updateStatus: boolean;
    }) => {
      setIsUploading(true);
      
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', documentType);
      formData.append('updateStatus', updateStatus.toString());
      if (notes) formData.append('notes', notes);
      
      return apiRequest({
        url: `/api/orders/${orderId}/documents`,
        method: 'POST',
        body: formData,
        // Don't set Content-Type header, browser will set it with boundary for FormData
      });
    },
    onSuccess: (data, variables) => {
      setIsUploading(false);
      setShowUploadDialog(false);
      setDocumentFile(null);
      
      // Only update the status if the user checked the option
      if (variables.updateStatus) {
        toast({
          title: "Document uploaded",
          description: "The TΔA document has been attached and order is being shipped.",
        });
      } else {
        toast({
          title: "Document uploaded",
          description: "The TΔA document has been attached to the order.",
        });
        
        // Make sure to refresh order data to show document is attached
        queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      }
    },
    onError: (error) => {
      setIsUploading(false);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleStatusChange = (orderId: number, newStatus: string) => {
    // If changing to shipped status, we need to check/upload TΔA document first
    if (newStatus === 'shipped') {
      const order = orders?.find(o => o.id === orderId);
      if (order) {
        if (order.hasShippingDocument) {
          // Document already exists, just update status
          updateStatusMutation.mutate({ orderId, status: newStatus as 'shipped' });
        } else {
          // Show document upload dialog
          setOrderToShip(order);
          setShowUploadDialog(true);
          return; // Don't update status yet
        }
      }
    } else {
      // For other statuses, just update normally
      updateStatusMutation.mutate({ 
        orderId, 
        status: newStatus as 'pending' | 'picked' | 'shipped' | 'cancelled' 
      });
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDocumentFile(e.target.files[0]);
    }
  };
  
  const handleUploadDocument = () => {
    if (!orderToShip || !documentFile) return;
    
    uploadDocumentMutation.mutate({
      orderId: orderToShip.id,
      file: documentFile,
      documentType,
      notes: documentNotes,
      updateStatus: updateStatusOnUpload
    });
  };
  
  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsEditMode(false);
  };
  
  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsEditMode(true);
  };
  
  const handleCloseDialog = () => {
    setSelectedOrder(null);
    setIsEditMode(false);
  };
  
  const handleGoToPickList = (orderId: number) => {
    setLocation(`/order-picking/${orderId}`);
  };
  
  // Handler for viewing document
  const handleViewDocument = async (orderId: number) => {
    try {
      const document = await apiRequest({
        url: `/api/orders/${orderId}/documents`,
      });
      
      if (document && document.documentPath) {
        // Open document in a new tab
        window.open(document.documentPath, '_blank');
      } else {
        toast({
          title: "Document not found",
          description: "The document could not be found.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error loading document",
        description: error.message || "Failed to load the document",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-lg">Order Management</h2>
          <Button onClick={() => setShowOrderForm(!showOrderForm)}>
            {showOrderForm ? "Hide Form" : "Create New Order"}
          </Button>
        </div>

        {showOrderForm && (
          <div className="p-4 border-b border-slate-200">
            <OrderForm />
          </div>
        )}

        <div className="p-4 flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex flex-col md:flex-row gap-2 flex-1">
            <div className="relative w-full md:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <i className="fas fa-search text-slate-400"></i>
              </span>
              <Input
                placeholder="Search orders..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="picked">Picked</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading orders...
                  </TableCell>
                </TableRow>
              ) : filteredOrders?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No orders found. {searchTerm || statusFilter ? "Try clearing your filters." : ""}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders?.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.orderNumber}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>{format(new Date(order.orderDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <Select 
                        value={order.status} 
                        onValueChange={(value) => handleStatusChange(order.id, value)}
                      >
                        <SelectTrigger className={`w-32 h-7 px-2 py-0 rounded-full text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="picked">Picked</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{order.items?.length || 0}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleViewOrder(order)}
                          className="text-slate-600 hover:text-primary p-1 rounded-full hover:bg-slate-100" 
                          title="View Order Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleEditOrder(order)}
                          className="text-slate-600 hover:text-primary p-1 rounded-full hover:bg-slate-100" 
                          title="Edit Order"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleGoToPickList(order.id)}
                            className="text-slate-600 hover:text-green-600 p-1 rounded-full hover:bg-slate-100" 
                            title="Pick Order"
                          >
                            <ClipboardCheck className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* Document view button - only for shipped orders with document */}
                        {order.status === 'shipped' && order.hasShippingDocument && (
                          <button
                            onClick={() => handleViewDocument(order.id)}
                            className="text-slate-600 hover:text-blue-600 p-1 rounded-full hover:bg-slate-100" 
                            title="View TΔA Document"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="p-4 border-t border-slate-200 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">
              {isLoading ? "Loading..." : filteredOrders ? `Showing ${filteredOrders.length} of ${orders?.length} orders` : "No orders found"}
            </span>
            <div className="flex items-center space-x-1">
              <button className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled>
                <i className="fas fa-chevron-left"></i>
              </button>
              <button className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled>
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit Order" : "Order Details"}
              {selectedOrder && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({selectedOrder.orderNumber})
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {isEditMode 
                ? "Update the order information below."
                : "View the complete details of this order."}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && orderDetails && (
            <div className="space-y-4">
              {!isEditMode ? (
                // View mode
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-slate-500">Customer</h3>
                      <p className="text-lg font-medium">{orderDetails.customerName}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-500">Order Date</h3>
                      <p className="text-lg font-medium">
                        {format(new Date(orderDetails.orderDate), "MMMM d, yyyy")}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-500">Status</h3>
                      <div className={`inline-block px-2.5 py-0.5 rounded-full text-sm font-medium ${getStatusBadgeClass(orderDetails.status)}`}>
                        {orderDetails.status.charAt(0).toUpperCase() + orderDetails.status.slice(1)}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-500">Total Items</h3>
                      <p className="text-lg font-medium">{orderDetails.items?.length || 0}</p>
                    </div>
                  </div>

                  {orderDetails.notes && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-500">Notes</h3>
                      <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                        {orderDetails.notes}
                      </p>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-medium text-slate-500 mb-2">Order Items</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Location</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isOrderDetailsLoading ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-4">
                                Loading order items...
                              </TableCell>
                            </TableRow>
                          ) : orderDetails.items && orderDetails.items.length > 0 ? (
                            orderDetails.items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                  {item.product ? item.product.name : `Product #${item.productId}`}
                                </TableCell>
                                <TableCell>
                                  {item.product ? item.product.sku : "N/A"}
                                </TableCell>
                                <TableCell>
                                  <span className="font-medium">{item.quantity}</span>
                                  {item.product?.unitsPerBox && (
                                    <span className="text-xs text-slate-500 ml-1">
                                      ({Math.ceil(item.quantity / item.product.unitsPerBox)} box{Math.ceil(item.quantity / item.product.unitsPerBox) !== 1 ? 'es' : ''})
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.product?.location || "Not specified"}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center">
                                No items found in this order.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : (
                // Edit mode with OrderForm
                <OrderForm 
                  initialData={orderDetails}
                  isEditMode={true}
                  onCancel={handleCloseDialog}
                  onSuccess={handleCloseDialog}
                />
              )}
              
              <DialogFooter className="flex justify-between sm:justify-between gap-2">
                {!isEditMode && (
                  <>
                    <div className="flex gap-2">
                      {orderDetails.status === 'pending' && (
                        <Button
                          onClick={() => handleGoToPickList(orderDetails.id)}
                          variant="secondary"
                          className="flex items-center gap-2"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          <span>Pick Order</span>
                        </Button>
                      )}
                      
                      <Button
                        onClick={() => setIsEditMode(true)}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        <span>Edit</span>
                      </Button>
                      
                      {/* Document view button in dialog */}
                      {orderDetails.status === 'shipped' && orderDetails.hasShippingDocument && (
                        <Button
                          onClick={() => handleViewDocument(orderDetails.id)}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          <span>View TΔA</span>
                        </Button>
                      )}
                    </div>
                    
                    <Button onClick={handleCloseDialog}>
                      Close
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Document Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => {
        setShowUploadDialog(open);
        if (!open) {
          setOrderToShip(null);
          setDocumentFile(null);
          setDocumentNotes('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Upload TΔA Document
              {orderToShip && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({orderToShip.orderNumber})
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              A TΔA document is required before this order can be shipped.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="documentType">Document Type</Label>
              <Select 
                value={documentType} 
                onValueChange={setDocumentType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="T△A document">T△A document</SelectItem>
                  <SelectItem value="Invoice">Invoice</SelectItem>
                  <SelectItem value="Custom declaration">Custom declaration</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="document">Document File</Label>
              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full justify-start text-left font-normal"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {documentFile ? documentFile.name : "Select file..."}
                </Button>
                {documentFile && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setDocumentFile(null)}
                  >
                    <span className="sr-only">Remove file</span>
                    <AlertTriangle className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                id="document"
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
              <p className="text-xs text-slate-500">
                Accepted formats: PDF, DOC, DOCX, JPG, JPEG, PNG
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional information about this document..."
                value={documentNotes}
                onChange={(e) => setDocumentNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            
            <div className="flex items-center space-x-2 mt-4">
              <input
                type="checkbox"
                id="updateStatus"
                checked={updateStatusOnUpload}
                onChange={(e) => setUpdateStatusOnUpload(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="updateStatus" className="text-sm font-medium text-gray-700">
                Change order status to 'Shipped' after upload
              </label>
            </div>
          </div>
          
          <DialogFooter className="flex justify-between sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowUploadDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUploadDocument}
              disabled={!documentFile || isUploading}
            >
              {isUploading ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Uploading...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {updateStatusOnUpload ? 'Upload & Ship Order' : 'Upload Document'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;
