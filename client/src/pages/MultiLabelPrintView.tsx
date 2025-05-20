import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { useParams } from 'wouter';

/**
 * This page displays multiple labels for batch printing
 * It's designed to be opened in a new window and auto-print
 */
const MultiLabelPrintView = () => {
  const { t } = useTranslation();
  const params = useParams<{ orderId: string; boxCount: string }>();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labelData, setLabelData] = useState<Array<{ id: number; html: string }>>([]);
  
  useEffect(() => {
    if (!params.orderId || !params.boxCount) {
      setError('Invalid route parameters');
      setLoading(false);
      return;
    }

    const orderId = parseInt(params.orderId, 10);
    const boxCount = parseInt(params.boxCount, 10);
    
    if (isNaN(orderId) || isNaN(boxCount) || boxCount <= 0) {
      setError('Invalid order ID or box count');
      setLoading(false);
      return;
    }
    
    const fetchLabels = async () => {
      try {
        // Generate multiple labels
        const labels = [];
        for (let i = 1; i <= boxCount; i++) {
          const response = await axios.get(`/api/orders/${orderId}/generate-label?boxNumber=${i}&boxCount=${boxCount}`);
          labels.push({ id: i, html: response.data.html });
        }
        setLabelData(labels);
        setLoading(false);
        
        // Auto-print after a short delay to ensure content is loaded
        setTimeout(() => {
          window.print();
        }, 1000);
      } catch (err) {
        console.error('Error fetching labels:', err);
        setError('Failed to load shipping labels. Please try again.');
        setLoading(false);
      }
    };
    
    fetchLabels();
  }, [match, params]);
  
  const handlePrint = () => {
    window.print();
  };
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="p-6 w-full max-w-md">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <h2 className="text-xl font-semibold text-center">
              {t('orders.labels.generating', 'Generating shipping labels...')}
            </h2>
            <p className="text-muted-foreground text-center">
              {t('orders.labels.preparingForPrint', 'Please wait while we prepare your labels for printing')}
            </p>
          </div>
        </Card>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="print-container">
      <style>
        {`
        @page {
          size: 9cm 6cm;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          background-color: white;
        }
        .print-container {
          display: flex;
          flex-direction: column;
        }
        .label-container {
          page-break-after: always;
          width: 9cm;
          height: 6cm;
          position: relative;
          box-sizing: border-box;
          overflow: hidden;
        }
        .label-container:last-child {
          page-break-after: avoid;
        }
        .label-iframe {
          border: none;
          width: 100%;
          height: 100%;
        }
        /* Hide print button in print mode */
        @media print {
          .no-print {
            display: none;
          }
        }
        `}
      </style>

      <div className="no-print p-4 mb-4 text-center">
        <h1 className="text-2xl font-bold mb-2">
          {t('orders.labels.readyToPrint', 'Ready to Print')}
        </h1>
        <p className="mb-4">
          {t('orders.labels.multipleLabels', 'Multiple shipping labels are ready to print')}
        </p>
        <Button onClick={handlePrint} size="lg" className="mx-auto">
          {t('orders.labels.printNow', 'Print Labels')}
        </Button>
      </div>

      {labelData.map((label) => (
        <div key={label.id} className="label-container">
          <div 
            className="label-content h-full"
            dangerouslySetInnerHTML={{ __html: label.html }}
          />
        </div>
      ))}
    </div>
  );
};

export default MultiLabelPrintView;