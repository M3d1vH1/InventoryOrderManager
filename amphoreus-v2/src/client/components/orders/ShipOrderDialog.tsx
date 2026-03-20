import { useState } from "react";
import { trpc } from "../../lib/trpc";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { FileText, Printer } from "lucide-react";

export function ShipOrderDialog({
    orderId,
    open,
    onOpenChange,
}: {
    orderId: number;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const [tracking, setTracking] = useState("");
    const [notes, setNotes] = useState("");
    const [format, setFormat] = useState<"pdf" | "zpl">("pdf");
    const utils = trpc.useUtils();

    const generateMutation = trpc.shipping.generateLabel.useMutation({
        onSuccess: () => {
            utils.orders.getById.invalidate({ id: orderId });
            utils.picking.queue.invalidate();
            onOpenChange(false);
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Ship Order & Generate Label</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>Tracking Number</Label>
                        <Input
                            value={tracking}
                            onChange={(e) => setTracking(e.target.value)}
                            placeholder="e.g. 1Z9999999999999999 (Optional)"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Label Format</Label>
                        <div className="flex gap-3 mt-1">
                            <Button
                                variant={format === "pdf" ? "default" : "outline"}
                                onClick={() => setFormat("pdf")}
                                className="w-1/2"
                            >
                                <FileText className="h-4 w-4 mr-2" /> PDF (A4)
                            </Button>
                            <Button
                                variant={format === "zpl" ? "default" : "outline"}
                                onClick={() => setFormat("zpl")}
                                className="w-1/2"
                            >
                                <Printer className="h-4 w-4 mr-2" /> ZPL (Thermal)
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Shipping Notes</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any specifics, e.g. Courier name, left at front desk... (Optional)"
                            rows={2}
                        />
                    </div>

                    <Button
                        className="w-full h-12 mt-4"
                        onClick={() =>
                            generateMutation.mutate({
                                orderId,
                                trackingNumber: tracking || undefined,
                                notes: notes || undefined,
                                labelFormat: format,
                            })
                        }
                        disabled={generateMutation.isPending}
                    >
                        {generateMutation.isPending
                            ? "Generating..."
                            : "Generate Label & Ship"}
                    </Button>

                    {generateMutation.error && (
                        <p className="text-red-600 text-sm text-center">
                            {generateMutation.error.message}
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
