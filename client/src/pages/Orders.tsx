import { useEffect, useState, useRef } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation, useRoute, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { 
  Eye, Edit, ClipboardCheck, 
  Truck, CheckSquare, AlertTriangle,
  Upload, FileText, FilePlus, FileInput
} from "lucide-react";
import { OrderChangelog } from "@/components/orders/OrderChangelog";

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
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Check if we're on a view or edit route
  const [isViewRoute, viewParams] = useRoute('/orders/:id');
  const [isEditRoute, editParams] = useRoute('/orders/:id/edit');
  const params = isViewRoute ? viewParams : editParams;
  
  // Document upload state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [orderToShip, setOrderToShip] = useState<Order | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('T△A document');
  const [documentNotes, setDocumentNotes] = useState<string>('');
  const [updateStatusOnUpload, setUpdateStatusOnUpload] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState(false);
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
  
  // Handle route params for order ID when viewing or editing a specific order
  useEffect(() => {
    if ((isViewRoute || isEditRoute) && params && params.id) {
      // Check if the order ID is a valid number
      const orderId = parseInt(params.id, 10);
      if (!isNaN(orderId) && orders) {
        // Find the order with the matching ID
        const order = orders.find(o => o.id === orderId);
        if (order) {
          setSelectedOrder(order);
          setIsEditMode(isEditRoute); // Set edit mode based on the route
        } else {
          // Order not found - show toast and redirect to orders list
          toast({
            title: "Order not found",
            description: `The order with ID ${orderId} does not exist.`,
            variant: "destructive",
          });
          setLocation("/orders");
        }
      }
    }
  }, [isViewRoute, isEditRoute, params, orders, toast, setLocation]);

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
      
      // Display a warning for large files (over 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Large file detected",
          description: "Uploading large files may take some time. Please wait...",
          // Use default variant instead of warning (which isn't a valid variant)
          duration: 5000,
        });
      }
      
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', documentType);
      formData.append('updateStatus', updateStatus.toString());
      if (notes) formData.append('notes', notes);
      
      try {
        // Make the request for document upload
        const response = await apiRequest({
          url: `/api/orders/${orderId}/documents`,
          method: 'POST',
          body: formData,
          // Don't set Content-Type header, browser will set it with boundary for FormData
        });
        return response;
      } catch (error: any) {
        // Rethrow to be caught by onError
        throw new Error(error.message || 'Upload failed. Please try again.');
      }
    },
    onSuccess: (data, variables) => {
      setIsUploading(false);
      setShowUploadDialog(false);
      setDocumentFile(null);
      setDocumentNotes('');
      
      // Reset the document type to default after successful upload
      setDocumentType('T△A document');
      
      // Only update the status if the user checked the option
      if (variables.updateStatus) {
        toast({
          title: "Document uploaded",
          description: `The ${variables.documentType} has been attached and order is being shipped.`,
        });
      } else {
        toast({
          title: "Document uploaded",
          description: `The ${variables.documentType} has been attached to the order.`,
        });
      }
      
      // Always refresh order data to show document is attached
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      
      // We don't need to play notification sound here as it will come via WebSocket
    },
    onError: (error: any) => {
      setIsUploading(false);
      
      // More user-friendly error messages
      let errorMessage = error?.message || "An unknown error occurred";
      
      // Handle specific error types
      if (errorMessage.includes('Network Error') || errorMessage.includes('timeout')) {
        errorMessage = "Network issue or timeout. The file may be too large or your connection is unstable.";
      } else if (errorMessage.includes('413') || errorMessage.includes('Payload Too Large')) {
        errorMessage = "The file is too large. Please reduce the file size and try again.";
      }
      
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
        duration: 7000, // Show error longer
      });
    }
  });
  
  const handleStatusChange = (orderId: number, newStatus: string) => {
    // Update the order status normally, without requiring document upload
    updateStatusMutation.mutate({ 
      orderId, 
      status: newStatus as 'pending' | 'picked' | 'shipped' | 'cancelled' 
    });
  };
  
  // Function to handle document upload for any order
  const handleOpenDocumentUpload = (order: Order) => {
    setOrderToShip(order);
    setShowUploadDialog(true);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDocumentFile(e.target.files[0]);
    }
  };
  
  const handleSubmitDocument = () => {
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
    // Use setLocation to update the URL for better bookmarking and navigation
    setLocation(`/orders/${order.id}`);
    setSelectedOrder(order);
    setIsEditMode(false);
  };
  
  const handleEditOrder = (order: Order) => {
    // Use setLocation to update the URL for better bookmarking and navigation
    setLocation(`/orders/${order.id}/edit`);
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

  // Handle navigation to unshipped items
  const handleGoToUnshippedItems = () => {
    setLocation('/orders/unshipped-items');
  };

  return (
    <div>
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-lg">{t('orders.management')}</h2>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={handleGoToUnshippedItems}
              className="flex items-center"
            >
              <i className="fas fa-dolly mr-2"></i>
              {t('unshippedItems.sidebarTitle')}
            </Button>
            <Button onClick={() => setShowOrderForm(!showOrderForm)}>
              {showOrderForm ? t('orders.hideForm') : t('orders.createNew')}
            </Button>
          </div>
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
                placeholder={t('orders.searchOrders')}
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={t('orders.filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('orders.allStatuses')}</SelectItem>
                <SelectItem value="pending">{t('orders.status.pending')}</SelectItem>
                <SelectItem value="picked">{t('orders.status.picked')}</SelectItem>
                <SelectItem value="shipped">{t('orders.status.shipped')}</SelectItem>
                <SelectItem value="cancelled">{t('orders.status.cancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('orders.columns.orderId')}</TableHead>
                <TableHead>{t('orders.columns.customer')}</TableHead>
                <TableHead>{t('orders.columns.date')}</TableHead>
                <TableHead>{t('orders.columns.status')}</TableHead>
                <TableHead>{t('orders.columns.items')}</TableHead>
                <TableHead>{t('orders.columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    {t('orders.loadingOrders')}
                  </TableCell>
                </TableRow>
              ) : filteredOrders?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    {t('orders.noOrdersFound')} {searchTerm || statusFilter ? t('orders.tryClearingFilters') : ""}
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
                          <SelectItem value="pending">{t('orders.status.pending')}</SelectItem>
                          <SelectItem value="picked">{t('orders.status.picked')}</SelectItem>
                          <SelectItem value="shipped">{t('orders.status.shipped')}</SelectItem>
                          <SelectItem value="cancelled">{t('orders.status.cancelled')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{order.items?.length || 0}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleViewOrder(order)}
                          className="text-slate-600 hover:text-primary p-1 rounded-full hover:bg-slate-100" 
                          title={t('orders.actions.view')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleEditOrder(order)}
                          className="text-slate-600 hover:text-primary p-1 rounded-full hover:bg-slate-100" 
                          title={t('orders.actions.edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleGoToPickList(order.id)}
                            className="text-slate-600 hover:text-green-600 p-1 rounded-full hover:bg-slate-100" 
                            title={t('orders.actions.pickOrder')}
                          >
                            <ClipboardCheck className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* Upload Document button for any order */}
                        <button
                          onClick={() => handleOpenDocumentUpload(order)}
                          className="text-slate-600 hover:text-blue-600 p-1 rounded-full hover:bg-slate-100" 
                          title={t('orders.actions.uploadDocument')}
                        >
                          <FileInput className="h-4 w-4" />
                        </button>
                        
                        {/* Document view button - for any order with document */}
                        {order.hasShippingDocument && (
                          <button
                            onClick={() => handleViewDocument(order.id)}
                            className="text-slate-600 hover:text-blue-600 p-1 rounded-full hover:bg-slate-100" 
                            title={t('orders.actions.viewDocument')}
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
              {isLoading 
                ? t('orders.loadingOrders') 
                : filteredOrders 
                  ? t('orders.showingOrders', {count: filteredOrders.length, total: orders?.length || 0}) 
                  : t('orders.noOrdersFound')}
            </span>
            <div className="flex items-center space-x-1">
              <button 
                className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50" 
                disabled
                aria-label={t('orders.pagination.previous')}
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              <button 
                className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50" 
                disabled
                aria-label={t('orders.pagination.next')}
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Order Details Dialog */}
      <Dialog 
        open={!!selectedOrder} 
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDialog();
            setLocation('/orders');
          }
        }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? t('orders.editOrder') : t('orders.orderDetails')}
              {selectedOrder && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({selectedOrder.orderNumber})
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {isEditMode 
                ? t('orders.updateOrderInfo')
                : t('orders.viewOrderDetails')}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && orderDetails && (
            <div className="space-y-4">
              {!isEditMode ? (
                // View mode
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-slate-500">{t('orders.details.customer')}</h3>
                      <p className="text-lg font-medium">{orderDetails.customerName}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-500">{t('orders.details.orderDate')}</h3>
                      <p className="text-lg font-medium">
                        {format(new Date(orderDetails.orderDate), "MMMM d, yyyy")}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-500">{t('orders.details.status')}</h3>
                      <div className={`inline-block px-2.5 py-0.5 rounded-full text-sm font-medium ${getStatusBadgeClass(orderDetails.status)}`}>
                        {t(`orders.status.${orderDetails.status}`)}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-500">{t('orders.details.totalItems')}</h3>
                      <p className="text-lg font-medium">{orderDetails.items?.length || 0}</p>
                    </div>
                  </div>

                  {orderDetails.notes && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-500">{t('orders.details.notes')}</h3>
                      <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                        {orderDetails.notes}
                      </p>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-medium text-slate-500 mb-2">{t('orders.details.orderItems')}</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('orders.details.product')}</TableHead>
                            <TableHead>{t('orders.details.sku')}</TableHead>
                            <TableHead>{t('orders.details.quantity')}</TableHead>
                            <TableHead>{t('orders.details.location')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isOrderDetailsLoading ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-4">
                                {t('orders.loadingOrderItems')}
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
                                  {item.product?.location || t('app.notSpecified')}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center">
                                {t('orders.noItemsFound')}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Order Changelog Section */}
                  <div className="mt-8">
                    <h3 className="text-sm font-medium text-slate-500 mb-2">{t('orders.details.changeHistory')}</h3>
                    {selectedOrder && (
                      <OrderChangelog orderId={selectedOrder.id} />
                    )}
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
                          <span>{t('orders.actions.pickOrder')}</span>
                        </Button>
                      )}
                      
                      <Button
                        onClick={() => setIsEditMode(true)}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        <span>{t('orders.actions.edit')}</span>
                      </Button>
                      
                      {/* Document upload button for any order */}
                      <Button
                        onClick={() => handleOpenDocumentUpload(orderDetails)}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <FileInput className="h-4 w-4" />
                        <span>{t('orders.actions.uploadDocument')}</span>
                      </Button>
                      
                      {/* Document view button in dialog - for any order with document */}
                      {orderDetails.hasShippingDocument && (
                        <Button
                          onClick={() => handleViewDocument(orderDetails.id)}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          <span>{t('orders.actions.viewDocument')}</span>
                        </Button>
                      )}
                    </div>
                    
                    <Button onClick={handleCloseDialog}>
                      {t('common.close')}
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
              {t('orders.uploadDocument.title')}
              {orderToShip && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({orderToShip.orderNumber})
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {t('orders.uploadDocument.description')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="documentType">{t('orders.uploadDocument.documentType')}</Label>
              <Select 
                value={documentType} 
                onValueChange={setDocumentType}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('orders.uploadDocument.selectDocumentType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="T△A document">{t('orders.uploadDocument.types.tda')}</SelectItem>
                  <SelectItem value="Invoice">{t('orders.uploadDocument.types.invoice')}</SelectItem>
                  <SelectItem value="Custom declaration">{t('orders.uploadDocument.types.customDeclaration')}</SelectItem>
                  <SelectItem value="Other">{t('orders.uploadDocument.types.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="document">{t('orders.uploadDocument.documentFile')}</Label>
              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full justify-start text-left font-normal"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {documentFile ? documentFile.name : t('orders.uploadDocument.selectFile')}
                </Button>
                {documentFile && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setDocumentFile(null)}
                  >
                    <span className="sr-only">{t('orders.uploadDocument.removeFile')}</span>
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
                {t('orders.uploadDocument.acceptedFormats')}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">{t('orders.uploadDocument.notes')}</Label>
              <Textarea
                id="notes"
                placeholder={t('orders.uploadDocument.notesPlaceholder')}
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
                {t('orders.uploadDocument.changeStatusToShipped')}
              </label>
            </div>
          </div>
          
          <DialogFooter className="flex justify-between sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowUploadDialog(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleSubmitDocument}
              disabled={!documentFile || isUploading}
            >
              {isUploading ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  {t('orders.uploadDocument.uploading')}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {updateStatusOnUpload ? t('orders.uploadDocument.uploadAndShip') : t('orders.uploadDocument.uploadOnly')}
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
