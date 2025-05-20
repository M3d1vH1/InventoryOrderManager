import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Printer, Eye } from 'lucide-react';

interface LabelPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number;
  orderNumber: string;
}

const LabelPreviewModal: React.FC<LabelPreviewModalProps> = ({ 
  open, 
  onOpenChange, 
  orderId,
  orderNumber 
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [boxCount, setBoxCount] = useState<number>(1);
  const [currentBox, setCurrentBox] = useState<number>(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isHtmlPreview, setIsHtmlPreview] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [printing, setPrinting] = useState<boolean>(false);

  // Generate preview
  const handlePreview = async () => {
    setLoading(true);
    try {
      const response = await apiRequest('/api/preview-label', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          boxCount,
          currentBox
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.success) {
        setPreviewUrl(response.previewUrl);
        setIsHtmlPreview(response.isHtml || false);
        toast({
          title: t('preview.success'),
          description: t('preview.successDescription')
        });
      } else {
        toast({
          title: t('preview.error'),
          description: response.error || t('preview.errorDescription'),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      toast({
        title: t('preview.error'),
        description: t('preview.errorDescription'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Print current label
  const handlePrint = async () => {
    setPrinting(true);
    try {
      const response = await apiRequest('/api/print-label', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          boxCount,
          currentBox
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.success) {
        toast({
          title: t('printing.success'),
          description: t('printing.successDescription')
        });
      } else {
        toast({
          title: t('printing.error'),
          description: response.error || t('printing.errorDescription'),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error printing label:', error);
      toast({
        title: t('printing.error'),
        description: t('printing.errorDescription'),
        variant: 'destructive'
      });
    } finally {
      setPrinting(false);
    }
  };

  // Print all labels in batch
  const handlePrintBatch = async () => {
    setPrinting(true);
    try {
      const response = await apiRequest('/api/print-batch-labels', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          boxCount
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.success) {
        toast({
          title: t('printing.batchSuccess'),
          description: t('printing.batchSuccessDescription', { count: boxCount })
        });
      } else {
        toast({
          title: t('printing.batchError'),
          description: response.error || t('printing.batchErrorDescription'),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error printing batch labels:', error);
      toast({
        title: t('printing.batchError'),
        description: t('printing.batchErrorDescription'),
        variant: 'destructive'
      });
    } finally {
      setPrinting(false);
    }
  };

  // Auto-preview when box selection changes
  React.useEffect(() => {
    if (open && boxCount > 0 && currentBox > 0 && currentBox <= boxCount) {
      handlePreview();
    }
  }, [currentBox, open]);

  // Reset form data when the modal opens
  React.useEffect(() => {
    if (open) {
      setBoxCount(1);
      setCurrentBox(1);
      setPreviewUrl(null);
    }
  }, [open]);
  
  // Handle navigation between boxes
  const handlePrevBox = () => {
    if (currentBox > 1) {
      setCurrentBox(prev => prev - 1);
    }
  };
  
  const handleNextBox = () => {
    if (currentBox < boxCount) {
      setCurrentBox(prev => prev + 1);
    }
  };
  
  // Handle printing with browser
  const handleBrowserPrint = () => {
    // Open a new print template window
    const printUrl = `/print-template?orderId=${orderId}&boxNumber=${currentBox}&boxCount=${boxCount}&autoPrint=true`;
    window.open(printUrl, '_blank');
    
    // Log the print action to server
    apiRequest({
      url: '/api/orders/log-label-print',
      method: 'POST',
      body: JSON.stringify({
        orderId,
        boxNumber: currentBox,
        boxCount,
        method: 'browser-print'
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch(error => {
      console.error("Failed to log label printing:", error);
    });
    
    toast({
      title: t('printing.success', 'Print Request Sent'),
      description: t('printing.successDescription', 'Label has been sent to printer')
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('labels.title', 'Print Shipping Label')}</DialogTitle>
          <DialogDescription>
            {t('labels.description', { orderNumber }, `Print shipping labels for order ${orderNumber}`)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="boxCount" className="text-sm font-medium">
                {t('labels.boxCount', 'Total Box Count')}
              </label>
              <Input
                id="boxCount"
                type="number"
                min="1"
                value={boxCount}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setBoxCount(value > 0 ? value : 1);
                  if (currentBox > value) {
                    setCurrentBox(value);
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('labels.navigation', 'Label Navigation')}
              </label>
              <div className="flex items-center space-x-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={currentBox <= 1}
                  onClick={handlePrevBox}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex-1 text-center font-medium">
                  {t('labels.boxIndicator', 'Box {{current}} of {{total}}', { 
                    current: currentBox, 
                    total: boxCount 
                  })}
                </div>
                
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={currentBox >= boxCount}
                  onClick={handleNextBox}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="h-[400px] flex items-center justify-center border rounded-md p-6">
              <div className="text-center space-y-3">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                <div>{t('labels.generatingPreview', 'Generating label preview...')}</div>
              </div>
            </div>
          ) : previewUrl ? (
            <div className="border rounded-md p-2">
              <div className="text-sm font-medium mb-2 flex justify-between items-center">
                <span>{t('labels.previewTitle', 'Label Preview')}</span>
                <span className="text-sm text-muted-foreground">
                  {t('labels.boxIndicator', 'Box {{current}} of {{total}}', { 
                    current: currentBox, 
                    total: boxCount 
                  })}
                </span>
              </div>
              {isHtmlPreview ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[400px] border"
                  title="Label Preview"
                ></iframe>
              ) : (
                <img 
                  src={previewUrl} 
                  alt="Label Preview" 
                  className="max-w-full h-auto"
                />
              )}
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center border rounded-md">
              <Button 
                variant="outline" 
                onClick={handlePreview}
              >
                <Eye className="mr-2 h-4 w-4" />
                {t('labels.generatePreview', 'Generate Preview')}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between items-center">
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleBrowserPrint}
              disabled={!previewUrl || printing}
            >
              <Printer className="mr-2 h-4 w-4" />
              {t('labels.printInBrowser', 'Print in Browser')}
            </Button>
            
            <Button
              onClick={handlePrint}
              disabled={!previewUrl || printing}
              className="gap-2"
            >
              {printing ? (
                <span className="animate-spin h-4 w-4 border-2 border-t-transparent rounded-full"></span>
              ) : (
                <Printer className="h-4 w-4" />
              )}
              {printing ? t('labels.printing', 'Printing...') : t('labels.print', 'Print Label')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LabelPreviewModal;