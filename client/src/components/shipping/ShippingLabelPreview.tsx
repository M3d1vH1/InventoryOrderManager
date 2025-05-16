import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, Download, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useTranslation } from 'react-i18next';

interface ShippingLabelPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labelContent: string;
  orderId: number;
  orderNumber: string;
  boxNumber: number;
  totalBoxes: number;
}

// Component to parse and display the label content in a preview
const FormattedLabel: React.FC<{ content: string }> = ({ content }) => {
  // Extract label data for a clean, consistent preview
  const extractLabelData = (content: string) => {
    const orderMatch = content.match(/Order: ([^\n]+)/);
    const customerMatch = content.match(/Customer: ([^\n]+)/);
    const dateMatch = content.match(/Date: ([^\n]+)/);
    const boxMatch = content.match(/BOX (\d+) OF (\d+)/);
    const idMatch = content.match(/T 25,130,0,3,pt10;(\d+)/);
    
    return {
      orderNumber: orderMatch ? orderMatch[1] : '',
      customer: customerMatch ? customerMatch[1] : '',
      date: dateMatch ? dateMatch[1] : '',
      boxNumber: boxMatch ? boxMatch[1] : '1',
      totalBoxes: boxMatch ? boxMatch[2] : '1',
      orderId: idMatch ? idMatch[1] : '',
    };
  };
  
  const labelData = extractLabelData(content);
  
  return (
    <div className="bg-white border border-gray-200 rounded-md py-3 px-4 text-black font-sans text-sm space-y-2" 
         style={{ width: '8cm', margin: '0 auto' }}>
      <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>
        Order: {labelData.orderNumber}
      </div>
      
      <div style={{ fontSize: '9pt', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        Customer: {labelData.customer}
      </div>
      
      <div style={{ fontSize: '9pt' }}>
        Date: {labelData.date}
      </div>
      
      <div style={{ fontSize: '14pt', fontWeight: 'bold', textAlign: 'center', margin: '6px 0' }}>
        BOX {labelData.boxNumber} OF {labelData.totalBoxes}
      </div>
      
      <div style={{ fontSize: '11pt', fontWeight: 'bold', textAlign: 'center', marginTop: '4px' }}>
        {labelData.orderId}
      </div>
      
      <div style={{ fontSize: '8pt', textAlign: 'center', color: '#666', marginTop: '10px' }}>
        Warehouse Management System
      </div>
      
      <div className="mt-2 text-xs text-gray-400 border-t pt-2 text-center">
        (Preview shows simplified representation of the actual label)
      </div>
    </div>
  );
};

const ShippingLabelPreview: React.FC<ShippingLabelPreviewProps> = ({
  open,
  onOpenChange,
  labelContent,
  orderId,
  orderNumber,
  boxNumber,
  totalBoxes
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isPrinting, setIsPrinting] = useState(false);

  // Handle print action
  const handlePrint = () => {
    setIsPrinting(true);
    
    // Open the print template in a new window
    const printUrl = `/print-template?content=${encodeURIComponent(labelContent)}&orderNumber=${encodeURIComponent(orderNumber)}&autoPrint=true`;
    const printWindow = window.open(printUrl, `_blank_${boxNumber}`);
    
    // Log the print action to server
    apiRequest({
      url: '/api/orders/log-label-print',
      method: 'POST',
      body: JSON.stringify({
        orderId,
        boxCount: totalBoxes,
        currentBox: boxNumber,
        method: 'browser-print'
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch(error => {
      console.error("Failed to log label printing:", error);
    });
    
    // Reset printing state after delay
    setTimeout(() => {
      setIsPrinting(false);
      // Check if window was blocked by popup blocker
      if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
        toast({
          title: t('orders.labels.printError', 'Print Error'),
          description: t('orders.labels.popupBlocked', 'The print window was blocked. Please allow popups for this site and try again.'),
          variant: "destructive",
        });
      }
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('orders.labels.previewTitle', 'Shipping Label Preview')}</DialogTitle>
          <DialogDescription>
            {t('orders.labels.previewDescription', 'Preview for Order')} #{orderNumber} - {t('orders.labels.box', 'Box')} {boxNumber}/{totalBoxes}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <FormattedLabel content={labelContent} />
        </div>
        
        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4 mr-2" />
            {t('common.cancel', 'Cancel')}
          </Button>
          
          <Button 
            onClick={handlePrint}
            disabled={isPrinting}
            className="gap-2"
          >
            {isPrinting ? (
              <span className="animate-spin h-4 w-4 border-2 border-t-transparent rounded-full"></span>
            ) : (
              <Printer className="h-4 w-4" />
            )}
            {isPrinting 
              ? t('orders.labels.printing', 'Printing...') 
              : t('orders.labels.print', 'Print Label')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShippingLabelPreview;