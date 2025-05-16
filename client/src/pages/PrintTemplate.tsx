import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

const PrintTemplate = () => {
  const [labelContent, setLabelContent] = useState<string>('');
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    // Get query parameters
    const params = new URLSearchParams(window.location.search);
    const content = params.get('content');
    const orderNum = params.get('orderNumber');
    
    if (content) {
      setLabelContent(decodeURIComponent(content));
    }
    
    if (orderNum) {
      setOrderNumber(orderNum);
    }
    
    // Auto-print if requested
    if (params.get('autoPrint') === 'true') {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 print:hidden">
        <h1 className="text-2xl font-bold mb-2">CAB EOS 1 Label Printing</h1>
        <p className="text-gray-600 mb-4">
          Preview your label below. Click the Print button to send it to your printer.
        </p>
        <Button 
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Printer className="h-4 w-4 mr-2" />
          Print Label
        </Button>
      </div>
      
      <div className="border rounded-md p-5 bg-white">
        {orderNumber && (
          <div className="text-center font-medium mb-4 print:block hidden">
            Label for Order #{orderNumber}
          </div>
        )}
        
        <pre className="whitespace-pre font-mono text-sm p-4 bg-gray-50 border rounded-md print:border-0 print:bg-white print:text-sm">
          {labelContent}
        </pre>
        
        <div className="text-right text-xs text-gray-400 mt-3 hidden print:block">
          Printed from Warehouse Management System
        </div>
      </div>
    </div>
  );
};

export default PrintTemplate;