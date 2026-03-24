import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";

export function PickItemDialog({
    orderItemId,
    defaultQuantity,
    open,
    onClose,
}: {
    orderItemId: number;
    defaultQuantity: number;
    open: boolean;
    onClose: () => void;
}) {
    const [pickedQuantity, setPickedQuantity] = useState<number | undefined>(defaultQuantity);
    const [hasQualityIssues, setHasQualityIssues] = useState(false);
    const utils = trpc.useUtils();
    const { t } = useTranslation("picking");

    const mutation = trpc.picking.pickItem.useMutation({
        onSuccess: () => {
            utils.picking.queue.invalidate();
            onClose();
        },
    });

    const handleOpenChange = (v: boolean) => {
        if (!v) {
            setQualityDefault();
            onClose();
        }
    };

    const setQualityDefault = () => {
        setPickedQuantity(defaultQuantity);
        setHasQualityIssues(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t("dialog.title")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-2">
                    <div className="space-y-2">
                        <Label>{t("dialog.actualQuantity")}</Label>
                        <Input
                            type="number"
                            min={0}
                            max={defaultQuantity * 2}
                            value={pickedQuantity ?? ""}
                            onChange={(e) => setPickedQuantity(parseInt(e.target.value) || 0)}
                            placeholder={t("dialog.quantityPlaceholder")}
                        />
                        {pickedQuantity !== undefined && pickedQuantity < defaultQuantity && (
                            <p className="text-xs text-amber-600">
                                {t("dialog.warningUnderPick", { default: defaultQuantity })}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center space-x-2 border rounded-md p-4 bg-muted/50">
                        <Checkbox
                            id="quality-issue"
                            checked={hasQualityIssues}
                            onCheckedChange={(c) => setHasQualityIssues(!!c)}
                        />
                        <Label
                            htmlFor="quality-issue"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                        >
                            {t("dialog.qualityIssue")}
                            <p className="text-xs text-muted-foreground mt-1 font-normal">
                                {t("dialog.qualityDesc")}
                            </p>
                        </Label>
                    </div>

                    <div className="pt-2">
                        <Button
                            className="w-full"
                            size="lg"
                            onClick={() =>
                                mutation.mutate({
                                    orderItemId,
                                    pickedQuantity: pickedQuantity ?? 0,
                                    hasQualityIssues,
                                })
                            }
                            disabled={mutation.isPending || pickedQuantity === undefined}
                        >
                            {mutation.isPending ? t("dialog.confirming") : t("dialog.confirmBtn")}
                        </Button>
                        {mutation.error && (
                            <p className="text-red-600 text-sm mt-2 text-center">
                                {mutation.error.message}
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
