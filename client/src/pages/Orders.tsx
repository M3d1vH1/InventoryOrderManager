import { useEffect, useState, useRef } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation, useRoute, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { 
  Eye, Edit, ClipboardCheck, 
  Truck, CheckSquare, AlertTriangle,
  Upload, FileText, FilePlus, FileInput, X,
  Trash2, Mail, Printer, ShoppingCart, FileOutput
} from "lucide-react";
import { OrderChangelog } from "@/components/orders/OrderChangelog";
import LabelPreviewModal from "@/components/shipping/LabelPreviewModal";

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
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
  priority?: 'low' | 'medium' | 'high' | 'urgent';
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

const getPriorityBadgeClass = (priority: string = 'medium') => {
  switch (priority) {
    case 'low':
      return 'bg-slate-100 text-slate-800';
    case 'medium':
      return 'bg-blue-100 text-blue-800';
    case 'high':
      return 'bg-amber-100 text-amber-800';
    case 'urgent':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-blue-100 text-blue-800'; // Default to medium
  }
};

const Orders = () => {
  const { setCurrentPage } = useSidebar();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  
  // ADD a new state variable for the dialog's visibility
  const [isFormOpen, setIsFormOpen] = useState(false);
  
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

  const { data: orders, isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
    select: (data: any) => {
      // Handle API response structure: { success: true, data: [...] }
      if (data && typeof data === 'object' && 'data' in data) {
        return Array.isArray(data.data) ? data.data : [];
      }
      // Fallback for direct array response
      return Array.isArray(data) ? data : [];
    }
  });

  // State for handling partial order approval
  const [orderRequiringApproval, setOrderRequiringApproval] = useState<{
    orderId: number;
    status: string;
    unshippedItems: number;
  } | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  
  // State for label printing
  const [showPrintLabelDialog, setShowPrintLabelDialog] = useState(false);
  const [showMultiLabelDialog, setShowMultiLabelDialog] = useState(false);
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
  const [boxCount, setBoxCount] = useState<number>(1);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ 
      orderId, 
      status, 
      approvePartialFulfillment = false 
    }: { 
      orderId: number; 
      status: string; 
      approvePartialFulfillment?: boolean 
    }) => {
      return apiRequest({
        url: `/api/orders/${orderId}/status`,
        method: 'PATCH',
        body: JSON.stringify({ 
          status,
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
      setShowApprovalDialog(false);
      setOrderRequiringApproval(null);
      toast({
        title: "Order status updated",
        description: "The order status has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.log("Status update error:", error);
      
      // Check if this is a partial fulfillment that requires approval
      if (error.status === 403 && error.data?.requiresApproval) {
        console.log("Showing approval dialog for partial fulfillment");
        setOrderRequiringApproval({
          orderId: error.data.orderId || parseInt(error.config?.url?.split('/')[2]),
          status: 'shipped',
          unshippedItems: error.data.unshippedItems || 0
        });
        setShowApprovalDialog(true);
      } else {
        // Reset UI states
        setShowApprovalDialog(false);
        setOrderRequiringApproval(null);
        
        // Show error message
        toast({
          title: "Failed to update order status",
          description: error.message || "An error occurred while updating the order status",
          variant: "destructive",
        });
      }
    }
  });

  useEffect(() => {
    setCurrentPage("Orders");
    
    // Check URL parameters for filters and highlights
    const params = new URLSearchParams(window.location.search);
    
    // Handle status filter parameter
    const statusParam = params.get("status");
    if (statusParam && ["pending", "picked", "shipped", "cancelled"].includes(statusParam)) {
      setStatusFilter(statusParam);
    }
    
    // Handle highlight parameter
    const highlightId = params.get("highlight");
    if (highlightId) {
      // Clean up the URL by removing the highlight parameter
      const url = new URL(window.location.href);
      url.searchParams.delete("highlight");
      window.history.replaceState({}, '', url);
      
      const orderId = parseInt(highlightId, 10);
      if (!isNaN(orderId)) {
        // Use setTimeout to ensure the orders have loaded first
        setTimeout(() => {
          const order = orders?.find(o => o.id === orderId);
          if (order) {
            setSelectedOrder(order);
            setIsEditMode(false);
            setLocation(`/orders/${orderId}`);
          }
        }, 100);
      }
    }
  }, [setCurrentPage, orders, setLocation]);
  
  // Handle route params for order ID when viewing or editing a specific order
  useEffect(() => {
    // ADD THIS GUARD AT THE TOP OF THE HOOK
    if (isLoadingOrders) {
      return;
    }
    
    if ((isViewRoute || isEditRoute) && params && params.id) {
      // Check if the order ID is a valid number
      const orderId = parseInt(params.id, 10);
      if (!isNaN(orderId) && orders) {
        // Find the order with the matching ID
        const order = orders.find(o => o.id === orderId);
        if (order) {
          // Only set if not already selected to prevent dialog reset
          if (!selectedOrder || selectedOrder.id !== order.id) {
            setSelectedOrder(order);
            setIsFormOpen(true); // Open dialog when accessing via URL
          }
          // Only set edit mode if not already in the correct state
          // Removed the automatic reset logic that was causing the dialog to close
          if (isEditRoute && !isEditMode) {
            setIsEditMode(true);
          }
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
  }, [isViewRoute, isEditRoute, params, orders, isLoadingOrders, toast, setLocation, selectedOrder, isEditMode]);

  const filteredOrders = orders?.filter(order => {
    const matchesSearch = searchTerm === "" || 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    const matchesPriority = priorityFilter === "all" || 
      (order.priority === priorityFilter) || 
      (!order.priority && priorityFilter === "none");
    
    return matchesSearch && matchesStatus && matchesPriority;
  }).sort((a, b) => {
    // Sort by date, showing the latest first
    return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
  });

  // Fetch specific order details with product details
  const { data: orderDetails, isLoading: isOrderDetailsLoading, error: orderDetailsError } = useQuery<Order>({
    queryKey: ['/api/orders', selectedOrder?.id],
    enabled: !!selectedOrder,
    retry: 2,
    retryDelay: 1000,
    queryFn: async () => {
      try {
        const response = await apiRequest({
          url: `/api/orders/${selectedOrder?.id}`,
        });
        
        // Handle API response structure: { success: true, data: {...} }
        const orderData = response && typeof response === 'object' && 'data' in response ? response.data : response;
        
        // Ensure we have a valid order object
        if (!orderData || typeof orderData !== 'object') {
          throw new Error('Invalid order data received');
        }
        
        // If order has items, fetch product details for each item
        if (Array.isArray(orderData.items) && orderData.items.length > 0) {
          const itemsWithProducts = await Promise.allSettled(
            orderData.items.map(async (item: OrderItem) => {
              try {
                const productResponse = await apiRequest({
                  url: `/api/products/${item.productId}`,
                });
                
                // Handle product API response structure
                const productData = productResponse && typeof productResponse === 'object' && 'data' in productResponse 
                  ? productResponse.data 
                  : productResponse;
                
                return { ...item, product: productData };
              } catch (error) {
                console.error(`Failed to fetch product ${item.productId}:`, error);
                return item;
              }
            })
          );
          
          // Process settled promises and extract successful results
          const processedItems = itemsWithProducts.map(result => 
            result.status === 'fulfilled' ? result.value : null
          ).filter(Boolean);
          
          return { ...orderData, items: processedItems };
        }
        
        return orderData;
      } catch (error) {
        console.error('Order details fetch error:', error);
        throw error;
      }
    },
  });

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ 
      orderId, 
      file, 
      documentType, 
      notes,
      updateStatus,
      approvePartialFulfillment 
    }: { 
      orderId: number; 
      file: File; 
      documentType: string; 
      notes?: string;
      updateStatus: boolean;
      approvePartialFulfillment?: boolean;
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
      if (approvePartialFulfillment) formData.append('approvePartialFulfillment', 'true');
      
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
        // Check if this is a partial fulfillment that requires approval
        if (error.status === 403 && error.data?.requiresApproval) {
          // Save the original order ID and document information for later use if approved
          setOrderRequiringApproval({
            orderId: orderId,
            status: 'shipped',
            unshippedItems: error.data.unshippedItems || 0
          });
          setShowApprovalDialog(true);
          setIsUploading(false);
          // Don't close the upload dialog immediately, as we might need it after approval
          // setShowUploadDialog(false);
          // Don't throw an error since we're showing the approval dialog
          throw new Error("Requires manager approval");
        }
        
        // Rethrow to be caught by onError for other errors
        throw new Error(error.message || 'Upload failed. Please try again.');
      }
    },
    onSuccess: (data, variables) => {
      setIsUploading(false);
      setShowUploadDialog(false);
      setShowApprovalDialog(false); // Close approval dialog if it was open
      setOrderRequiringApproval(null); // Reset approval state
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
      // If we already handled this error with the approval dialog, just return
      if (error.message === "Requires manager approval") {
        return;
      }
      
      // Reset all UI states
      setIsUploading(false);
      setShowUploadDialog(false);
      
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
    // More detailed logging for debugging
    console.log(`Status change request: Order ${orderId} to ${newStatus}`);
    
    // Especially log if we're changing to shipped, which might need approval
    if (newStatus === 'shipped') {
      console.log(`Order ${orderId}: Potential partial fulfillment, will check on server`);
    }
    
    // Update the order status, with approvePartialFulfillment set to false initially
    // This should trigger the approval dialog if the server returns a 403 with requiresApproval=true
    try {
      updateStatusMutation.mutate({ 
        orderId, 
        status: newStatus as 'pending' | 'picked' | 'shipped' | 'cancelled',
        approvePartialFulfillment: false
      }, {
        onError: (error: any) => {
          console.log("Direct error handler:", error);
          // This is a more direct way to handle errors than the mutation's onError
          if (error.status === 403 && error.data?.requiresApproval) {
            console.log("Immediate detection of approval required:", error.data);
            setOrderRequiringApproval({
              orderId: error.data.orderId || orderId,
              status: newStatus,
              unshippedItems: error.data.unshippedItems || 0
            });
            setShowApprovalDialog(true);
          }
        }
      });
    } catch (error) {
      console.error("Unexpected error in status change handler:", error);
    }
  };
  
  // Function to handle document upload for any order
  const handleOpenDocumentUpload = (order: Order) => {
    setOrderToShip(order);
    setShowUploadDialog(true);
  };
  
  const handleOpenLabelPrinting = (order: Order) => {
    setOrderToPrint(order);
    setShowPrintLabelDialog(true);
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
      updateStatus: updateStatusOnUpload,
      approvePartialFulfillment: false // Default to false, will show approval dialog if needed
    });
  };
  
  const handleViewOrder = (order: Order) => {
    setLocation(`/orders/${order.id}`);
    setSelectedOrder(order);
    setIsEditMode(false);
    setIsFormOpen(true); // Open the dialog
  };
  
  const handleEditOrder = (order: Order) => {
    setLocation(`/orders/${order.id}/edit`);
    setSelectedOrder(order);
    setIsEditMode(true);
    setIsFormOpen(true); // Open the dialog
  };
  
  const handleCloseDialog = () => {
    setIsFormOpen(false); // Set the dialog to be closed
    setSelectedOrder(null);
    setIsEditMode(false);
    setLocation('/orders'); // Reset the URL
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
  
  // Handler for sending email notification
  const handleSendEmail = (orderId: number) => {
    sendEmailMutation.mutate(orderId);
  };
  
  // Handler for opening print label dialog
  const handleOpenPrintLabelDialog = (order: Order) => {
    setOrderToPrint(order);
    setBoxCount(1);
    setShowPrintLabelDialog(true);
  };
  
  // Function to generate shipping labels for CAB EOS printer
  const generateShippingLabels = (order: Order, boxCount: number) => {
    // Only proceed if we have a valid box count
    if (boxCount < 1) {
      toast({
        title: "Error",
        description: "Box count must be at least 1",
        variant: "destructive"
      });
      return;
    }
    
    // Create the JScript commands for the CAB EOS1 printer
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
      // For each box, create a label
      for (let i = 1; i <= boxCount; i++) {
        const jscript = createLabelJScript(i, boxCount);
        
        // Send to the server to print
        apiRequest({
          url: '/api/print/shipping-label',
          method: 'POST',
          body: JSON.stringify({
            labelContent: jscript,
            orderId: order.id,
            boxNumber: i,
            totalBoxes: boxCount
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        })
        .then(() => {
          if (i === boxCount) {
            toast({
              title: "Shipping labels printed",
              description: `${boxCount} label(s) sent to printer`,
              variant: "default"
            });
          }
        })
        .catch(error => {
          toast({
            title: "Error printing label",
            description: error.message || "Failed to print shipping label",
            variant: "destructive"
          });
        });
      }
    } catch (error: any) {
      toast({
        title: "Error generating labels",
        description: error.message || "An error occurred while generating shipping labels",
        variant: "destructive"
      });
    }
  };
  
  // Handle print labels submission
  const handlePrintLabels = () => {
    if (orderToPrint) {
      // Open multi-label print view in a new window
      const url = `/print-labels/${orderToPrint.id}/${boxCount}`;
      window.open(url, '_blank');
      setShowPrintLabelDialog(false);
      
      toast({
        title: t('orders.labels.success', 'Labels Ready'),
        description: t('orders.labels.batchSuccessDescription', 'All {{count}} shipping labels will be displayed for printing', { count: boxCount }),
      });
    }
  };

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      return apiRequest({
        url: `/api/orders/${orderId}`,
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setShowDeleteConfirmDialog(false);
      setOrderToDelete(null);
      toast({
        title: "Order deleted",
        description: "The order has been permanently deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete order",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Send email notification mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (orderId: number) => {
      return apiRequest({
        url: `/api/orders/${orderId}/send-email`,
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      // Check if email was actually sent or skipped
      if (data.success === false) {
        // This happens when customer has no email address
        toast({
          title: "Email Notification Skipped",
          description: data.message || "Customer does not have an email address.",
          // Using default variant as "warning" is not available
          duration: 5000,
        });
      } else {
        // Email was successfully sent
        toast({
          title: "Email Sent",
          description: data.message || "Shipping notification email has been sent to the customer.",
          duration: 5000,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Email",
        description: error.message || "There was an error sending the email notification. Please check email settings.",
        variant: "destructive",
        duration: 7000,
      });
    }
  });

  // Handle order deletion
  const handleDeleteOrder = (order: Order) => {
    setOrderToDelete(order);
    setShowDeleteConfirmDialog(true);
  };
  
  // Handle printing order PDF
  const handlePrintOrderPdf = (orderId: number) => {
    try {
      // Get language preference from i18n
      const language = localStorage.getItem('i18nextLng') || 'en';
      
      // Open PDF in a new window
      window.open(`/api/order-pdf/${orderId}?lang=${language}`, '_blank');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || 'Failed to generate order PDF',
        variant: "destructive",
      });
    }
  };

  // Confirm order deletion
  const confirmDeleteOrder = () => {
    if (orderToDelete) {
      deleteOrderMutation.mutate(orderToDelete.id);
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
            <Button onClick={() => setShowOrderForm(!showOrderForm)}>
              {showOrderForm ? t('orders.hideForm') : t('orders.createNew')}
            </Button>
          </div>
        </div>

        {showOrderForm && (
          <div className="p-4 border-b border-slate-200">
            <OrderForm 
              onSuccess={() => {
                // Hide the form after successful order creation
                setShowOrderForm(false);
                // Reset any selected order state
                setSelectedOrder(null);
                setIsEditMode(false);
                // Show success message
                toast({
                  title: t('orders.orderCreated'),
                  description: t('orders.orderCreatedSuccessfully'),
                });
              }}
              onCancel={() => {
                // Hide the form when user cancels
                setShowOrderForm(false);
                setSelectedOrder(null);
                setIsEditMode(false);
              }}
            />
          </div>
        )}

        {/* Status filter tabs */}
        <div className="border-b border-slate-200">
          <div className="flex flex-wrap">
            <Button 
              variant={statusFilter === "all" ? "default" : "ghost"} 
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all hover:border-primary/50"
              style={{ borderBottomColor: statusFilter === "all" ? "var(--primary)" : "transparent" }}
              onClick={() => setStatusFilter("all")}
            >
              {t('orders.allStatuses')} {orders ? ` (${orders.length})` : ''}
            </Button>
            <Button 
              variant={statusFilter === "pending" ? "default" : "ghost"} 
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all hover:border-primary/50"
              style={{ borderBottomColor: statusFilter === "pending" ? "var(--primary)" : "transparent" }}
              onClick={() => setStatusFilter("pending")}
            >
              {t('orders.statusValues.pending')} {orders ? ` (${orders.filter(o => o.status === "pending").length})` : ''}
            </Button>
            <Button 
              variant={statusFilter === "picked" ? "default" : "ghost"} 
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all hover:border-primary/50"
              style={{ borderBottomColor: statusFilter === "picked" ? "var(--primary)" : "transparent" }}
              onClick={() => setStatusFilter("picked")}
            >
              {t('orders.statusValues.picked')} {orders ? ` (${orders.filter(o => o.status === "picked").length})` : ''}
            </Button>
            <Button 
              variant={statusFilter === "shipped" ? "default" : "ghost"} 
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all hover:border-primary/50"
              style={{ borderBottomColor: statusFilter === "shipped" ? "var(--primary)" : "transparent" }}
              onClick={() => setStatusFilter("shipped")}
            >
              {t('orders.statusValues.shipped')} {orders ? ` (${orders.filter(o => o.status === "shipped").length})` : ''}
            </Button>
            <Button 
              variant={statusFilter === "cancelled" ? "default" : "ghost"} 
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all hover:border-primary/50"
              style={{ borderBottomColor: statusFilter === "cancelled" ? "var(--primary)" : "transparent" }}
              onClick={() => setStatusFilter("cancelled")}
            >
              {t('orders.statusValues.cancelled')} {orders ? ` (${orders.filter(o => o.status === "cancelled").length})` : ''}
            </Button>
          </div>
        </div>

        {/* Advanced filters and search */}
        <div className="p-4 flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex flex-col md:flex-row gap-2 flex-1">
            <div className="relative w-full md:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <i className="fas fa-search text-slate-400"></i>
              </span>
              <Input
                placeholder={t('orders.searchOrders')}
                className={`pl-10 ${searchTerm ? "pr-10" : ""}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 h-full"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-4 w-4 text-slate-400" />
                </Button>
              )}
            </div>
            
            {/* Priority filter dropdown */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={t('orders.filterByPriority')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('orders.allPriorities')}</SelectItem>
                <SelectItem value="urgent">{t('orders.priorityValues.urgent')}</SelectItem>
                <SelectItem value="high">{t('orders.priorityValues.high')}</SelectItem>
                <SelectItem value="medium">{t('orders.priorityValues.medium')}</SelectItem>
                <SelectItem value="low">{t('orders.priorityValues.low')}</SelectItem>
                <SelectItem value="none">{t('orders.priorityValues.none')}</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Batch action buttons */}
            {selectedOrders.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">
                  {selectedOrders.length} selected
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    // Implement batch status change
                    toast({
                      title: "Batch update",
                      description: `Update ${selectedOrders.length} orders at once`,
                    });
                  }}
                >
                  <i className="fas fa-edit mr-1"></i> Batch Update
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => {
                    // Implement batch delete
                    toast({
                      title: "Batch delete",
                      description: `${selectedOrders.length} orders will be deleted`,
                      variant: "destructive",
                    });
                  }}
                >
                  <i className="fas fa-trash mr-1"></i> Delete
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={selectAll}
                    onCheckedChange={(checked) => {
                      setSelectAll(!!checked);
                      if (checked && filteredOrders) {
                        setSelectedOrders(filteredOrders.map(o => o.id));
                      } else {
                        setSelectedOrders([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>{t('orders.columns.orderId')}</TableHead>
                <TableHead>{t('orders.columns.customer')}</TableHead>
                <TableHead>{t('orders.columns.date')}</TableHead>
                <TableHead>{t('orders.columns.status')}</TableHead>
                <TableHead>{t('orders.columns.priority')}</TableHead>
                <TableHead>{t('orders.columns.items')}</TableHead>
                <TableHead>{t('orders.columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingOrders ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    {t('orders.loadingOrders')}
                  </TableCell>
                </TableRow>
              ) : filteredOrders?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    {t('orders.noOrdersFound')} {searchTerm || statusFilter ? t('orders.tryClearingFilters') : ""}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders?.map((order) => (
                  <TableRow 
                    key={order.id} 
                    className={selectedOrders.includes(order.id) ? "bg-slate-50" : ""}
                    data-state={order.status}
                  >
                    <TableCell>
                      <Checkbox 
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedOrders(prev => [...prev, order.id]);
                          } else {
                            setSelectedOrders(prev => prev.filter(id => id !== order.id));
                            setSelectAll(false);
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{order.orderNumber}</span>
                    </TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>{format(new Date(order.orderDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          order.status === 'pending' ? 'bg-amber-500' :
                          order.status === 'picked' ? 'bg-blue-500' :
                          order.status === 'shipped' ? 'bg-green-500' :
                          'bg-slate-400'
                        }`}></div>
                      
                        <Select 
                          value={order.status} 
                          onValueChange={(value) => handleStatusChange(order.id, value)}
                        >
                          <SelectTrigger className={`w-32 h-7 px-2 py-0 rounded-full text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">{t('orders.statusValues.pending')}</SelectItem>
                            <SelectItem value="picked">{t('orders.statusValues.picked')}</SelectItem>
                            <SelectItem value="shipped">{t('orders.statusValues.shipped')}</SelectItem>
                            <SelectItem value="cancelled">{t('orders.statusValues.cancelled')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.priority ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadgeClass(order.priority)}`}>
                          {t(`orders.form.priorities.${order.priority}`)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center">
                        <ShoppingCart className="h-3 w-3 mr-1 text-slate-400" /> 
                        {order.items?.length || 0}
                      </span>
                    </TableCell>
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
                        
                        {/* Print order PDF button */}
                        <button
                          onClick={() => handlePrintOrderPdf(order.id)}
                          className="text-slate-600 hover:text-green-600 p-1 rounded-full hover:bg-slate-100" 
                          title={t('orders.actions.printOrder') || 'Print Order PDF'}
                        >
                          <FileOutput className="h-4 w-4" />
                        </button>
                        
                        {/* Delete button - only visible for admin users */}
                        {hasPermission(['admin']) && (
                          <button
                            onClick={() => handleDeleteOrder(order)}
                            className="text-slate-600 hover:text-red-600 p-1 rounded-full hover:bg-slate-100" 
                            title={t('orders.actions.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
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
              {isLoadingOrders 
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
        open={isFormOpen} 
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDialog();
          }
        }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
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

          {selectedOrder && (
            <div className="space-y-4">
              {orderDetailsError ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <AlertTriangle className="h-12 w-12 text-red-500" />
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-red-600 mb-2">Failed to load order details</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      {orderDetailsError?.message || 'An error occurred while loading the order details.'}
                    </p>
                    <Button 
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/orders', selectedOrder.id] })}
                      variant="outline"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              ) : !isEditMode ? (
                // View mode - use orderDetails if available, fallback to selectedOrder
                <div className="space-y-4 py-2">
                  {isOrderDetailsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-sm font-medium text-slate-500">{t('orders.details.customer')}</h3>
                          <p className="text-lg font-medium">{orderDetails?.customerName || selectedOrder.customerName}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-slate-500">{t('orders.details.orderDate')}</h3>
                          <p className="text-lg font-medium">
                            {format(new Date(orderDetails?.orderDate || selectedOrder.orderDate), "MMMM d, yyyy")}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-slate-500">{t('orders.details.status')}</h3>
                          <div className={`inline-block px-2.5 py-0.5 rounded-full text-sm font-medium ${getStatusBadgeClass(orderDetails?.status || selectedOrder.status)}`}>
                            {t(`orders.statusValues.${orderDetails?.status || selectedOrder.status}`)}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-slate-500">{t('orders.details.priority')}</h3>
                          <div className={`inline-block px-2.5 py-0.5 rounded-full text-sm font-medium ${getPriorityBadgeClass(orderDetails?.priority || selectedOrder.priority)}`}>
                            {t(`orders.form.priorities.${orderDetails?.priority || selectedOrder.priority || 'medium'}`)}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-slate-500">{t('orders.details.totalItems')}</h3>
                          <p className="text-lg font-medium">{orderDetails?.items?.length || selectedOrder.items?.length || 0}</p>
                        </div>
                      </div>

                      {(orderDetails?.notes || selectedOrder.notes) && (
                        <div>
                          <h3 className="text-sm font-medium text-slate-500">{t('orders.details.notes')}</h3>
                          <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                            {orderDetails?.notes || selectedOrder.notes}
                          </p>
                        </div>
                      )}
                    </>
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
                          ) : Array.isArray(orderDetails?.items) && orderDetails.items.length > 0 ? (
                            orderDetails.items.map((item, index) => (
                              <TableRow key={`${item.id}-${index}`}>
                                <TableCell className="font-medium">
                                  {item.product?.name || `Product #${item.productId}`}
                                </TableCell>
                                <TableCell>
                                  {item.product?.sku || "N/A"}
                                </TableCell>
                                <TableCell>
                                  <span className="font-medium">{item.quantity || 0}</span>
                                  {item.product?.unitsPerBox && item.product.unitsPerBox > 0 && item.quantity && (
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
                              <TableCell colSpan={4} className="text-center py-4">
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
                <>
                  {isOrderDetailsLoading ? (
                    <div className="flex justify-center items-center py-20">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                  ) : orderDetailsError ? (
                    <div className="text-red-500 text-center py-10">
                      <p>Error loading order details.</p>
                      <p>{String(orderDetailsError)}</p>
                    </div>
                  ) : (
                    <OrderForm 
                      key={orderDetails?.id}
                      initialData={orderDetails}
                      isEditMode={true}
                      onCancel={handleCloseDialog}
                      onSuccess={handleCloseDialog}
                    />
                  )}
                </>
              )}
              
              <DialogFooter className="flex justify-between sm:justify-between gap-2">
                {!isEditMode && (orderDetails || selectedOrder) && (
                  <>
                    <div className="flex gap-2">
                      {(orderDetails?.status || selectedOrder.status) === 'pending' && (
                        <Button
                          onClick={() => handleGoToPickList(orderDetails?.id || selectedOrder.id)}
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
                        onClick={() => handleOpenDocumentUpload(orderDetails || selectedOrder)}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <FileInput className="h-4 w-4" />
                        <span>{t('orders.actions.uploadDocument')}</span>
                      </Button>
                      
                      {/* Document view button in dialog - for any order with document */}
                      {(orderDetails?.hasShippingDocument || selectedOrder.hasShippingDocument) && (
                        <Button
                          onClick={() => handleViewDocument(orderDetails?.id || selectedOrder.id)}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          <span>{t('orders.actions.viewDocument')}</span>
                        </Button>
                      )}
                      
                      {/* Print order PDF button */}
                      <Button
                        onClick={() => handlePrintOrderPdf(orderDetails?.id || selectedOrder.id)}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <FileOutput className="h-4 w-4" />
                        <span>{t('orders.actions.printOrder') || 'Print Order PDF'}</span>
                      </Button>
                      
                      {/* Reprint shipping label button - for picked or shipped orders */}
                      {((orderDetails?.status || selectedOrder.status) === 'picked' || (orderDetails?.status || selectedOrder.status) === 'shipped') && (
                        <Button
                          onClick={() => handleOpenPrintLabelDialog(orderDetails || selectedOrder)}
                          variant="outline"
                          className="flex items-center gap-2 bg-green-50 hover:bg-green-100 border-green-200"
                        >
                          <Printer className="h-4 w-4 text-green-600" />
                          <span>{t('orders.actions.reprintLabels', 'Reprint Shipping Labels')}</span>
                        </Button>
                      )}
                      
                      {/* Send email notification button - only for shipped orders */}
                      {(orderDetails?.status || selectedOrder.status) === 'shipped' && (
                        <Button
                          onClick={() => handleSendEmail(orderDetails?.id || selectedOrder.id)}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <Mail className="h-4 w-4" />
                          <span>{t('orders.actions.sendEmail', 'Send Email')}</span>
                        </Button>
                      )}
                    </div>
                    
                    <Button 
                      onClick={handleCloseDialog}
                      variant="outline"
                    >
                      {t('common.close', 'Close')}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Order Confirmation Dialog */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={(open) => {
        setShowDeleteConfirmDialog(open);
        if (!open) {
          setOrderToDelete(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">{t('orders.deleteOrder.title')}</DialogTitle>
            <DialogDescription>
              {t('orders.deleteOrder.description')}
            </DialogDescription>
          </DialogHeader>
          
          {orderToDelete && (
            <div className="py-4">
              <div className="bg-red-50 p-4 rounded-md mb-4">
                <p className="text-sm text-red-800">
                  {t('orders.deleteOrder.warning')}
                </p>
              </div>
              
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2">{t('orders.deleteOrder.orderInfo')}:</h3>
                <ul className="space-y-1 text-sm">
                  <li><span className="font-medium">{t('orders.columns.orderId')}:</span> {orderToDelete.orderNumber}</li>
                  <li><span className="font-medium">{t('orders.columns.customer')}:</span> {orderToDelete.customerName}</li>
                  <li><span className="font-medium">{t('orders.columns.date')}:</span> {format(new Date(orderToDelete.orderDate), "MMM dd, yyyy")}</li>
                  <li><span className="font-medium">{t('orders.columns.status')}:</span> {t(`orders.statusValues.${orderToDelete.status}`)}</li>
                </ul>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex justify-between space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirmDialog(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteOrder}
              disabled={deleteOrderMutation.isPending}
            >
              {deleteOrderMutation.isPending ? (
                <div className="flex items-center">
                  <span className="animate-spin mr-2">⏳</span>
                  {t('orders.deleteOrder.deleting')}
                </div>
              ) : (
                <div className="flex items-center">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('orders.deleteOrder.confirm')}
                </div>
              )}
            </Button>
          </DialogFooter>
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

      {/* Partial order approval dialog */}
      <AlertDialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Partial Order Fulfillment Requires Approval</AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-4">
                This order has {orderRequiringApproval?.unshippedItems} item(s) that cannot be fulfilled due to insufficient stock.
              </p>
              <p className="mb-4">
                As a manager or admin, you can approve this partial shipment. The unfulfilled items will be tracked in the system.
              </p>
              <p className="font-semibold">
                Do you want to approve this partial order fulfillment?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowApprovalDialog(false);
              setOrderRequiringApproval(null);
              // Also close document upload dialog if it was open
              setShowUploadDialog(false);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (orderRequiringApproval) {
                  // Check if this was triggered from a document upload
                  if (documentFile && documentType) {
                    console.log("Approving partial fulfillment with document upload");
                    // Continue with document upload but with approved partial fulfillment
                    uploadDocumentMutation.mutate({
                      orderId: orderRequiringApproval.orderId,
                      file: documentFile,
                      documentType,
                      notes: documentNotes,
                      updateStatus: updateStatusOnUpload,
                      approvePartialFulfillment: true
                    });
                    
                    // Close the upload dialog after submission
                    setShowUploadDialog(false);
                  } else {
                    console.log("Approving partial fulfillment with status update");
                    // Regular status update with approval
                    updateStatusMutation.mutate({
                      orderId: orderRequiringApproval.orderId,
                      status: orderRequiringApproval.status,
                      approvePartialFulfillment: true
                    });
                  }
                  // Toast message for better feedback
                  toast({
                    title: "Partial Fulfillment Approved",
                    description: "The order will be processed with partial fulfillment.",
                  });
                }
              }} 
              className="bg-green-600 hover:bg-green-700"
            >
              Approve Partial Fulfillment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Label Dialog */}
      {/* Label Printing Modal */}
      {orderToPrint && (
        <LabelPreviewModal
          open={showPrintLabelDialog}
          onOpenChange={(open) => {
            setShowPrintLabelDialog(open);
            if (!open) {
              setOrderToPrint(null);
            }
          }}
          orderId={orderToPrint.id}
          orderNumber={orderToPrint.orderNumber}
        />
      )}
    </div>
  );
};

export default Orders;
