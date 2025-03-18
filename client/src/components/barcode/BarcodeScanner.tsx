import React, { useState, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// This is needed for TypeScript support with react-barcode-reader
declare module "react-barcode-reader" {
  export default class BarcodeReader extends React.Component<{
    onError?: (error: any) => void;
    onScan: (data: string) => void;
    minLength?: number;
    delay?: number;
    stopPropagation?: boolean;
    preventDefault?: boolean;
  }> {}
}

interface BarcodeScannerProps {
  onBarcodeScanned: (barcode: string) => void;
  buttonText?: string;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  modalTitle?: string;
}

// Dynamic import for client-side only functionality
const BarcodeReader = React.lazy(() => import('react-barcode-reader'));

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onBarcodeScanned,
  buttonText = "Scan Barcode",
  buttonVariant = "default",
  buttonSize = "default",
  modalTitle = "Scan Barcode"
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [barcode, setBarcode] = useState<string>("");
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
        description: "Please allow camera access to scan barcodes.",
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
  };

  const handleScan = (data: string) => {
    if (data) {
      setBarcode(data);
      onBarcodeScanned(data);
      toast({
        title: "Barcode Scanned",
        description: `Scanned barcode: ${data}`,
      });
      handleClose();
    }
  };

  const handleError = (err: any) => {
    console.error(err);
    toast({
      title: "Scan Error",
      description: "There was an error while scanning. Please try again.",
      variant: "destructive",
    });
  };

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
              <div className="p-4 border rounded-md bg-red-50 text-red-600">
                <p>Camera access is required to scan barcodes. Please allow camera access and try again.</p>
              </div>
            )}
            
            {isScanning && (
              <React.Suspense fallback={<div>Loading scanner...</div>}>
                <BarcodeReader
                  onError={handleError}
                  onScan={handleScan}
                  minLength={4}
                  delay={300}
                />
              </React.Suspense>
            )}
            
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
            
            {barcode && (
              <div className="p-4 border rounded-md bg-green-50 text-green-600">
                <p>Scanned barcode: {barcode}</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={() => requestCameraPermission()} disabled={isScanning}>
              {isScanning ? "Scanning..." : "Start Scanning"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BarcodeScanner;