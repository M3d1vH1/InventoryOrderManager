import { useEffect, useState } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { 
  Eye, Edit, ClipboardCheck, 
  Truck, CheckSquare, AlertTriangle 
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
import OrderForm from "@/components/orders/OrderForm";

interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
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

  // Fetch specific order details
  const { data: orderDetails } = useQuery<Order>({
    queryKey: ['/api/orders', selectedOrder?.id],
    enabled: !!selectedOrder,
    queryFn: async () => {
      const response = await apiRequest({
        url: `/api/orders/${selectedOrder?.id}`,
      });
      return response;
    },
  });

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateStatusMutation.mutate({ 
      orderId, 
      status: newStatus as 'pending' | 'picked' | 'shipped' | 'cancelled' 
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
                            <TableHead>Quantity</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderDetails.items && orderDetails.items.length > 0 ? (
                            orderDetails.items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>Product ID: {item.productId}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center">
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
                // Edit mode - To be implemented with OrderForm
                <div className="p-4 bg-slate-50 rounded-md border border-slate-200">
                  <p className="text-center text-slate-500">
                    Edit mode is available but form needs to be implemented.
                  </p>
                </div>
              )}
              
              <DialogFooter className="flex justify-between sm:justify-between gap-2">
                {isEditMode ? (
                  <>
                    <Button variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled>
                      Save Changes
                    </Button>
                  </>
                ) : (
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
    </div>
  );
};

export default Orders;
