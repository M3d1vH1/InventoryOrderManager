import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useLocation } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { CircleCheckIcon, ClipboardListIcon, TruckIcon, InfoIcon, PackageIcon } from 'lucide-react';

interface PartiallyShippedOrdersProps {
  onShipCompleted?: () => void;
}

interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  shipped_quantity: number;
  sku?: string;
  status?: string;
}

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  orderDate: string;
  status: string;
  percentage_shipped: number;
  items?: OrderItem[];
}

export default function PartiallyShippedOrders({ onShipCompleted }: PartiallyShippedOrdersProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);

  // Query partially shipped orders
  const { data: partiallyShippedOrders, isLoading, error, refetch } = useQuery<Order[]>({
    queryKey: ['/api/orders/partially-shipped'],
    enabled: true,
  });

  // Query to get order items
  const getOrderItems = async (orderId: number) => {
    const response = await fetch(`/api/orders/${orderId}/items`);
    if (!response.ok) {
      throw new Error('Failed to fetch order items');
    }
    return response.json();
  };

  // Load order items when accordion is expanded
  const handleAccordionChange = async (orderNumber: string) => {
    if (expandedOrders.includes(orderNumber)) {
      setExpandedOrders(expandedOrders.filter(id => id !== orderNumber));
    } else {
      setExpandedOrders([...expandedOrders, orderNumber]);
      
      // Find the order and load its items if not already loaded
      const order = partiallyShippedOrders?.find(o => o.orderNumber === orderNumber);
      if (order && !order.items) {
        try {
          const items = await getOrderItems(order.id);
          // Update the items in place
          order.items = items;
          // Force a re-render
          refetch();
        } catch (error) {
          toast({
            title: t('common.error'),
            description: t('orders.loadingOrderItems'),
            variant: 'destructive'
          });
        }
      }
    }
  };

  const toggleOrderSelection = (orderId: number) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    } else {
      setSelectedOrders([...selectedOrders, orderId]);
    }
  };

  const handleCompleteShipment = async () => {
    if (selectedOrders.length === 0) {
      toast({
        title: t('orders.noOrdersSelected'),
        description: t('orders.selectOrdersToComplete'),
        variant: 'default'
      });
      return;
    }

    try {
      const response = await fetch('/api/orders/complete-shipment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderIds: selectedOrders })
      });

      if (!response.ok) {
        throw new Error('Failed to complete shipments');
      }

      toast({
        title: t('orders.shipmentsCompleted'),
        description: t('orders.orderStatusUpdated'),
      });

      setSelectedOrders([]);
      refetch();
      
      if (onShipCompleted) {
        onShipCompleted();
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('orders.errorCompletingShipment'),
        variant: 'destructive'
      });
    }
  };

  const renderOrderItems = (order: Order) => {
    if (!order.items) {
      return (
        <div className="py-4 text-center">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full mt-2" />
        </div>
      );
    }

    if (order.items.length === 0) {
      return (
        <div className="py-4 text-center text-muted-foreground">
          {t('orders.noItemsFound')}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('orders.form.productColumn')}</TableHead>
            <TableHead>{t('orders.columns.sku')}</TableHead>
            <TableHead className="text-right">{t('orders.form.quantity')}</TableHead>
            <TableHead className="text-right">{t('partiallyShipped.shipped')}</TableHead>
            <TableHead className="text-right">{t('partiallyShipped.remaining')}</TableHead>
            <TableHead className="text-right">{t('partiallyShipped.progress')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.items.map((item) => {
            const shippingProgress = (item.shipped_quantity / item.quantity) * 100;
            const remaining = item.quantity - item.shipped_quantity;
            
            return (
              <TableRow key={item.id}>
                <TableCell>{item.productName}</TableCell>
                <TableCell>{item.sku || '-'}</TableCell>
                <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                <TableCell className="text-right">{item.shipped_quantity}</TableCell>
                <TableCell className="text-right">{remaining}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Progress 
                      value={shippingProgress} 
                      className="w-20 h-2" 
                    />
                    <span className="text-xs">{shippingProgress.toFixed(0)}%</span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };
  
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t('partiallyShipped.title')}</CardTitle>
          <CardDescription>{t('partiallyShipped.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full mt-2" />
          <Skeleton className="h-12 w-full mt-2" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t('partiallyShipped.title')}</CardTitle>
          <CardDescription>{t('partiallyShipped.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-6 text-destructive">
            <InfoIcon className="h-5 w-5 mr-2" />
            <span>{t('partiallyShipped.error')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!partiallyShippedOrders || partiallyShippedOrders.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t('partiallyShipped.title')}</CardTitle>
          <CardDescription>{t('partiallyShipped.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-6 text-muted-foreground">
            <PackageIcon className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-center">{t('partiallyShipped.noOrders')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{t('partiallyShipped.title')}</CardTitle>
            <CardDescription>{t('partiallyShipped.description')}</CardDescription>
          </div>
          <div className="flex gap-2">
            {selectedOrders.length > 0 && (
              <Button 
                onClick={handleCompleteShipment}
                className="flex items-center gap-1"
              >
                <CircleCheckIcon className="h-4 w-4" />
                {t('partiallyShipped.completeShipment')} ({selectedOrders.length})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion
          type="multiple"
          value={expandedOrders}
          className="w-full"
        >
          {partiallyShippedOrders.map((order) => (
            <AccordionItem key={order.id} value={order.orderNumber}>
              <div className="border border-border rounded-md mb-4">
                <div className="flex items-center px-4 py-2">
                  <Checkbox 
                    id={`order-${order.id}`}
                    checked={selectedOrders.includes(order.id)}
                    onCheckedChange={() => toggleOrderSelection(order.id)}
                    className="mr-3"
                  />
                  <AccordionTrigger className="flex-1 hover:no-underline py-2">
                    <div className="grid grid-cols-5 w-full items-center text-left">
                      <div className="flex items-center">
                        <span className="font-semibold">{order.orderNumber}</span>
                      </div>
                      <div>{order.customerName}</div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className="bg-amber-50 text-amber-700 border-amber-200"
                        >
                          {t('orders.status.partially_shipped')}
                        </Badge>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Progress value={order.percentage_shipped} className="h-2" />
                          <span className="text-xs">{order.percentage_shipped}%</span>
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(order.orderDate), { addSuffix: true })}
                      </div>
                    </div>
                  </AccordionTrigger>
                </div>
                
                <AccordionContent className="border-t border-border px-4 py-3">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <ClipboardListIcon className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-medium">{t('partiallyShipped.itemsInOrder')}</h4>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        {t('orders.viewOrderDetails')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/orders/edit/${order.id}`)}
                      >
                        {t('orders.editOrder')}
                      </Button>
                    </div>
                  </div>
                  
                  {renderOrderItems(order)}
                  
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex items-center gap-1"
                      onClick={() => {
                        // Logic to ship the remaining items
                        // This will be implemented later
                        toast({
                          title: t('partiallyShipped.processingShipment'),
                          description: t('partiallyShipped.processingDescription')
                        });
                      }}
                    >
                      <TruckIcon className="h-4 w-4" />
                      {t('partiallyShipped.shipRemainingItems')}
                    </Button>
                  </div>
                </AccordionContent>
              </div>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}