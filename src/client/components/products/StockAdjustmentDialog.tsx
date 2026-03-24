import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "../../lib/trpc";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { Label } from "../ui/label";

const schema = z.object({
    quantity: z.number().int().refine((n) => n !== 0, "Cannot be zero"),
    reason: z.enum([
        "manual_adjustment",
        "damaged",
        "return_received",
        "stock_received",
        "cycle_count",
    ]),
    notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function StockAdjustmentDialog({
    productId,
    open,
    onOpenChange,
}: {
    productId: number;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const utils = trpc.useUtils();
    const { t } = useTranslation("products");
    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { quantity: 0, reason: "manual_adjustment" as const, notes: "" },
    });

    const mutation = trpc.products.updateStock.useMutation({
        onSuccess: () => {
            utils.products.getById.invalidate({ id: productId });
            utils.products.list.invalidate();
            onOpenChange(false);
            form.reset();
        },
    });

    function onSubmit(data: FormValues) {
        mutation.mutate({ productId, ...data });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t("adjustment.title")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="quantity">{t("adjustment.quantityLabel")}</Label>
                        <Input
                            id="quantity"
                            type="number"
                            {...form.register("quantity", { valueAsNumber: true })}
                            placeholder={t("adjustment.quantityPlaceholder")}
                        />
                        {form.formState.errors.quantity && (
                            <p className="text-red-600 text-sm">
                                {form.formState.errors.quantity.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>{t("adjustment.reasonLabel")}</Label>
                        <Select
                            onValueChange={(v) => form.setValue("reason", v as any)}
                            defaultValue={form.getValues("reason")}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={t("adjustment.reasonSelect")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="manual_adjustment">{t("adjustment.reasons.manual_adjustment")}</SelectItem>
                                <SelectItem value="damaged">{t("adjustment.reasons.damaged")}</SelectItem>
                                <SelectItem value="return_received">{t("adjustment.reasons.return_received")}</SelectItem>
                                <SelectItem value="stock_received">{t("adjustment.reasons.stock_received")}</SelectItem>
                                <SelectItem value="cycle_count">{t("adjustment.reasons.cycle_count")}</SelectItem>
                            </SelectContent>
                        </Select>
                        {form.formState.errors.reason && (
                            <p className="text-red-600 text-sm">
                                {form.formState.errors.reason.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">{t("adjustment.notesLabel")}</Label>
                        <Input
                            id="notes"
                            {...form.register("notes")}
                            placeholder={t("adjustment.notesPlaceholder")}
                        />
                    </div>

                    {mutation.error && (
                        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                            {mutation.error.message}
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={mutation.isPending}
                        className="w-full mt-2"
                    >
                        {mutation.isPending ? t("adjustment.applying") : t("adjustment.applyBtn")}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
