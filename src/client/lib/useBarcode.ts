import { useEffect, useRef } from "react";

/**
 * Detects barcode scanner input (keyboard-wedge mode).
 * USB/Bluetooth scanners type characters rapidly and end with Enter.
 * This hook distinguishes scanner input from normal typing by speed.
 */
export function useBarcodeScanner(onScan: (barcode: string) => void) {
    const bufferRef = useRef("");
    const timerRef = useRef<NodeJS.Timeout | number | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input/textarea
            const target = e.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

            if (e.key === "Enter" && bufferRef.current.length >= 3) {
                onScan(bufferRef.current.trim());
                bufferRef.current = "";
                e.preventDefault();
                return;
            }

            if (e.key.length === 1) {
                bufferRef.current += e.key;

                // Reset buffer after 100ms of inactivity (human typing is slower)
                if (timerRef.current) clearTimeout(timerRef.current as unknown as number);
                timerRef.current = setTimeout(() => {
                    bufferRef.current = "";
                }, 100);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onScan]);
}
