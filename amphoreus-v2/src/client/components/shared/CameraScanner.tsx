import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Button } from "../ui/button";
import { Camera, CameraOff } from "lucide-react";

interface Props {
    onScan: (barcode: string) => void;
    enabled?: boolean;
}

export function CameraScanner({ onScan, enabled = false }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [active, setActive] = useState(enabled);
    const [error, setError] = useState<string>();
    const readerRef = useRef<any>(null);

    const startScanning = useCallback(async () => {
        if (!videoRef.current) return;

        try {
            const reader = new BrowserMultiFormatReader(undefined);
            readerRef.current = reader;

            await reader.decodeFromVideoDevice(
                undefined,
                videoRef.current,
                (result) => {
                    if (result) {
                        onScan(result.getText());
                    }
                }
            );
            setActive(true);
            setError(undefined);
        } catch (err) {
            setError("Camera access denied or unavailable");
            setActive(false);
        }
    }, [onScan]);

    const stopScanning = useCallback(() => {
        readerRef.current = null;
        setActive(false);
    }, []);

    useEffect(() => {
        return () => {
            readerRef.current = null;
        };
    }, []);

    return (
        <div className="space-y-2">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                    ref={videoRef}
                    className={active ? "w-full h-full object-cover" : "hidden"}
                />
                {!active && (
                    <div className="flex items-center justify-center h-full text-white/60">
                        <CameraOff className="h-8 w-8" />
                    </div>
                )}
                {/* Scanning overlay crosshair */}
                {active && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 border-2 border-white/50 rounded-lg" />
                    </div>
                )}
            </div>

            {error && <p className="text-red-600 text-sm text-center">{error}</p>}

            <Button
                variant="outline"
                onClick={active ? stopScanning : startScanning}
                className="w-full h-12"
            >
                <Camera className="h-4 w-4 mr-2" />
                {active ? "Stop Camera" : "Start Camera Scanner"}
            </Button>
        </div>
    );
}
