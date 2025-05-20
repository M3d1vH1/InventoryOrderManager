import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

interface MultiLabelPrintingProps {
  orderId: number;
  orderNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

const MultiLabelPrinting: React.FC<MultiLabelPrintingProps> = ({ 
  orderId, 
  orderNumber, 
  isOpen, 
  onClose 
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [boxCount, setBoxCount] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewReady, setPreviewReady] = useState<boolean>(false);

  // Handle box count change
  const handleBoxCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setBoxCount(isNaN(value) || value < 1 ? 1 : value);
  };

  // Generate previews for all labels
  const generatePreviews = async () => {
    if (boxCount < 1) {
      toast({
        title: t('orders.errors.invalidBoxCount', 'Invalid Box Count'),
        description: t('orders.errors.invalidBoxCountDescription', 'Box count must be at least 1'),
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setPreviewUrls([]);
    setPreviewReady(false);
    
    try {
      const urls: string[] = [];
      
      // Generate preview for each box
      for (let i = 1; i <= boxCount; i++) {
        const response = await fetch('/api/preview-label', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId,
            boxCount,
            currentBox: i,
          }),
        });
        
        if (!response.ok) {
          throw new Error(t('orders.errors.previewFailed', 'Failed to generate label preview'));
        }
        
        const data = await response.json();
        
        if (data.success && data.previewUrl) {
          urls.push(data.previewUrl);
        } else {
          throw new Error(data.error || t('orders.errors.previewFailed', 'Failed to generate label preview'));
        }
        
        // Update progress
        setProgress(Math.round((i / boxCount) * 100));
      }
      
      setPreviewUrls(urls);
      setPreviewReady(true);
      setIsGenerating(false);
      
    } catch (error) {
      console.error('Error generating previews:', error);
      setIsGenerating(false);
      
      toast({
        title: t('orders.errors.generic', 'Error'),
        description: String(error) || t('orders.errors.genericPrintError', 'An error occurred while generating shipping labels'),
        variant: "destructive",
      });
    }
  };

  // Print all labels
  const printAllLabels = () => {
    if (!previewReady || previewUrls.length === 0) {
      return;
    }

    // Create a new window with all labels
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      toast({
        title: t('orders.errors.popupBlocked', 'Popup Blocked'),
        description: t('orders.errors.popupBlockedDescription', 'Please allow popups for this site to print labels'),
        variant: "destructive",
      });
      return;
    }
    
    // Create HTML content with all labels
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Labels - Order ${orderNumber}</title>
        <style>
          @page {
            size: 9cm 6cm;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background-color: white;
          }
          .label-container {
            page-break-after: always;
            width: 9cm;
            height: 6cm;
            position: relative;
            box-sizing: border-box;
            overflow: hidden;
          }
          .label-container:last-child {
            page-break-after: avoid;
          }
          .label-iframe {
            border: none;
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
    `;
    
    // Add each label as a div with page break
    previewUrls.forEach((url, index) => {
      htmlContent += `
        <div class="label-container">
          <iframe src="${url}" class="label-iframe" frameborder="0"></iframe>
        </div>
      `;
    });
    
    htmlContent += `
        <script>
          window.onload = function() {
            // Wait a moment for iframes to load then print
            setTimeout(function() {
              window.print();
              // Close window after printing (or if print is cancelled)
              setTimeout(function() {
                window.close();
              }, 1000);
            }, 1000);
          };
        </script>
      </body>
      </html>
    `;
    
    // Write content to the new window
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Show success message
    toast({
      title: t('orders.labels.success', 'Labels Ready'),
      description: t('orders.labels.batchSuccessDescription', 'All {{count}} shipping labels have been sent to print', { count: boxCount }),
    });
    
    // Close the dialog
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('orders.labels.title', 'Print Shipping Labels')}
          </DialogTitle>
          <DialogDescription>
            {t('orders.labels.description', 'Print shipping labels for order {{orderNumber}}', { orderNumber })}
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
              min="1"
              value={boxCount}
              onChange={handleBoxCountChange}
              className="col-span-3"
              disabled={isGenerating}
            />
          </div>
          
          <div className="text-sm text-muted-foreground">
            {t('orders.labels.boxCountHelp', 'Labels will be printed with order number, customer name, and box numbers.')}
          </div>
          
          {isGenerating && (
            <div className="space-y-2 py-2">
              <div className="flex items-center justify-between text-sm">
                <span>{t('orders.labels.generating', 'Generating labels')}...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-end">
          {!previewReady ? (
            <Button 
              onClick={generatePreviews} 
              disabled={isGenerating || boxCount < 1}
              className="w-full sm:w-auto"
            >
              {isGenerating ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  {t('orders.labels.previewing', 'Generating Preview...')}
                </>
              ) : (
                t('orders.labels.preview', 'Preview Labels')
              )}
            </Button>
          ) : (
            <Button 
              onClick={printAllLabels} 
              className="w-full sm:w-auto"
            >
              {t('orders.labels.printBatch', 'Print All Labels')} ({boxCount})
            </Button>
          )}
          
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="w-full sm:w-auto"
            disabled={isGenerating}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MultiLabelPrinting;