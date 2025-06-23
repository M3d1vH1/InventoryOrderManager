import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, CheckCircle, XCircle, Edit } from 'lucide-react';
import axios from 'axios';
import { useParams, useLocation } from 'wouter';

interface LabelData {
  id: number;
  html: string;
  status: 'loading' | 'success' | 'failed' | 'retrying';
  error?: string;
  retryCount: number;
}

/**
 * This page displays multiple labels for batch printing with optimized loading
 * Features: parallel loading, retry logic, asset preloading, shipping company editing
 */
const MultiLabelPrintView = () => {
  const { t } = useTranslation();
  const params = useParams<{ orderId: string; boxCount: string }>();
  const [location] = useLocation();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labelData, setLabelData] = useState<LabelData[]>([]);
  const [assetsPreloaded, setAssetsPreloaded] = useState(false);
  const [showShippingEditor, setShowShippingEditor] = useState(false);
  const [currentShippingCompany, setCurrentShippingCompany] = useState('');
  const [newShippingCompany, setNewShippingCompany] = useState('');
  const [allLabelsReady, setAllLabelsReady] = useState(false);
  const [printReady, setPrintReady] = useState(false);

  // Preload assets to prevent repeated requests
  const preloadAssets = async (): Promise<void> => {
    const assetsToPreload = ['/shipping-logo.png', '/simple-logo.svg'];
    
    const preloadPromises = assetsToPreload.map(src => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Continue even if asset fails
        img.src = src;
      });
    });
    
    await Promise.all(preloadPromises);
    setAssetsPreloaded(true);
  };

  // Fetch single label with retry logic
  const fetchLabelWithRetry = async (orderId: number, boxNumber: number, boxCount: number, retryCount = 0): Promise<{ html: string }> => {
    const maxRetries = 3;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
    
    try {
      const response = await axios.get(`/api/orders/${orderId}/generate-label?boxNumber=${boxNumber}&boxCount=${boxCount}`, {
        timeout: 10000 // 10 second timeout
      });
      return { html: response.data.html };
    } catch (err) {
      if (retryCount < maxRetries) {
        console.log(`Retrying label ${boxNumber}, attempt ${retryCount + 1}/${maxRetries}`);
        
        // Update status to show retrying
        setLabelData(prev => prev.map(label => 
          label.id === boxNumber 
            ? { ...label, status: 'retrying', retryCount: retryCount + 1 }
            : label
        ));
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchLabelWithRetry(orderId, boxNumber, boxCount, retryCount + 1);
      }
      throw err;
    }
  };

  // Extract shipping company from HTML content
  const extractShippingCompany = (html: string): string => {
    const match = html.match(/Μεταφορική:\s*([^<]+)/);
    return match ? match[1].trim() : 'N/A';
  };

  // Update shipping company in label HTML
  const updateShippingCompanyInHTML = (html: string, newCompany: string): string => {
    return html.replace(/Μεταφορική:\s*[^<]+/, `Μεταφορική: ${newCompany}`);
  };

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
    
    console.log("Using user-specified box count:", boxCount);
    
    const fetchLabels = async () => {
      try {
        // Preload assets first
        await preloadAssets();
        
        // Initialize label data with loading status
        const initialLabelData: LabelData[] = Array.from({ length: boxCount }, (_, i) => ({
          id: i + 1,
          html: '',
          status: 'loading',
          retryCount: 0
        }));
        setLabelData(initialLabelData);
        
        // Create promises for parallel loading
        const labelPromises = Array.from({ length: boxCount }, (_, i) => {
          const boxNumber = i + 1;
          return fetchLabelWithRetry(orderId, boxNumber, boxCount)
            .then(result => ({ boxNumber, ...result, status: 'success' as const }))
            .catch(err => ({ boxNumber, error: err.message, status: 'failed' as const }));
        });
        
        // Load all labels in parallel
        const results = await Promise.all(labelPromises);
        
        // Process results
        const successfulLabels = results.filter(r => r.status === 'success');
        const failedLabels = results.filter(r => r.status === 'failed');
        
        // Update label data with results
        const updatedLabelData = initialLabelData.map(label => {
          const result = results.find(r => r.boxNumber === label.id);
          if (result) {
            if (result.status === 'success') {
              return {
                ...label,
                html: (result as any).html,
                status: 'success' as const
              };
            } else {
              return {
                ...label,
                status: 'failed' as const,
                error: (result as any).error
              };
            }
          }
          return label;
        });
        
        setLabelData(updatedLabelData);
        
        if (successfulLabels.length > 0) {
          // Extract shipping company from first successful label
          const firstSuccessfulLabel = successfulLabels[0];
          const shippingCompany = extractShippingCompany((firstSuccessfulLabel as any).html);
          setCurrentShippingCompany(shippingCompany);
          setNewShippingCompany(shippingCompany);
          
          setAllLabelsReady(true);
          setLoading(false);
          
          // Show shipping company editor before auto-print
          setShowShippingEditor(true);
        } else {
          setError(`Failed to load all ${boxCount} labels. ${failedLabels.length} labels failed to load.`);
          setLoading(false);
        }
        
      } catch (err) {
        console.error('Error in label loading process:', err);
        setError('Failed to load shipping labels. Please try again.');
        setLoading(false);
      }
    };
    
    fetchLabels();
  }, [params]);
  
  // Retry failed labels
  const retryFailedLabels = async () => {
    const failedLabels = labelData.filter(label => label.status === 'failed');
    if (failedLabels.length === 0) return;
    
    const orderId = parseInt(params.orderId!, 10);
    const boxCount = parseInt(params.boxCount!, 10);
    
    // Update status to retrying
    setLabelData(prev => prev.map(label => 
      label.status === 'failed' 
        ? { ...label, status: 'retrying', retryCount: 0 }
        : label
    ));
    
    // Retry failed labels
    const retryPromises = failedLabels.map(async (label) => {
      try {
        const result = await fetchLabelWithRetry(orderId, label.id, boxCount);
        return { boxNumber: label.id, ...result, status: 'success' as const };
      } catch (err) {
        return { boxNumber: label.id, error: (err as Error).message, status: 'failed' as const };
      }
    });
    
    const retryResults = await Promise.all(retryPromises);
    
    // Update label data with retry results
    setLabelData(prev => prev.map(label => {
      const retryResult = retryResults.find(r => r.boxNumber === label.id);
      if (retryResult) {
        if (retryResult.status === 'success') {
          return {
            ...label,
            html: (retryResult as any).html,
            status: 'success'
          };
        } else {
          return {
            ...label,
            status: 'failed',
            error: (retryResult as any).error
          };
        }
      }
      return label;
    }));
  };

  // Handle shipping company update
  const handleShippingCompanyUpdate = () => {
    if (newShippingCompany.trim() && newShippingCompany !== currentShippingCompany) {
      // Update all successful labels with new shipping company
      setLabelData(prev => prev.map(label => 
        label.status === 'success' 
          ? { ...label, html: updateShippingCompanyInHTML(label.html, newShippingCompany.trim()) }
          : label
      ));
      setCurrentShippingCompany(newShippingCompany.trim());
    }
    setShowShippingEditor(false);
    
    // Prepare for printing with extended delay for full rendering
    setTimeout(() => {
      setPrintReady(true);
      // Auto-print after ensuring all content is rendered
      setTimeout(() => {
        window.print();
      }, 3000); // Extended delay for full asset loading
    }, 500);
  };

  const handlePrint = () => {
    window.print();
  };
  
  if (loading) {
    const boxCount = parseInt(params.boxCount || '0', 10);
    const loadedCount = labelData.filter(label => label.status === 'success').length;
    const failedCount = labelData.filter(label => label.status === 'failed').length;
    const retryingCount = labelData.filter(label => label.status === 'retrying').length;
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="p-6 w-full max-w-lg">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <h2 className="text-xl font-semibold text-center">
              {!assetsPreloaded 
                ? t('orders.labels.preloadingAssets', 'Preloading assets...')
                : t('orders.labels.generating', 'Generating shipping labels...')
              }
            </h2>
            
            {assetsPreloaded && boxCount > 0 && (
              <div className="w-full space-y-3">
                <div className="text-center text-sm text-muted-foreground">
                  {t('orders.labels.progress', 'Loading label {{current}} of {{total}}', {
                    current: loadedCount + failedCount + retryingCount,
                    total: boxCount
                  })}
                </div>
                
                {/* Progress indicators */}
                <div className="grid grid-cols-5 gap-2">
                  {labelData.map((label) => (
                    <div 
                      key={label.id} 
                      className={`h-3 rounded-full ${
                        label.status === 'success' ? 'bg-green-400' :
                        label.status === 'failed' ? 'bg-red-400' :
                        label.status === 'retrying' ? 'bg-yellow-400 animate-pulse' :
                        'bg-gray-200'
                      }`}
                      title={`Label ${label.id}: ${label.status}`}
                    />
                  ))}
                </div>
                
                {(loadedCount > 0 || failedCount > 0) && (
                  <div className="text-xs text-center space-y-1">
                    {loadedCount > 0 && (
                      <div className="text-green-600 flex items-center justify-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {loadedCount} labels loaded successfully
                      </div>
                    )}
                    {retryingCount > 0 && (
                      <div className="text-yellow-600 flex items-center justify-center gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        {retryingCount} labels retrying...
                      </div>
                    )}
                    {failedCount > 0 && (
                      <div className="text-red-600 flex items-center justify-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {failedCount} labels failed
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }
  
  if (error) {
    const failedCount = labelData.filter(label => label.status === 'failed').length;
    const successCount = labelData.filter(label => label.status === 'success').length;
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
        
        {failedCount > 0 && (
          <Card className="p-4 max-w-md">
            <div className="space-y-3">
              <div className="text-sm">
                <strong>{successCount}</strong> labels loaded successfully, 
                <strong className="text-red-600"> {failedCount}</strong> failed
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={retryFailedLabels}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry Failed Labels
                </Button>
                
                {successCount > 0 && (
                  <Button 
                    onClick={() => setShowShippingEditor(true)}
                    variant="default"
                    size="sm"
                  >
                    Print Available Labels
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Shipping Company Editor Modal */}
      <Dialog open={showShippingEditor} onOpenChange={setShowShippingEditor}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              {t('orders.labels.editShippingCompany', 'Edit Shipping Company')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {t('orders.labels.editBeforePrint', 'You can modify the shipping company before printing the labels.')}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="shippingCompany">
                {t('orders.labels.shippingCompany', 'Shipping Company')}
              </Label>
              <Input
                id="shippingCompany"
                value={newShippingCompany}
                onChange={(e) => setNewShippingCompany(e.target.value)}
                placeholder={t('orders.labels.enterShippingCompany', 'Enter shipping company name')}
              />
            </div>
            
            <div className="text-xs text-muted-foreground">
              {t('orders.labels.currentShippingCompany', 'Current: {{company}}', { 
                company: currentShippingCompany 
              })}
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setNewShippingCompany(currentShippingCompany);
                handleShippingCompanyUpdate();
              }}
            >
              {t('orders.labels.useOriginal', 'Use Original')}
            </Button>
            <Button onClick={handleShippingCompanyUpdate}>
              {t('orders.labels.updateAndPrint', 'Update & Print')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          /* Ensure images are loaded before print */
          .label-container img {
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }
          `}
        </style>

        <div className="no-print p-4 mb-4 text-center space-y-4">
          <h1 className="text-2xl font-bold">
            {printReady 
              ? t('orders.labels.readyToPrint', 'Ready to Print')
              : t('orders.labels.preparingToPrint', 'Preparing to Print...')
            }
          </h1>
          
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('orders.labels.shippingCompany', 'Shipping Company')}: <strong>{currentShippingCompany}</strong>
            </p>
            
            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>{labelData.filter(l => l.status === 'success').length} successful</span>
              </div>
              {labelData.filter(l => l.status === 'failed').length > 0 && (
                <div className="flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span>{labelData.filter(l => l.status === 'failed').length} failed</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 justify-center">
            <Button onClick={handlePrint} size="lg">
              {t('orders.labels.printNow', 'Print Labels')}
            </Button>
            
            <Button 
              onClick={() => setShowShippingEditor(true)} 
              variant="outline"
              size="lg"
              className="flex items-center gap-1"
            >
              <Edit className="h-4 w-4" />
              {t('orders.labels.editShipping', 'Edit Shipping')}
            </Button>
            
            {labelData.filter(l => l.status === 'failed').length > 0 && (
              <Button 
                onClick={retryFailedLabels}
                variant="outline"
                size="lg"
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-4 w-4" />
                {t('orders.labels.retryFailed', 'Retry Failed')}
              </Button>
            )}
          </div>
          
          {!printReady && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('orders.labels.renderingContent', 'Rendering content for optimal printing...')}
            </div>
          )}
        </div>

        {/* Only render successful labels */}
        {labelData
          .filter(label => label.status === 'success')
          .map((label) => (
            <div key={label.id} className="label-container">
              <div 
                className="label-content h-full"
                onLoad={() => {
                  // Track when individual labels are fully loaded
                  console.log(`Label ${label.id} fully rendered`);
                }}
                dangerouslySetInnerHTML={{ __html: label.html }}
              />
            </div>
          ))
        }
      </div>
    </>
  );
};

export default MultiLabelPrintView;