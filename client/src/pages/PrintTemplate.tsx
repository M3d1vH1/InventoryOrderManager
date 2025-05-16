import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, FileDown } from 'lucide-react';

// Add print-specific styles to the head
const addPrintStyles = () => {
  const styleId = 'label-print-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      @page {
        size: 9cm 6cm;
        margin: 0;
      }
      @media print {
        body {
          margin: 0;
          padding: 0;
        }
        .print-container {
          width: 9cm;
          height: 6cm;
          page-break-after: always;
        }
      }
    `;
    document.head.appendChild(style);
  }
};

// Function to parse CAB EOS1 JScript commands and convert to HTML
const parseJScript = (jscript: string): { 
  texts: Array<{x: number, y: number, content: string, fontSize: number}>,
  barcodes: Array<{x: number, y: number, value: string, height: number}>,
  lines: Array<{x1: number, y1: number, x2: number, y2: number, thickness: number}>
} => {
  const result = {
    texts: [] as Array<{x: number, y: number, content: string, fontSize: number}>,
    barcodes: [] as Array<{x: number, y: number, value: string, height: number}>,
    lines: [] as Array<{x1: number, y1: number, x2: number, y2: number, thickness: number}>
  };
  
  // Split JScript by lines
  const lines = jscript.split('\n').filter(line => line.trim() !== '');
  
  lines.forEach(line => {
    // Parse text commands: T x,y,r,font,size;text
    if (line.startsWith('T ')) {
      const match = line.match(/T\s+(\d+),(\d+),\d+,\d+,([\w\d]+);(.*)/);
      if (match) {
        const x = parseInt(match[1]);
        const y = parseInt(match[2]);
        const fontInfo = match[3];
        const content = match[4];
        
        // Extract font size (pt8, pt10, etc)
        let fontSize = 12; // Default
        const fontSizeMatch = fontInfo.match(/pt(\d+)/);
        if (fontSizeMatch) {
          fontSize = parseInt(fontSizeMatch[1]);
        }
        
        result.texts.push({ x, y, content, fontSize });
      }
    }
    
    // Parse barcode commands: B x,y,r,type,height,text
    else if (line.startsWith('B ')) {
      const match = line.match(/B\s+(\d+),(\d+),\d+,[\w\d]+,(\d+),[^;]*;(.*)/);
      if (match) {
        const x = parseInt(match[1]);
        const y = parseInt(match[2]);
        const height = parseInt(match[3]);
        const value = match[4];
        
        result.barcodes.push({ x, y, value, height });
      }
    }
    
    // Parse line commands
    else if (line.startsWith('L ')) {
      const match = line.match(/L\s+(\d+),(\d+),(\d+),(\d+),(\d+)/);
      if (match) {
        const x1 = parseInt(match[1]);
        const y1 = parseInt(match[2]);
        const x2 = parseInt(match[3]);
        const y2 = parseInt(match[4]);
        const thickness = parseInt(match[5]);
        
        result.lines.push({ x1, y1, x2, y2, thickness });
      }
    }
  });
  
  return result;
};

// Component for formatted label display
const FormattedLabel: React.FC<{ content: string }> = ({ content }) => {
  // Try to parse JScript commands
  try {
    const parsedContent = parseJScript(content);
    
    return (
      <div 
        className="relative bg-white border border-gray-200 print-container" 
        style={{ 
          width: '9cm', 
          height: '6cm', 
          margin: '0 auto',
          position: 'relative',
          boxSizing: 'border-box'
        }}
      >
        {/* Render text elements */}
        {parsedContent.texts.map((text, index) => (
          <div 
            key={`text-${index}`} 
            style={{
              position: 'absolute',
              left: `${text.x / 10}mm`,
              top: `${text.y / 10}mm`,
              fontSize: `${text.fontSize}pt`,
              fontFamily: 'monospace',
              whiteSpace: 'pre'
            }}
          >
            {text.content}
          </div>
        ))}
        
        {/* Render barcodes */}
        {parsedContent.barcodes.map((barcode, index) => (
          <div 
            key={`barcode-${index}`} 
            style={{
              position: 'absolute',
              left: `${barcode.x / 10}mm`,
              top: `${barcode.y / 10}mm`,
              height: `${barcode.height / 10}mm`,
              padding: '3px',
              border: '1px dashed #ccc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9pt',
              color: '#666'
            }}
          >
            Barcode: {barcode.value}
          </div>
        ))}
        
        {/* Render lines */}
        {parsedContent.lines.map((line, index) => (
          <div 
            key={`line-${index}`} 
            style={{
              position: 'absolute',
              left: `${line.x1 / 10}mm`,
              top: `${line.y1 / 10}mm`,
              width: `${(line.x2 - line.x1) / 10}mm`,
              height: `${line.thickness / 10}mm`,
              backgroundColor: '#000'
            }}
          />
        ))}
      </div>
    );
  } catch (error) {
    // Fallback to raw content if parsing fails
    return (
      <pre className="whitespace-pre font-mono text-sm p-4 bg-gray-50 border rounded-md print:border-0 print:bg-white print:text-sm">
        {content}
      </pre>
    );
  }
};

const PrintTemplate = () => {
  const [labelContent, setLabelContent] = useState<string>('');
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [isRawMode, setIsRawMode] = useState<boolean>(false);

  useEffect(() => {
    // Add print styles to document
    addPrintStyles();
    
    // Get query parameters
    const params = new URLSearchParams(window.location.search);
    const content = params.get('content');
    const orderNum = params.get('orderNumber');
    const rawMode = params.get('raw') === 'true';
    
    if (content) {
      setLabelContent(decodeURIComponent(content));
    }
    
    if (orderNum) {
      setOrderNumber(orderNum);
    }
    
    setIsRawMode(rawMode);
    
    // Auto-print if requested
    if (params.get('autoPrint') === 'true') {
      setTimeout(() => {
        window.print();
      }, 500);
    }
    
    // Set the page title
    document.title = orderNum ? `Label - Order #${orderNum}` : 'Label Printing';
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 print:hidden">
        <h1 className="text-2xl font-bold mb-2">Label Printing</h1>
        <p className="text-gray-600 mb-4">
          Preview your label below. Click the Print button to send it to your printer.
        </p>
        <div className="flex gap-2">
          <Button 
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print Label
          </Button>
          
          <Button 
            onClick={() => setIsRawMode(!isRawMode)}
            variant="outline"
          >
            <FileDown className="h-4 w-4 mr-2" />
            {isRawMode ? 'Formatted View' : 'Raw JScript View'}
          </Button>
        </div>
      </div>
      
      <div className="border rounded-md p-5 bg-white">
        {orderNumber && (
          <div className="text-center font-medium mb-4 print:block hidden">
            Label for Order #{orderNumber}
          </div>
        )}
        
        {/* Label content - either formatted or raw */}
        {isRawMode ? (
          <pre className="whitespace-pre font-mono text-sm p-4 bg-gray-50 border rounded-md print:border-0 print:bg-white print:text-sm">
            {labelContent}
          </pre>
        ) : (
          <FormattedLabel content={labelContent} />
        )}
        
        <div className="text-right text-xs text-gray-400 mt-3 hidden print:block">
          Printed from Warehouse Management System
        </div>
      </div>
    </div>
  );
};

export default PrintTemplate;