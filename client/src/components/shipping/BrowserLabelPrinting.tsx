import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Printer, Box } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface BrowserLabelPrintingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number;
  orderNumber: string;
  customerName: string;
  orderDate: Date | string;
  area?: string;
}

const BrowserLabelPrinting: React.FC<BrowserLabelPrintingProps> = ({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  customerName,
  orderDate,
  area
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [boxCount, setBoxCount] = React.useState<number>(1);
  const [isGenerating, setIsGenerating] = React.useState<boolean>(false);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setBoxCount(1);
      setIsGenerating(false);
    }
  }, [open]);

  const handlePrintLabels = () => {
    if (boxCount < 1) {
      toast({
        title: t('orders.errors.generic', 'Error'),
        description: t('orders.errors.invalidBoxCount', 'Box count must be at least 1'),
        variant: "destructive",
      });
      return;
    }

    try {
      setIsGenerating(true);
      
      // Create label for each box
      const createLabelJScript = (boxNumber: number, totalBoxes: number) => {
        const boxInfo = `${boxNumber}/${totalBoxes}`;
        const formattedDate = orderDate instanceof Date 
          ? orderDate.toLocaleDateString() 
          : new Date(orderDate).toLocaleDateString();
        
        // Basic label template for CAB EOS1 printer
        return `m m
J
S l1;0,0,8,15,100
T 20,20,0,3,pt8;Amphoreus
T 20,55,0,3,pt10;${customerName}
T 20,90,0,3,pt8;Order: ${orderNumber}
T 20,120,0,3,pt8;Date: ${formattedDate}
T 20,150,0,3,pt8;Box: ${boxInfo}
B 20,190,0,EAN13,60,0,1,2;${orderNumber.replace(/\D/g, '')}
T 20,270,0,3,pt8;Area: ${area || ''}
A 1`;
      };
      
      // Open browser printing for each label
      for (let i = 1; i <= boxCount; i++) {
        const jscript = createLabelJScript(i, boxCount);
        
        // Use browser-based printing via the PrintTemplate component
        const printUrl = `/print-template?content=${encodeURIComponent(jscript)}&orderNumber=${encodeURIComponent(orderNumber)}&autoPrint=false`;
        
        // Open in a new tab with a slight delay between each to prevent browser blocking
        setTimeout(() => {
          window.open(printUrl, `_blank_${i}`);
        }, i * 300); // 300ms delay between each window
      }
      
      // Close dialog after generating all labels
      setTimeout(() => {
        setIsGenerating(false);
        onOpenChange(false);
        
        toast({
          title: t('orders.labels.success', 'Labels Ready'),
          description: t('orders.labels.successDescription', 'Shipping labels have been opened in new tabs. Click Print in each tab.'),
        });
      }, (boxCount * 300) + 100);
      
    } catch (error) {
      console.error('Error generating labels:', error);
      setIsGenerating(false);
      
      toast({
        title: t('orders.errors.generic', 'Error'),
        description: String(error) || t('orders.errors.genericPrintError', 'An error occurred while generating shipping labels'),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('orders.labels.title', 'Print Shipping Labels')}</DialogTitle>
          <DialogDescription>
            {t('orders.labels.description', 'Generate shipping labels for order')} #{orderNumber}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="boxCount" className="text-right">
              {t('orders.labels.boxCount', 'Number of Boxes')}
            </Label>
            <Input
              id="boxCount"
              type="number"
              min={1}
              value={boxCount}
              onChange={(e) => setBoxCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="col-span-3"
            />
          </div>
          
          <div className="text-sm text-muted-foreground">
            {t('orders.labels.customerInfo', 'Customer')}: {customerName}
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            onClick={() => onOpenChange(false)} 
            variant="outline"
            disabled={isGenerating}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button 
            onClick={handlePrintLabels}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? <span className="animate-spin h-4 w-4 border-2 border-t-transparent rounded-full"></span> : <Printer className="h-4 w-4" />}
            {isGenerating 
              ? t('orders.labels.generating', 'Generating...') 
              : t('orders.labels.print', 'Print Labels')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BrowserLabelPrinting;