import React, { useState, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface BarcodeScannerProps {
  onBarcodeScanned: (barcode: string) => void;
  buttonText?: string;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  modalTitle?: string;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onBarcodeScanned,
  buttonText = "Scan Barcode",
  buttonVariant = "default",
  buttonSize = "default",
  modalTitle = "Scan or Enter Barcode"
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [barcode, setBarcode] = useState<string>("");
  const [manualBarcode, setManualBarcode] = useState<string>("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);

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
        title: "Camera permission denied",
        description: "You can still enter the barcode manually.",
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
      setBarcode(manualBarcode);
      onBarcodeScanned(manualBarcode);
      toast({
        title: "Barcode Entered",
        description: `Entered barcode: ${manualBarcode}`,
      });
      handleClose();
    } else {
      toast({
        title: "Empty Barcode",
        description: "Please enter a valid barcode.",
        variant: "destructive",
      });
    }
  };

  // Simulate barcode scanning with keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && isScanning) {
        // Only collect numeric and alphanumeric input for the barcode
        if (/^[a-zA-Z0-9]$/.test(e.key)) {
          setBarcode(prev => prev + e.key);
        }
        // When Enter is pressed, treat it as a complete scan
        else if (e.key === 'Enter' && barcode) {
          onBarcodeScanned(barcode);
          toast({
            title: "Barcode Scanned",
            description: `Scanned barcode: ${barcode}`,
          });
          handleClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isScanning, barcode, onBarcodeScanned, toast]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <>
      <Button 
        variant={buttonVariant} 
        size={buttonSize}
        onClick={handleOpen}
      >
        <i className="fas fa-barcode mr-2"></i>
        {buttonText}
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {hasPermission === false && (
              <div className="p-4 border rounded-md bg-amber-50 text-amber-600">
                <p>Camera access was denied. You can enter the barcode manually below.</p>
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
                <p>Current barcode: {barcode}</p>
              </div>
            )}
            
            <div className="p-4 border rounded-md bg-slate-50">
              <p className="mb-2 text-sm text-slate-600">Enter barcode manually:</p>
              <div className="flex space-x-2">
                <Input 
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="Enter barcode (e.g., WDG-001)"
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
                  Submit
                </Button>
              </div>
            </div>
            
            <div className="text-sm text-slate-500">
              <p>Tips:</p>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                <li>Position barcode in the center of the camera view</li>
                <li>Ensure good lighting for better scanning</li>
                <li>You can also use a barcode scanner device or enter the code manually</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            {hasPermission === false && (
              <Button onClick={() => requestCameraPermission()}>
                Try Camera Again
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BarcodeScanner;