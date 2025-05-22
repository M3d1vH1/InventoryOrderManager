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

  // Auto-preview when box selection changes or when component opens
  React.useEffect(() => {
    if (open && boxCount > 0 && currentBox > 0 && currentBox <= boxCount) {
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        handlePreview();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [currentBox, open, boxCount]);

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
  const handleBrowserPrint = async () => {
    try {
      // First generate the label HTML
      const previewResponse = await apiRequest('/api/preview-label', {
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
      
      if (!previewResponse.success) {
        throw new Error("Failed to generate label content");
      }
      
      // Get the HTML content from the preview
      let labelHtml = "";
      if (previewResponse.isHtml && previewResponse.previewUrl) {
        // Fetch the HTML content
        const response = await fetch(previewResponse.previewUrl);
        labelHtml = await response.text();
      } else {
        // Create a simple HTML with the image
        labelHtml = `
          <html>
            <head>
              <title>Shipping Label - Order ${orderNumber} - Box ${currentBox} of ${boxCount}</title>
              <style>
                body { margin: 0; padding: 0; text-align: center; }
                img { max-width: 100%; height: auto; }
              </style>
            </head>
            <body>
              <img src="${previewResponse.previewUrl}" alt="Shipping Label" />
              <script>
                window.onload = function() {
                  setTimeout(function() { window.print(); }, 500);
                }
              </script>
            </body>
          </html>
        `;
      }
      
      // Open a new window with the content
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(labelHtml);
        printWindow.document.close();
      } else {
        throw new Error("Could not open print window. Please check your popup blocker settings.");
      }
      
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
        title: 'Print Request Sent',
        description: `Label for Box ${currentBox} of ${boxCount} has been opened for printing`
      });
    } catch (error) {
      console.error("Error printing label:", error);
      toast({
        title: 'Printing Error',
        description: error.message || 'Failed to print label',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] md:max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('labels.title', 'Print Shipping Label')}</DialogTitle>
          <DialogDescription>
            {`Print shipping labels for order ${orderNumber}`}
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
                <div className="overflow-y-auto max-h-[350px]">
                  <iframe
                    src={previewUrl}
                    className="w-full h-[350px] border"
                    title="Label Preview"
                    style={{ transform: 'scale(0.95)', transformOrigin: 'top center' }}
                  ></iframe>
                </div>
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

        <DialogFooter className="flex flex-col space-y-4 w-full items-center sm:items-stretch">
          {/* Navigation Controls */}
          <div className="flex w-full justify-between items-center border-b pb-3 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevBox}
              disabled={currentBox <= 1}
              className="flex items-center"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous Box
            </Button>
            
            <div className="font-semibold text-center">
              Box {currentBox} of {boxCount}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextBox}
              disabled={currentBox >= boxCount}
              className="flex items-center"
            >
              Next Box
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          
          {/* Action Buttons */}
          <div className="flex w-full justify-between items-center">
            <Button
              variant="default"
              onClick={() => onOpenChange(false)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Finish Label Printing
            </Button>
            
            <div className="flex space-x-2">
              <Button
                onClick={() => {
                  // Redirect to the new shipping label system
                  window.open(`/shipping-label/${orderId}?box=${currentBox}&total=${boxCount}`, '_blank');
                  
                  // Log the action
                  apiRequest({
                    url: '/api/orders/log-label-print',
                    method: 'POST',
                    body: JSON.stringify({
                      orderId,
                      boxNumber: currentBox,
                      boxCount,
                      method: 'new-system-redirect'
                    }),
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  }).catch(error => {
                    console.error("Failed to log label redirect:", error);
                  });
                  
                  // Show success message
                  toast({
                    title: 'Using new label system',
                    description: 'Opening the new shipping label page'
                  });
                  
                  // Close the modal
                  onOpenChange(false);
                }}
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                Open New Label System
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LabelPreviewModal;