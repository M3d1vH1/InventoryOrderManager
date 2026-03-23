import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { useTranslation } from "react-i18next";
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
    const [carrier, setCarrier] = useState("");
    const [tracking, setTracking] = useState("");
    const [notes, setNotes] = useState("");
    const [format, setFormat] = useState<"pdf" | "zpl">("pdf");
    const utils = trpc.useUtils();
    const { t } = useTranslation("orders");

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
                    <DialogTitle>{t("components.shipDialogTitle")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>{t("components.shipCarrierLabel", "Carrier")}</Label>
                        <Input
                            value={carrier}
                            onChange={(e) => setCarrier(e.target.value)}
                            placeholder="e.g. BRT, DHL, TNT"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t("components.shipTrackingLabel")}</Label>
                        <Input
                            value={tracking}
                            onChange={(e) => setTracking(e.target.value)}
                            placeholder={t("components.shipTrackingPlaceholder")}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t("components.shipFormatLabel")}</Label>
                        <div className="flex gap-3 mt-1">
                            <Button
                                variant={format === "pdf" ? "default" : "outline"}
                                onClick={() => setFormat("pdf")}
                                className="w-1/2"
                            >
                                <FileText className="h-4 w-4 mr-2" /> {t("components.shipPdf")}
                            </Button>
                            <Button
                                variant={format === "zpl" ? "default" : "outline"}
                                onClick={() => setFormat("zpl")}
                                className="w-1/2"
                            >
                                <Printer className="h-4 w-4 mr-2" /> {t("components.shipZpl")}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>{t("components.shipNotesLabel")}</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={t("components.shipNotesPlaceholder")}
                            rows={2}
                        />
                    </div>

                    <Button
                        className="w-full h-12 mt-4"
                        onClick={() =>
                            generateMutation.mutate({
                                orderId,
                                carrier: carrier || undefined,
                                trackingNumber: tracking || undefined,
                                notes: notes || undefined,
                                labelFormat: format,
                            })
                        }
                        disabled={generateMutation.isPending}
                    >
                        {generateMutation.isPending
                            ? t("components.shipGenerating")
                            : t("components.shipGenerateBtn")}
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
