import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LabelPreviewModal from '@/components/shipping/LabelPreviewModal';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

const TestLabelPrint: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [orderId, setOrderId] = useState<number>(93); // Default to order #93
  const [orderNumber, setOrderNumber] = useState<string>('93');
  const [showLabelModal, setShowLabelModal] = useState<boolean>(false);

  const handleOpenModal = () => {
    if (!orderId) {
      toast({
        title: 'Error',
        description: 'Please enter a valid order ID',
        variant: 'destructive'
      });
      return;
    }
    setShowLabelModal(true);
  };

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Label Printing Test Page</h1>
      
      <div className="grid gap-4 max-w-md">
        <div className="space-y-2">
          <label htmlFor="orderId" className="text-sm font-medium">
            Order ID
          </label>
          <Input
            id="orderId"
            type="number"
            min="1"
            value={orderId}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              setOrderId(value);
              setOrderNumber(value.toString());
            }}
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="orderNumber" className="text-sm font-medium">
            Order Number
          </label>
          <Input
            id="orderNumber"
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
          />
        </div>
        
        <Button 
          onClick={handleOpenModal}
          className="mt-4"
        >
          Open Label Preview
        </Button>
      </div>
      
      {/* Label Preview Modal */}
      {showLabelModal && (
        <LabelPreviewModal
          open={showLabelModal}
          onOpenChange={setShowLabelModal}
          orderId={orderId}
          orderNumber={orderNumber}
        />
      )}
    </div>
  );
};

export default TestLabelPrint;