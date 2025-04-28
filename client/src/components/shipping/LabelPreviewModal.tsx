import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useTranslation } from 'react-i18next';

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

  // Reset form data when the modal opens
  React.useEffect(() => {
    if (open) {
      setBoxCount(1);
      setCurrentBox(1);
      setPreviewUrl(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('labels.title')}</DialogTitle>
          <DialogDescription>
            {t('labels.description', { orderNumber })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="boxCount" className="text-sm font-medium">
                {t('labels.boxCount')}
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
              <label htmlFor="currentBox" className="text-sm font-medium">
                {t('labels.currentBox')}
              </label>
              <Input
                id="currentBox"
                type="number"
                min="1"
                max={boxCount}
                value={currentBox}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value > 0 && value <= boxCount) {
                    setCurrentBox(value);
                  }
                }}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={loading}
            >
              {loading ? t('labels.previewing') : t('labels.preview')}
            </Button>
          </div>

          {previewUrl && (
            <div className="mt-4 border rounded-md p-2">
              <div className="text-sm font-medium mb-2">{t('labels.previewTitle')}</div>
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
          )}
        </div>

        <DialogFooter className="space-x-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="mt-2"
          >
            {t('common.cancel')}
          </Button>
          
          <Button
            onClick={handlePrint}
            disabled={printing}
            className="mt-2"
          >
            {printing ? t('labels.printing') : t('labels.print')}
          </Button>
          
          {boxCount > 1 && (
            <Button
              onClick={handlePrintBatch}
              disabled={printing}
              variant="default"
              className="mt-2"
            >
              {printing ? t('labels.printingBatch') : t('labels.printBatch')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LabelPreviewModal;