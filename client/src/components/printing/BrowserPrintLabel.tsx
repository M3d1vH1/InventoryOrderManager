import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Printer, FileDown, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface BrowserPrintLabelProps {
  labelContent: string;
  orderId?: number;
  orderNumber?: string;
}

const BrowserPrintLabel: React.FC<BrowserPrintLabelProps> = ({ 
  labelContent,
  orderId,
  orderNumber
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Function to generate preview HTML
  const generatePreviewHtml = async (): Promise<string> => {
    // Create a styled HTML document with the label content
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Label Preview ${orderNumber ? `- Order #${orderNumber}` : ''}</title>
        <style>
          @page {
            size: 4in 6in;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: monospace;
            background: white;
          }
          pre {
            white-space: pre;
            font-family: monospace;
            font-size: 10pt;
            margin: 0;
            padding: 10px;
            background: #f4f4f4;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          .label-container {
            padding: 20px;
            max-width: 4in;
          }
          .label-header {
            text-align: center;
            margin-bottom: 15px;
            font-weight: bold;
          }
          .print-only {
            display: none;
          }
          .screen-only {
            display: block;
            margin-bottom: 15px;
            padding: 10px;
            background: #e9f7ff;
            border: 1px solid #a8d2f0;
            border-radius: 4px;
            color: #0c5a93;
          }
          .barcode-placeholder {
            height: 80px;
            border: 1px dashed #ccc;
            margin: 10px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-style: italic;
            color: #666;
          }
          @media print {
            .screen-only {
              display: none !important;
            }
            .print-only {
              display: block;
            }
            pre {
              border: none;
              background: none;
              font-size: 9pt;
            }
          }
        </style>
      </head>
      <body>
        <div class="label-container">
          <div class="screen-only">
            <h3>CAB EOS 1 Label Preview</h3>
            <p>This is a preview of how your label will look. Click the Print button to send it to your printer.</p>
          </div>
          
          <div class="label-header print-only">
            Label ${orderNumber ? `for Order #${orderNumber}` : ''}
          </div>
          
          <pre>${labelContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          
          <div class="print-only">
            <p style="font-size: 8pt; text-align: right; margin-top: 10px; color: #999;">
              Printed from Warehouse Management System
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return html;
  };

  // Function to preview the label
  const previewLabel = async () => {
    try {
      setIsLoading(true);
      
      // Generate HTML content
      const htmlContent = await generatePreviewHtml();
      
      // Create a Blob and URL for the HTML content
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      // Update state with the URL
      setPreviewUrl(url);
      
      setIsLoading(false);
      
      toast({
        title: "Label Preview Ready",
        description: "You can now print the label from your browser.",
      });
    } catch (error) {
      console.error('Error generating label preview:', error);
      setIsLoading(false);
      
      toast({
        variant: "destructive",
        title: "Preview Generation Failed",
        description: "Could not generate the label preview. Please try again.",
      });
    }
  };

  // Function to print the label
  const printLabel = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        // Instead of opening a new window, print directly from the iframe
        setTimeout(() => {
          if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.focus();
            iframeRef.current.contentWindow.print();
            
            toast({
              title: "Print Dialog Opened",
              description: "Please select your printer in the print dialog.",
            });
          }
        }, 300); // Short delay to ensure content is loaded
      } catch (error) {
        console.error('Print error:', error);
        toast({
          variant: "destructive",
          title: "Print Failed",
          description: "Browser blocked the print dialog. Please allow popups for this site.",
        });
      }
    } else {
      toast({
        variant: "destructive",
        title: "Print Failed",
        description: "Could not access the print dialog. Please try again.",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button 
          onClick={previewLabel} 
          disabled={isLoading || !labelContent}
          variant="outline"
        >
          <FileDown className="h-4 w-4 mr-2" />
          Generate Label Preview
        </Button>
        
        {previewUrl && (
          <Button 
            onClick={printLabel}
            variant="default"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print Label
          </Button>
        )}
      </div>
      
      {!labelContent && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Label Content</AlertTitle>
          <AlertDescription>
            No label content is available to preview or print.
          </AlertDescription>
        </Alert>
      )}
      
      {previewUrl && (
        <div className="border rounded-md overflow-hidden" style={{ height: '400px' }}>
          <iframe 
            ref={iframeRef}
            src={previewUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Label Preview"
          />
        </div>
      )}
    </div>
  );
};

export default BrowserPrintLabel;