import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface BarcodeGeneratorProps {
  value: string;
  format?: 'CODE128' | 'EAN13' | 'UPC' | 'EAN8' | 'CODE39';
  width?: number;
  height?: number;
  displayValue?: boolean;
  showDownloadButton?: boolean;
  showPrintButton?: boolean;
  className?: string;
}

const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
  value,
  format = 'CODE128',
  width = 2,
  height = 80,
  displayValue = true,
  showDownloadButton = true,
  showPrintButton = true,
  className = ''
}) => {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && value) {
      try {
        JsBarcode(barcodeRef.current, value, {
          format,
          width,
          height,
          displayValue,
          margin: 10,
          background: '#ffffff',
          lineColor: '#000000',
          fontSize: 16,
          textMargin: 8,
        });
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }
  }, [value, format, width, height, displayValue]);

  const handleDownload = () => {
    if (barcodeRef.current) {
      // Get the SVG as a string
      const svgData = new XMLSerializer().serializeToString(barcodeRef.current);
      
      // Create a Blob from the SVG string
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      
      // Create a download link and trigger the download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `barcode-${value}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handlePrint = () => {
    if (barcodeRef.current) {
      const svgData = new XMLSerializer().serializeToString(barcodeRef.current);
      const printWindow = window.open('', '_blank');
      
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Print Barcode</title>
              <style>
                body {
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                }
                @media print {
                  .no-print {
                    display: none;
                  }
                }
              </style>
            </head>
            <body>
              <div>
                ${svgData}
                <div class="no-print" style="text-align: center; margin-top: 20px;">
                  <button onClick="window.print()">Print Barcode</button>
                </div>
              </div>
              <script>
                // Auto print
                setTimeout(() => window.print(), 500);
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  if (!value) {
    return null;
  }

  return (
    <Card className={className}>
      <CardContent className="p-6 flex flex-col items-center">
        <svg ref={barcodeRef} className="w-full max-w-xs"></svg>
        
        {(showDownloadButton || showPrintButton) && (
          <div className="flex space-x-3 mt-4">
            {showDownloadButton && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownload}
              >
                <i className="fas fa-download mr-2"></i>
                Download
              </Button>
            )}
            
            {showPrintButton && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrint}
              >
                <i className="fas fa-print mr-2"></i>
                Print
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BarcodeGenerator;