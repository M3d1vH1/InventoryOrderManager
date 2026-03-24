import { useState, useRef } from "react";
import { Upload, X } from "lucide-react";

interface Props {
    value: string | null;        // current cardUrl stored in form
    onChange: (url: string | null) => void;
}

export function ImageUploadField({ value, onChange }: Props) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    async function handleFile(file: File) {
        setError(null);
        setUploading(true);
        try {
            const body = new FormData();
            body.append("image", file);
            const res = await fetch("/api/upload/product-image", { method: "POST", body });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Upload failed.");
            onChange(json.cardUrl);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Upload failed.");
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="space-y-2">
            {value ? (
                <div className="relative w-40">
                    <img
                        src={value}
                        alt="Product"
                        className="rounded-lg object-cover w-40 h-40 border"
                    />
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="absolute -top-2 -right-2 bg-white border rounded-full p-0.5 shadow-sm hover:bg-red-50"
                    >
                        <X className="w-4 h-4 text-gray-600" />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className="flex flex-col items-center justify-center w-40 h-40 border-2 border-dashed rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                    <Upload className="w-6 h-6 mb-2" />
                    <span className="text-xs text-center px-2">
                        {uploading ? "Uploading…" : "Click to upload"}
                    </span>
                </button>
            )}
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = ""; // allow re-selecting same file
                }}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}
