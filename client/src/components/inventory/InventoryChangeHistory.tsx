import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

// Inventory change interface matching our backend schema
interface InventoryChange {
  id: number;
  productId: number;
  userId: number;
  changeType: 'manual_adjustment' | 'order_fulfillment' | 'order_cancellation' | 'stock_replenishment' | 'inventory_correction' | 'return' | 'error_adjustment' | 'other';
  previousQuantity: number;
  newQuantity: number;
  quantityChanged: number;
  timestamp: string;
  reference?: string;
  notes?: string;
  userName?: string; // Joined from users table
}

interface InventoryChangeHistoryProps {
  productId: number;
}

export function InventoryChangeHistory({ productId }: InventoryChangeHistoryProps) {
  const { t } = useTranslation();
  
  // Fetch inventory changes for this product
  const { data: inventoryChanges = [], isLoading, error } = useQuery({
    queryKey: ['/api/inventory-changes', productId],
    queryFn: async () => {
      const response = await fetch(`/api/inventory-changes?productId=${productId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch inventory changes');
      }
      return response.json() as Promise<InventoryChange[]>;
    }
  });

  // Get the translated change type names
  const getChangeTypeName = (changeType: InventoryChange['changeType']) => {
    const changeTypeMap: Record<InventoryChange['changeType'], string> = {
      'manual_adjustment': t('inventory.changeTypes.manualAdjustment'),
      'order_fulfillment': t('inventory.changeTypes.orderFulfillment'),
      'order_cancellation': t('inventory.changeTypes.orderCancellation'),
      'stock_replenishment': t('inventory.changeTypes.stockReplenishment'),
      'inventory_correction': t('inventory.changeTypes.inventoryCorrection'),
      'return': t('inventory.changeTypes.return'),
      'error_adjustment': t('inventory.changeTypes.errorAdjustment'),
      'other': t('inventory.changeTypes.other')
    };
    return changeTypeMap[changeType] || changeType;
  };

  // Get the appropriate variant for badges based on change type
  const getChangeTypeVariant = (changeType: InventoryChange['changeType']): "default" | "outline" | "secondary" | "destructive" => {
    switch (changeType) {
      case 'manual_adjustment':
        return "outline";
      case 'order_fulfillment':
        return "secondary";
      case 'stock_replenishment':
        return "default";
      case 'inventory_correction':
        return "outline";
      case 'error_adjustment':
        return "destructive";
      case 'return':
        return "default";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <div className="w-full flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">{t('common.error')}</CardTitle>
          <CardDescription>
            {t('inventory.errorLoadingChanges')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (inventoryChanges.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t('inventory.noChangesTitle')}</CardTitle>
          <CardDescription>
            {t('inventory.noChangesDescription')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t('inventory.changesHistoryTitle')}</CardTitle>
        <CardDescription>
          {t('inventory.changesHistoryDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption>{t('inventory.changesTableCaption')}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t('inventory.dateTime')}</TableHead>
              <TableHead>{t('inventory.changeType')}</TableHead>
              <TableHead className="text-right">{t('inventory.previousQty')}</TableHead>
              <TableHead className="text-right">{t('inventory.newQty')}</TableHead>
              <TableHead className="text-right">{t('inventory.change')}</TableHead>
              <TableHead>{t('inventory.changedBy')}</TableHead>
              <TableHead>{t('inventory.reference')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventoryChanges.map((change) => (
              <TableRow key={change.id}>
                <TableCell className="font-medium">
                  {format(new Date(change.timestamp), 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  <Badge variant={getChangeTypeVariant(change.changeType)}>
                    {getChangeTypeName(change.changeType)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{change.previousQuantity}</TableCell>
                <TableCell className="text-right">{change.newQuantity}</TableCell>
                <TableCell 
                  className={`text-right font-medium ${change.quantityChanged > 0 ? 'text-green-600' : change.quantityChanged < 0 ? 'text-red-600' : ''}`}
                >
                  {change.quantityChanged > 0 ? '+' : ''}{change.quantityChanged}
                </TableCell>
                <TableCell>{change.userName || `ID: ${change.userId}`}</TableCell>
                <TableCell className="max-w-[150px] truncate" title={change.reference || ''}>
                  {change.reference || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}