import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, X, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
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
    // Match all needed fields from the JScript content
    const orderMatch = content.match(/Order: ([^\n]+)/);
    const customerMatch = content.match(/Customer: ([^\n]+)/);
    const addressMatch = content.match(/Address: ([^\n]+)/);
    const phoneMatch = content.match(/Phone: ([^\n]+)/);
    const shippingCompanyMatch = content.match(/Shipping: ([^\n]+)/);
    const dateMatch = content.match(/Date: ([^\n]+)/);
    
    // Box information
    const boxMatch = content.match(/BOX (\d+) OF (\d+)/i);
    
    return {
      orderNumber: orderMatch ? orderMatch[1] : '',
      customer: customerMatch ? customerMatch[1] : '',
      address: addressMatch ? addressMatch[1] : '',
      phone: phoneMatch ? phoneMatch[1] : '',
      shippingCompany: shippingCompanyMatch ? shippingCompanyMatch[1] : '',
      date: dateMatch ? dateMatch[1] : '',
      boxNumber: boxMatch ? boxMatch[1] : '1',
      totalBoxes: boxMatch ? boxMatch[2] : '1',
    };
  };
  
  const labelData = extractLabelData(content);
  
  return (
    <div className="bg-white border border-gray-200 rounded-md py-3 px-4 text-black font-sans text-sm space-y-2" 
         style={{ width: '10cm', margin: '0 auto' }}>
      {/* Company Logo */}
      <div className="text-center mb-2">
        <img 
          src={window.location.origin + "/shipping-logo.png"} 
          alt="Company Logo" 
          style={{ 
            height: '40px', 
            maxWidth: '100%', 
            margin: '0 auto',
            objectFit: 'contain'
          }} 
        />
      </div>
      
      {/* Order Information - Made More Prominent */}
      <div style={{ fontWeight: 'bold', fontSize: '14pt', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
        Order: {labelData.orderNumber}
      </div>
      
      {/* Customer Information Section */}
      <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
        Customer: {labelData.customer}
      </div>
      
      {labelData.address && (
        <div style={{ fontSize: '10pt', whiteSpace: 'pre-wrap' }}>
          Address: {labelData.address}
        </div>
      )}
      
      {labelData.phone && (
        <div style={{ fontSize: '10pt' }}>
          Phone: {labelData.phone}
        </div>
      )}
      
      {/* Shipping Company - Very Important */}
      {labelData.shippingCompany && (
        <div style={{ 
          fontSize: '12pt', 
          fontWeight: 'bold', 
          backgroundColor: '#f0f8ff', 
          padding: '3px 5px',
          borderRadius: '3px',
          marginTop: '4px'
        }}>
          Shipping: {labelData.shippingCompany}
        </div>
      )}
      
      {/* Box Information - Highlighted */}
      <div 
        style={{ 
          fontSize: '14pt', 
          fontWeight: 'bold', 
          textAlign: 'center', 
          margin: '10px 0',
          padding: '5px',
          border: '1px solid #ccc',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px'
        }}
      >
        BOX {labelData.boxNumber} OF {labelData.totalBoxes}
      </div>
      
      {/* Date Information */}
      <div style={{ fontSize: '10pt', textAlign: 'right' }}>
        Date: {labelData.date}
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
  const [currentBox, setCurrentBox] = useState(boxNumber);
  const [currentLabelContent, setCurrentLabelContent] = useState(labelContent);
  
  // Update current label content when current box changes
  useEffect(() => {
    setCurrentLabelContent(generateLabelContent(currentBox));
  }, [currentBox]);
  
  // Generate all label contents
  const generateLabelContent = (boxNum: number) => {
    // Create a modified version of the label content for the specified box
    const boxPattern = /BOX \d+ OF \d+/;
    const newBoxText = `BOX ${boxNum} OF ${totalBoxes}`;
    return labelContent.replace(boxPattern, newBoxText);
  };
  
  // Handle navigation between boxes
  const handlePrevBox = () => {
    if (currentBox > 1) {
      setCurrentBox(prev => prev - 1);
    }
  };
  
  const handleNextBox = () => {
    if (currentBox < totalBoxes) {
      setCurrentBox(prev => prev + 1);
    }
  };

  // Handle print action for current label only
  const handlePrintCurrentLabel = () => {
    setIsPrinting(true);
    
    // Print the current box
    const boxContent = generateLabelContent(currentBox);
    const printUrl = `/print-template?content=${encodeURIComponent(boxContent)}&orderNumber=${encodeURIComponent(orderNumber)}&autoPrint=true`;
    window.open(printUrl, '_blank');
    
    // Log the print action to server
    apiRequest({
      url: '/api/orders/log-label-print',
      method: 'POST',
      body: JSON.stringify({
        orderId,
        boxNumber: currentBox,
        boxCount: totalBoxes,
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
      toast({
        title: 'Label Printed',
        description: `Label for Box ${currentBox} of ${totalBoxes} has been sent to printer`,
      });
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Shipping Label Preview</DialogTitle>
          <DialogDescription>
            Order #{orderNumber} - Box {currentBox} of {totalBoxes}
          </DialogDescription>
        </DialogHeader>
        
        {/* Navigation Controls */}
        {totalBoxes > 1 && (
          <div className="flex justify-between items-center border-b pb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevBox}
              disabled={currentBox <= 1 || isPrinting}
              className="flex items-center"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous Box
            </Button>
            
            <div className="font-semibold text-center">
              Box {currentBox} of {totalBoxes}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextBox}
              disabled={currentBox >= totalBoxes || isPrinting}
              className="flex items-center"
            >
              Next Box
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
        
        {/* Label Preview */}
        <div className="py-4">
          <FormattedLabel content={currentLabelContent} />
        </div>
        
        {/* Action Buttons */}
        <DialogFooter className="flex flex-col sm:flex-row gap-2 justify-between">
          <Button 
            variant="default"
            onClick={() => onOpenChange(false)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Finish Label Printing
          </Button>
          
          <Button 
            onClick={handlePrintCurrentLabel}
            disabled={isPrinting}
            className="gap-2"
          >
            {isPrinting ? (
              <span className="animate-spin h-4 w-4 border-2 border-t-transparent rounded-full"></span>
            ) : (
              <Printer className="h-4 w-4" />
            )}
            {isPrinting 
              ? "Printing..." 
              : `Print Box ${currentBox}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShippingLabelPreview;