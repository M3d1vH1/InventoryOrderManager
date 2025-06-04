import React, { memo, useCallback } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Edit, Truck, Printer, Mail } from "lucide-react";

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  orderDate: string;
  status: 'pending' | 'picked' | 'shipped' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  items?: any[];
}

interface OptimizedOrderRowProps {
  order: Order;
  isSelected: boolean;
  onSelectionChange: (orderId: number, selected: boolean) => void;
  onStatusChange: (orderId: number, status: string) => void;
  onViewOrder: (orderId: number) => void;
  onEditOrder: (orderId: number) => void;
  onPrintLabel: (orderId: number) => void;
  onSendEmail: (orderId: number) => void;
  isUpdating: boolean;
}

const getStatusBadgeClass = (status: string): string => {
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
      return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityBadgeClass = (priority?: string): string => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// Memoized status selector component
const OrderStatusSelect = memo<{
  orderId: number;
  status: string;
  onStatusChange: (orderId: number, status: string) => void;
  isUpdating: boolean;
}>(({ orderId, status, onStatusChange, isUpdating }) => {
  const handleStatusChange = useCallback((newStatus: string) => {
    onStatusChange(orderId, newStatus);
  }, [orderId, onStatusChange]);

  return (
    <Select 
      value={status} 
      onValueChange={handleStatusChange}
      disabled={isUpdating}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="picked">Picked</SelectItem>
        <SelectItem value="shipped">Shipped</SelectItem>
        <SelectItem value="cancelled">Cancelled</SelectItem>
      </SelectContent>
    </Select>
  );
});

OrderStatusSelect.displayName = "OrderStatusSelect";

// Memoized action buttons component
const OrderActions = memo<{
  orderId: number;
  onViewOrder: (orderId: number) => void;
  onEditOrder: (orderId: number) => void;
  onPrintLabel: (orderId: number) => void;
  onSendEmail: (orderId: number) => void;
}>(({ orderId, onViewOrder, onEditOrder, onPrintLabel, onSendEmail }) => {
  const handleView = useCallback(() => onViewOrder(orderId), [orderId, onViewOrder]);
  const handleEdit = useCallback(() => onEditOrder(orderId), [orderId, onEditOrder]);
  const handlePrint = useCallback(() => onPrintLabel(orderId), [orderId, onPrintLabel]);
  const handleEmail = useCallback(() => onSendEmail(orderId), [orderId, onSendEmail]);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleView}
        title="View Order"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleEdit}
        title="Edit Order"
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePrint}
        title="Print Label"
      >
        <Printer className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleEmail}
        title="Send Email"
      >
        <Mail className="h-4 w-4" />
      </Button>
    </div>
  );
});

OrderActions.displayName = "OrderActions";

// Memoized checkbox component
const OrderCheckbox = memo<{
  orderId: number;
  isSelected: boolean;
  onSelectionChange: (orderId: number, selected: boolean) => void;
}>(({ orderId, isSelected, onSelectionChange }) => {
  const handleCheckedChange = useCallback((checked: boolean) => {
    onSelectionChange(orderId, checked);
  }, [orderId, onSelectionChange]);

  return (
    <Checkbox 
      checked={isSelected}
      onCheckedChange={handleCheckedChange}
    />
  );
});

OrderCheckbox.displayName = "OrderCheckbox";

// Main optimized order row component
const OptimizedOrderRow = memo<OptimizedOrderRowProps>(({
  order,
  isSelected,
  onSelectionChange,
  onStatusChange,
  onViewOrder,
  onEditOrder,
  onPrintLabel,
  onSendEmail,
  isUpdating
}) => {
  // Memoized computed values
  const formattedDate = React.useMemo(() => 
    format(new Date(order.orderDate), "MMM dd, yyyy"), 
    [order.orderDate]
  );

  const statusBadgeClass = React.useMemo(() => 
    getStatusBadgeClass(order.status), 
    [order.status]
  );

  const priorityBadgeClass = React.useMemo(() => 
    getPriorityBadgeClass(order.priority), 
    [order.priority]
  );

  const itemCount = React.useMemo(() => 
    order.items?.length || 0, 
    [order.items]
  );

  return (
    <TableRow key={order.id}>
      <TableCell>
        <OrderCheckbox
          orderId={order.id}
          isSelected={isSelected}
          onSelectionChange={onSelectionChange}
        />
      </TableCell>
      <TableCell className="font-medium">{order.orderNumber}</TableCell>
      <TableCell>{order.customerName}</TableCell>
      <TableCell>{formattedDate}</TableCell>
      <TableCell>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass}`}>
          {order.status}
        </span>
      </TableCell>
      <TableCell>
        {order.priority && (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityBadgeClass}`}>
            {order.priority}
          </span>
        )}
      </TableCell>
      <TableCell>{itemCount} items</TableCell>
      <TableCell>
        <OrderActions
          orderId={order.id}
          onViewOrder={onViewOrder}
          onEditOrder={onEditOrder}
          onPrintLabel={onPrintLabel}
          onSendEmail={onSendEmail}
        />
      </TableCell>
    </TableRow>
  );
});

OptimizedOrderRow.displayName = "OptimizedOrderRow";

export default OptimizedOrderRow;