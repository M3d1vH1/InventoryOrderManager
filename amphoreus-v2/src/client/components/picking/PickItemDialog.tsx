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
                    <DialogTitle>Confirm Pick</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-2">
                    <div className="space-y-2">
                        <Label>Actual Quantity Picked</Label>
                        <Input
                            type="number"
                            min={0}
                            max={defaultQuantity * 2}
                            value={pickedQuantity ?? ""}
                            onChange={(e) => setPickedQuantity(parseInt(e.target.value) || 0)}
                            placeholder="Enter quantity physically picked"
                        />
                        {pickedQuantity !== undefined && pickedQuantity < defaultQuantity && (
                            <p className="text-xs text-amber-600">
                                Warning: Picking fewer items than requested ({defaultQuantity}).
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
                            Item has quality issues
                            <p className="text-xs text-muted-foreground mt-1 font-normal">
                                Check this if the item is damaged, mislabelled, or otherwise unfit.
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
                            {mutation.isPending ? "Confirming..." : "Confirm Pick"}
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
