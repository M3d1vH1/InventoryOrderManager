import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, AlertTriangle, PackagePlus, Check, X, Info, TrendingUp, TrendingDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { ScanMode } from "../barcode/EnhancedBarcodeScanner";

interface ProductLookupProps {
  isOpen: boolean;
  onClose: () => void;
  barcode: string | null;
  scanMode: ScanMode;
}

interface ProductData {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  currentStock: number;
  minStockLevel: number;
  description: string | null;
  location: string | null;
  unitsPerBox: number | null;
  tags: string[] | null;
  categoryName: string | null;
  lastStockUpdate: string | null;
  imagePath: string | null;
  movementTrend?: 'up' | 'down' | 'stable';
  averageDailySales?: number;
}

const ProductLookup: React.FC<ProductLookupProps> = ({
  isOpen,
  onClose,
  barcode,
  scanMode
}) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState<number>(1);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [actionCompleted, setActionCompleted] = useState<boolean>(false);

  // Fetch product data
  const { data: product, isLoading, isError, error } = useQuery({
    queryKey: ['product', barcode],
    queryFn: async () => {
      if (!barcode) return null;
      const response = await apiRequest(`/api/products/barcode/${barcode}`);
      return response as ProductData;
    },
    enabled: !!barcode && isOpen,
  });

  const handleAction = async () => {
    if (!product) return;
    
    try {
      let actionUrl = '';
      let actionData = {};
      
      switch (scanMode) {
        case 'inventory':
          actionUrl = '/api/inventory/update';
          actionData = { 
            productId: product.id, 
            newQuantity: quantity,
            adjustmentType: 'count'
          };
          break;
        case 'picking':
          actionUrl = '/api/inventory/pick';
          actionData = { 
            productId: product.id, 
            quantity: quantity
          };
          break;
        case 'receiving':
          actionUrl = '/api/inventory/receive';
          actionData = { 
            productId: product.id, 
            quantity: quantity
          };
          break;
        default:
          // For lookup mode, no action needed
          return;
      }
      
      // Only make request if we have an action URL (not in lookup mode)
      if (actionUrl) {
        await apiRequest(actionUrl, {
          method: 'POST',
          data: actionData
        });
        
        toast({
          title: t("productLookup.actionSuccess"),
          description: t(`productLookup.${scanMode}Success`, { quantity, product: product.name }),
        });
        
        setActionCompleted(true);
      }
    } catch (err) {
      toast({
        title: t("productLookup.actionFailed"),
        description: t("productLookup.tryAgain"),
        variant: "destructive",
      });
    }
  };

  const getStockStatusColor = () => {
    if (!product) return 'bg-gray-200';
    
    if (product.currentStock <= 0) {
      return 'bg-red-500';
    } else if (product.currentStock < product.minStockLevel) {
      return 'bg-amber-500';
    } else if (product.currentStock < product.minStockLevel * 2) {
      return 'bg-green-300';
    } else {
      return 'bg-green-500';
    }
  };

  const getStockPercentage = () => {
    if (!product || product.minStockLevel === 0) return 0;
    // Cap at 100% when stock is double the min level or more
    return Math.min(100, (product.currentStock / (product.minStockLevel * 2)) * 100);
  };

  const renderActionButtons = () => {
    if (actionCompleted) {
      return (
        <div className="flex flex-col items-center justify-center py-4">
          <div className="rounded-full bg-green-100 p-3 mb-2">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-center text-green-700 font-medium">
            {t("productLookup.actionCompleted")}
          </p>
          <Button onClick={onClose} className="mt-4">
            {t("productLookup.close")}
          </Button>
        </div>
      );
    }

    if (scanMode === 'lookup') {
      return (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Button variant="outline" onClick={onClose}>
            {t("productLookup.close")}
          </Button>
          <Button onClick={() => window.location.href = `/inventory?id=${product?.id}`}>
            {t("productLookup.viewDetails")}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <div className="mt-4">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium">{t("productLookup.quantity")}:</label>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
            >
              -
            </Button>
            <span className="w-8 text-center font-medium">{quantity}</span>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setQuantity(q => q + 1)}
            >
              +
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onClose}>
            {t("productLookup.cancel")}
          </Button>
          <Button onClick={() => setShowConfirm(true)}>
            {scanMode === 'inventory' && t("productLookup.updateCount")}
            {scanMode === 'picking' && t("productLookup.confirmPick")}
            {scanMode === 'receiving' && t("productLookup.confirmReceive")}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {scanMode === 'lookup' && t("productLookup.title.lookup")}
            {scanMode === 'inventory' && t("productLookup.title.inventory")}
            {scanMode === 'picking' && t("productLookup.title.picking")}
            {scanMode === 'receiving' && t("productLookup.title.receiving")}
          </DialogTitle>
        </DialogHeader>
        
        {isLoading && (
          <div className="py-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        
        {isError && (
          <div className="py-8">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
              <h3 className="font-medium text-lg">{t("productLookup.productNotFound")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("productLookup.barcodeNotFound", { barcode })}
              </p>
              <Button onClick={onClose} className="mt-4">
                {t("productLookup.close")}
              </Button>
            </div>
          </div>
        )}
        
        {!isLoading && !isError && product && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between">
                  <div>
                    <CardTitle>{product.name}</CardTitle>
                    <CardDescription>
                      {t("productLookup.sku")}: {product.sku}
                    </CardDescription>
                  </div>
                  {product.imagePath && (
                    <div className="h-12 w-12 overflow-hidden rounded-md">
                      <img 
                        src={product.imagePath} 
                        alt={product.name} 
                        className="h-full w-full object-cover"
                        onError={(e) => (e.target as HTMLImageElement).src = '/placeholder-product.png'}
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm">{t("productLookup.stockLevel")}</span>
                    <div className="flex items-center space-x-1">
                      {product.movementTrend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
                      {product.movementTrend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                      <span className="font-mono font-medium text-sm">
                        {product.currentStock} / {product.minStockLevel}
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={getStockPercentage()} 
                    className={`h-2 ${getStockStatusColor()}`}
                  />
                </div>
                
                {product.location && (
                  <div className="flex items-center text-sm mb-2">
                    <span className="font-medium mr-2">{t("productLookup.location")}:</span>
                    <span>{product.location}</span>
                  </div>
                )}
                
                {product.unitsPerBox && (
                  <div className="flex items-center text-sm mb-2">
                    <span className="font-medium mr-2">{t("productLookup.unitsPerBox")}:</span>
                    <span>{product.unitsPerBox}</span>
                  </div>
                )}
                
                {product.categoryName && (
                  <div className="flex items-center text-sm mb-2">
                    <span className="font-medium mr-2">{t("productLookup.category")}:</span>
                    <span>{product.categoryName}</span>
                  </div>
                )}
                
                {product.tags && product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {product.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center text-xs text-slate-500 mt-2">
                  <Info className="h-3 w-3 mr-1" />
                  {product.lastStockUpdate ? (
                    <span>
                      {t("productLookup.lastUpdated")}: {new Date(product.lastStockUpdate).toLocaleDateString()}
                    </span>
                  ) : (
                    <span>{t("productLookup.noStockHistory")}</span>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                {renderActionButtons()}
              </CardFooter>
            </Card>
          </div>
        )}
        
        {/* Confirmation Dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t("productLookup.confirm.title")}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>
                {scanMode === 'inventory' && t("productLookup.confirm.inventory", { quantity, product: product?.name })}
                {scanMode === 'picking' && t("productLookup.confirm.picking", { quantity, product: product?.name })}
                {scanMode === 'receiving' && t("productLookup.confirm.receiving", { quantity, product: product?.name })}
              </p>
              
              {scanMode === 'picking' && product && quantity > product.currentStock && (
                <div className="flex items-center mt-3 p-2 rounded bg-amber-50 text-amber-800 text-sm">
                  <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>{t("productLookup.insufficientStock")}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                {t("productLookup.cancel")}
              </Button>
              <Button onClick={handleAction}>
                {t("productLookup.confirm.action")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

export default ProductLookup;