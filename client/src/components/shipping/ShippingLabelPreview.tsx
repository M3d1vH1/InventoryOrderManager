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
      <div style={{ 
        fontSize: '12pt', 
        fontWeight: 'bold', 
        backgroundColor: '#f0f8ff', 
        padding: '3px 5px',
        borderRadius: '3px',
        marginTop: '4px'
      }}>
        Shipping: N/A
      </div>
      
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
    
    // Extract all needed data from the label content
    const extractedData = extractDataFromLabel(labelContent);
    
    // Helper function to extract data from label content
    function extractDataFromLabel(content) {
      const customerMatch = content.match(/Customer: ([^\n]+)/);
      const addressMatch = content.match(/Address: ([^\n]+)/);
      const phoneMatch = content.match(/Phone: ([^\n]+)/);
      
      // For shipping company, check for multiple formats in the content
      // Use empty string as default so we can get the actual value from the database
      let shippingCompany = "";
      
      // First try the standard format
      const shippingMatch = content.match(/Shipping: ([^\n]+)/);
      if (shippingMatch && shippingMatch[1] && shippingMatch[1].trim() !== "N/A") {
        shippingCompany = shippingMatch[1];
      } 
      // Then try other potential formats that might be in the label content
      else {
        const altShippingMatch1 = content.match(/Shipping Company: ([^\n]+)/);
        const altShippingMatch2 = content.match(/Ship via: ([^\n]+)/);
        const altShippingMatch3 = content.match(/Carrier: ([^\n]+)/);
        
        if (altShippingMatch1 && altShippingMatch1[1] && altShippingMatch1[1].trim() !== "N/A") {
          shippingCompany = altShippingMatch1[1];
        } else if (altShippingMatch2 && altShippingMatch2[1] && altShippingMatch2[1].trim() !== "N/A") {
          shippingCompany = altShippingMatch2[1];
        } else if (altShippingMatch3 && altShippingMatch3[1] && altShippingMatch3[1].trim() !== "N/A") {
          shippingCompany = altShippingMatch3[1];
        }
      }
      
      return {
        customerName: customerMatch ? customerMatch[1] : "Unknown Customer",
        customerAddress: addressMatch ? addressMatch[1] : "No Address",
        customerPhone: phoneMatch ? phoneMatch[1] : "No Phone",
        shippingCompany: shippingCompany
      };
    }
    
    // Use extracted data
    const { customerName, customerAddress, customerPhone, shippingCompany } = extractedData;
    
    // Create a simple HTML label with CSS matching the preview
    const htmlLabel = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Shipping Label - Order ${orderNumber}</title>
        <style>
          @page {
            size: 9cm 6cm;
            margin: 0 auto; /* Center horizontally on the page */
          }
          body {
            margin: 0 auto; /* Center horizontally */
            padding: 0;
            font-family: Arial, sans-serif;
            width: 9cm;
            height: 6cm;
            box-sizing: border-box;
            transform: translateY(-3mm) scale(0.85); /* Further reduced to 0.85 to fit content on label */
            transform-origin: top center;
            display: flex;
            justify-content: center; /* Center content horizontally */
          }
          .label-container {
            padding: 0.3cm;
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            background-color: white;
            margin: 0 auto; /* Center the container */
          }
          .logo {
            text-align: center;
            margin-top: 0.2cm;
            margin-bottom: 0.2cm;
          }
          .logo img {
            height: 1.30cm; /* Reduced by 10% from 1.44cm */
            max-width: 85%; /* Slightly reduced max-width */
          }
          .order-number {
            font-size: 13.3pt; /* Reduced by 20% from 16.63pt */
            font-weight: bold;
            margin-bottom: 0.1cm;
            border-bottom: 1px solid #eee;
            padding-bottom: 0.1cm;
          }
          .customer {
            font-size: 11.7pt; /* Reduced by 20% from 14.63pt */
            font-weight: bold;
            margin-bottom: 0.1cm;
          }
          .address, .phone {
            font-size: 10.65pt; /* Reduced by 20% from 13.31pt */
            margin-bottom: 0.1cm;
          }
          .shipping {
            font-size: 11.7pt; /* Reduced by 20% from 14.63pt */
            font-weight: bold;
            padding: 2px 4px;
            margin-top: 0.1cm;
            margin-bottom: 0.2cm;
          }
          .box-number {
            font-size: 13.3pt; /* Reduced by 20% from 16.63pt */
            font-weight: bold;
            text-align: center;
            margin-top: 0.2cm;
            margin-bottom: 0.2cm;
            padding: 4px;
            border: 1px solid #ccc;
            background-color: #f5f5f5;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="label-container">
          <div class="logo">
            <img src="/shipping-logo.png" onerror="this.src='/simple-logo.svg'; this.onerror=function(){this.outerHTML='<div style=\\'font-weight:bold;font-size:12pt;\\'>OLIVE OIL COMPANY</div>'}">
          </div>
          <div class="order-number">Order: ${orderNumber}</div>
          <div class="customer">Customer: ${customerName}</div>
          <div class="address">Address: ${customerAddress}</div>
          <div class="phone">Phone: ${customerPhone}</div>
          <div class="shipping">Shipping: ${shippingCompany}</div>
          <div class="box-number">BOX ${currentBox} OF ${totalBoxes}</div>
        </div>
      </body>
      </html>
    `;
    
    // Create a new window to print from with a small size to force our styles to apply
    const printWindow = window.open('', '_blank', 'width=600,height=400');
    if (printWindow) {
      printWindow.document.write(htmlLabel);
      printWindow.document.close();
      
      // Add a script to directly manipulate the print scale
      const scaleScript = printWindow.document.createElement('script');
      scaleScript.textContent = `
        // Force a small print scale
        function beforePrint() {
          document.body.style.zoom = "0.70"; // Apply a 70% zoom to make content smaller
          document.body.style.width = "8cm";
          document.body.style.transform = "scale(0.70)";
          document.body.style.transformOrigin = "top center";
        }
        
        window.onbeforeprint = beforePrint;
        
        // Call it immediately to ensure it's applied
        beforePrint();
      `;
      printWindow.document.head.appendChild(scaleScript);
      
      // Create an absolute link to the logo to ensure it loads correctly
      const baseUrl = window.location.origin;
      const logoImg = printWindow.document.querySelector('.logo img');
      if (logoImg) {
        logoImg.setAttribute('src', `${baseUrl}/shipping-logo.png`);
        logoImg.setAttribute('onerror', `this.src='${baseUrl}/simple-logo.svg'; this.onerror=function(){this.outerHTML='<div style="font-weight:bold;font-size:12pt;">OLIVE OIL COMPANY</div>'}`);
      }
      
      // Make sure all resources are loaded before printing
      const imgElements = Array.from(printWindow.document.querySelectorAll('img'));
      
      // Function to check if all images are loaded
      const checkAllImagesLoaded = () => {
        const allLoaded = imgElements.every(img => 
          img.complete && (img.naturalWidth > 0 || img.onerror !== null)
        );
        
        if (allLoaded) {
          // Wait for CSS to apply
          setTimeout(() => {
            // Force layout recalculation
            printWindow.document.body.offsetHeight;
            
            printWindow.focus();
            printWindow.print();
            // Close window after printing (or after a delay if print is cancelled)
            setTimeout(() => printWindow.close(), 1000);
          }, 500);
        } else {
          // Check again after a short delay
          setTimeout(checkAllImagesLoaded, 100);
        }
      };
      
      // Start checking if images are loaded
      if (imgElements.length > 0) {
        checkAllImagesLoaded();
      } else {
        // If no images, just print after a delay
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          setTimeout(() => printWindow.close(), 1000);
        }, 500);
      }
    }
    
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