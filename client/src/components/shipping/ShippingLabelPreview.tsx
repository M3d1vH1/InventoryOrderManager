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
  // Attempt to parse JScript commands for a visual preview
  try {
    // Very basic parsing - extract text lines that start with T
    const textLines: Array<{content: string}> = [];
    const lines = content.split('\n');
    
    lines.forEach(line => {
      if (line.trim().startsWith('T ')) {
        const textMatch = line.match(/T\s+\d+,\d+,\d+,\d+,[^;]*;(.*)/);
        if (textMatch && textMatch[1]) {
          textLines.push({ content: textMatch[1] });
        }
      }
    });
    
    return (
      <div className="bg-white border border-gray-200 rounded-md p-4 text-black font-mono text-sm space-y-1">
        {textLines.map((line, index) => (
          <div key={index}>{line.content}</div>
        ))}
        <div className="mt-2 text-xs text-gray-400">
          (Preview may differ from actual printed label)
        </div>
      </div>
    );
  } catch (error) {
    // Fallback to raw content if parsing fails
    return (
      <pre className="bg-white border border-gray-200 rounded-md p-4 text-black font-mono text-sm overflow-x-auto">
        {content}
      </pre>
    );
  }
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