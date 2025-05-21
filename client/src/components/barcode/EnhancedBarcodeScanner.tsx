import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScanBarcode, Search, ListChecks, PackageCheck, Truck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

/**
 * Enhanced Barcode Scanner Component
 * 
 * This component works exclusively with physical barcode scanners.
 * It provides functionality for global barcode detection without requiring field focus.
 */
interface EnhancedBarcodeScannerProps {
  onBarcodeScanned: (barcode: string, mode: ScanMode) => void;
  buttonText?: string;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  modalTitle?: string;
  initialMode?: ScanMode;
  showInHeader?: boolean;
}

export type ScanMode = 'lookup' | 'inventory' | 'picking' | 'receiving';

const EnhancedBarcodeScanner: React.FC<EnhancedBarcodeScannerProps> = ({
  onBarcodeScanned,
  buttonText = "Scan Barcode",
  buttonVariant = "default",
  buttonSize = "default",
  modalTitle = "Scan or Enter Barcode",
  initialMode = 'lookup',
  showInHeader = false
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [barcode, setBarcode] = useState<string>("");
  const [manualBarcode, setManualBarcode] = useState<string>("");
  const [scanMode, setScanMode] = useState<ScanMode>(initialMode);
  const [recentScans, setRecentScans] = useState<{barcode: string, timestamp: Date, mode: ScanMode}[]>([]);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setBarcode("");
    setManualBarcode("");
  };

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      processBarcodeResult(manualBarcode);
    } else {
      toast({
        title: t("scanner.emptyBarcode"),
        description: t("scanner.enterValidBarcode"),
        variant: "destructive",
      });
    }
  };

  const processBarcodeResult = (code: string) => {
    setBarcode(code);
    const now = new Date();
    
    // Add to recent scans history
    setRecentScans(prev => {
      const newScans = [{ barcode: code, timestamp: now, mode: scanMode }, ...prev];
      // Keep last 10 scans
      return newScans.slice(0, 10);
    });

    // Log scan to server for analytics
    try {
      const userId = Number(localStorage.getItem('userId') || '1');
      apiRequest({
        url: '/api/barcode-logs',
        method: 'POST',
        data: {
          barcode: code,
          scanType: scanMode,
          userId: userId,
          notes: `Barcode scanned in ${scanMode} mode`
        }
      });
    } catch (error) {
      // Silent fail - don't interrupt the user experience if logging fails
      console.error('Failed to log barcode scan:', error);
    }

    onBarcodeScanned(code, scanMode);
    
    // Display success notification
    const modeLabels = {
      lookup: t("scanner.mode.lookup"),
      inventory: t("scanner.mode.inventory"),
      picking: t("scanner.mode.picking"),
      receiving: t("scanner.mode.receiving")
    };
    
    toast({
      title: t("scanner.barcodeScanned"),
      description: `${modeLabels[scanMode]}: ${code}`,
    });
    
    handleClose();
  };

  // Handle physical barcode scanner input - works both in and outside of modal
  useEffect(() => {
    let currentInput = '';
    let lastKeyTime = 0;
    let inputTimeout: NodeJS.Timeout | null = null;
    
    // Typical barcode scanner settings
    const keyPressDelay = 20; // Typical delay between barcode scanner keystrokes (ms)
    const resetDelay = 300; // Delay to consider a new barcode scan (ms)

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = new Date().getTime();
      
      // Skip handling if user is typing in an input field
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Process when inside scanner dialog
      if (isOpen) {
        // Many barcode scanners send an Enter key after the full code
        if (e.key === 'Enter') {
          if (currentInput) {
            processBarcodeResult(currentInput);
            currentInput = '';
          } else if (barcode) {
            processBarcodeResult(barcode);
          }
        } 
        // Collect numeric and alphanumeric input for the barcode
        else if (/^[a-zA-Z0-9-_]$/.test(e.key)) {
          // Cancel any existing timeout
          if (inputTimeout) {
            clearTimeout(inputTimeout);
          }
          
          // Add the key to our current input buffer
          currentInput += e.key;
          
          // Set a timeout to clear the buffer after 100ms of inactivity
          // This helps distinguish between keyboard typing and rapid scanner input
          inputTimeout = setTimeout(() => {
            setBarcode(currentInput);
            inputTimeout = null;
          }, 100);
        }
      } 
      // Global barcode detection (when dialog is closed)
      else {
        // Check if this is rapid input from a barcode scanner
        const isRapidInput = (currentTime - lastKeyTime) < keyPressDelay;
        
        // Reset buffer if it's been too long since last keystroke
        if (currentTime - lastKeyTime > resetDelay) {
          currentInput = '';
        }
        
        lastKeyTime = currentTime;
        
        // Build up barcode from rapid sequential keypresses
        if (/^[a-zA-Z0-9-_]$/.test(e.key)) {
          currentInput += e.key;
        }
        
        // Process barcode when Enter is pressed (typical for barcode scanners)
        if (e.key === 'Enter' && currentInput.length > 5) {
          console.log('Barcode scanned (global):', currentInput);
          // Open scanner dialog and process barcode
          setIsOpen(true);
          setManualBarcode(currentInput);
          processBarcodeResult(currentInput);
          currentInput = '';
          e.preventDefault(); // Prevent form submissions
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (inputTimeout) {
        clearTimeout(inputTimeout);
      }
    };
  }, [isOpen, barcode, onBarcodeScanned, toast]);

  const getModeIcon = (mode: ScanMode) => {
    switch (mode) {
      case 'lookup':
        return <Search className="h-4 w-4" />;
      case 'inventory':
        return <ListChecks className="h-4 w-4" />;
      case 'picking':
        return <PackageCheck className="h-4 w-4" />;
      case 'receiving':
        return <Truck className="h-4 w-4" />;
      default:
        return <ScanBarcode className="h-4 w-4" />;
    }
  };

  return (
    <>
      <Button 
        variant={buttonVariant} 
        size={buttonSize}
        onClick={handleOpen}
        className={showInHeader ? "flex items-center rounded-full" : ""}
      >
        {getModeIcon(scanMode)}
        {!showInHeader && <span className="ml-2">{buttonText}</span>}
      </Button>
      
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) handleClose();
        else setIsOpen(true);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue={scanMode} onValueChange={(value) => setScanMode(value as ScanMode)}>
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="lookup" className="flex items-center gap-1">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">{t("scanner.mode.lookup")}</span>
              </TabsTrigger>
              <TabsTrigger value="inventory" className="flex items-center gap-1">
                <ListChecks className="h-4 w-4" />
                <span className="hidden sm:inline">{t("scanner.mode.inventory")}</span>
              </TabsTrigger>
              <TabsTrigger value="picking" className="flex items-center gap-1">
                <PackageCheck className="h-4 w-4" />
                <span className="hidden sm:inline">{t("scanner.mode.picking")}</span>
              </TabsTrigger>
              <TabsTrigger value="receiving" className="flex items-center gap-1">
                <Truck className="h-4 w-4" />
                <span className="hidden sm:inline">{t("scanner.mode.receiving")}</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="lookup" className="space-y-4">
              <div className="text-sm">
                {t("scanner.modeDescription.lookup")}
              </div>
            </TabsContent>
            <TabsContent value="inventory" className="space-y-4">
              <div className="text-sm">
                {t("scanner.modeDescription.inventory")}
              </div>
            </TabsContent>
            <TabsContent value="picking" className="space-y-4">
              <div className="text-sm">
                {t("scanner.modeDescription.picking")}
              </div>
            </TabsContent>
            <TabsContent value="receiving" className="space-y-4">
              <div className="text-sm">
                {t("scanner.modeDescription.receiving")}
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="space-y-4">
            {barcode && (
              <div className="p-4 border rounded-md bg-green-50 text-green-600">
                <p>{t("scanner.currentBarcode")}: {barcode}</p>
              </div>
            )}
            
            <div className="p-4 border rounded-md bg-slate-50">
              <p className="mb-2 text-sm text-slate-600">{t("scanner.enterManualBarcode")}:</p>
              <div className="flex space-x-2">
                <Input 
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder={t("scanner.barcodeInputPlaceholder")}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleManualSubmit();
                    }
                  }}
                />
                <Button 
                  onClick={handleManualSubmit}
                  type="button"
                >
                  {t("scanner.submit")}
                </Button>
              </div>
            </div>
            
            {recentScans.length > 0 && (
              <div className="p-4 border rounded-md">
                <h3 className="font-medium mb-2">{t("scanner.recentScans")}</h3>
                <div className="text-sm space-y-1">
                  {recentScans.map((scan, index) => (
                    <div key={index} className="flex justify-between text-slate-600">
                      <span className="font-mono">{scan.barcode}</span>
                      <span className="flex items-center gap-1">
                        {getModeIcon(scan.mode)}
                        <span className="text-xs">{scan.timestamp.toLocaleTimeString()}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="text-sm text-slate-500">
              <p>{t("scanner.tips.title")}:</p>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                <li>{t("scanner.tips.alternatives")}</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>{t("app.cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EnhancedBarcodeScanner;