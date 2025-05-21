import React, { useState, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScanBarcode, Search, ListChecks, PackageCheck, Truck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

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
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanMode, setScanMode] = useState<ScanMode>(initialMode);
  const [recentScans, setRecentScans] = useState<{barcode: string, timestamp: Date, mode: ScanMode}[]>([]);
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { t } = useTranslation();

  // Check and request camera permissions
  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
      setIsScanning(true);
    } catch (err) {
      setHasPermission(false);
      toast({
        title: t("scanner.cameraPermissionDenied"),
        description: t("scanner.enterManually"),
        variant: "destructive",
      });
    }
  };

  // Clean up camera stream when component unmounts or modal closes
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const handleOpen = () => {
    setIsOpen(true);
    requestCameraPermission();
  };

  const handleClose = () => {
    stopCamera();
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

  // Simulate barcode scanning with keyboard input - enhanced for real scanner support
  useEffect(() => {
    let currentInput = '';
    let inputTimeout: NodeJS.Timeout | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && isScanning) {
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (inputTimeout) {
        clearTimeout(inputTimeout);
      }
    };
  }, [isOpen, isScanning, barcode, onBarcodeScanned, toast]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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
            {hasPermission === false && (
              <div className="p-4 border rounded-md bg-amber-50 text-amber-600">
                <p>{t("scanner.cameraAccessDenied")}</p>
              </div>
            )}
            
            {hasPermission === true && (
              <div className="relative bg-black rounded-md overflow-hidden">
                <video 
                  ref={videoRef} 
                  className="w-full h-64 object-cover"
                  autoPlay 
                  playsInline 
                />
                <div className="absolute inset-0 border-2 border-red-500 border-dashed pointer-events-none">
                  <div className="absolute top-1/2 left-0 w-full border-t-2 border-red-500 -translate-y-1/2"></div>
                  <div className="absolute top-0 left-1/2 h-full border-l-2 border-red-500 -translate-x-1/2"></div>
                </div>
              </div>
            )}
            
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
                <li>{t("scanner.tips.position")}</li>
                <li>{t("scanner.tips.lighting")}</li>
                <li>{t("scanner.tips.alternatives")}</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>{t("app.cancel")}</Button>
            {hasPermission === false && (
              <Button onClick={() => requestCameraPermission()}>
                {t("scanner.tryCameraAgain")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EnhancedBarcodeScanner;