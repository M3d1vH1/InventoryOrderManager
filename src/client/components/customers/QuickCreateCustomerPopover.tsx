import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus } from "lucide-react";
import { trpc } from "../../lib/trpc";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "../ui/popover";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";

const quickSchema = z.object({
    name: z.string().min(1, "Name required"),
    phone: z.string().optional(),
    shippingCompany: z
        .enum(["brt", "dhl", "gls", "sda", "tnt", "ups", "fedex", "poste_italiane", "other", "pickup"])
        .optional(),
});

type QuickCustomerData = z.infer<typeof quickSchema>;

interface Props {
    onCreated: (customer: { id: number; name: string }) => void;
}

const CARRIERS = [
    { value: "brt", label: "BRT" },
    { value: "dhl", label: "DHL" },
    { value: "gls", label: "GLS" },
    { value: "sda", label: "SDA" },
    { value: "tnt", label: "TNT" },
    { value: "ups", label: "UPS" },
    { value: "fedex", label: "FedEx" },
    { value: "poste_italiane", label: "Poste Italiane" },
    { value: "other", label: "Other" },
    { value: "pickup", label: "Pickup" },
] as const;

export function QuickCreateCustomerPopover({ onCreated }: Props) {
    const [open, setOpen] = useState(false);
    const form = useForm<QuickCustomerData>({
        resolver: zodResolver(quickSchema),
    });

    const utils = trpc.useUtils();
    const mutation = trpc.customers.create.useMutation({
        onSuccess: (customer) => {
            utils.customers.list.invalidate();
            onCreated({ id: customer.id, name: customer.name });
            form.reset();
            setOpen(false);
        },
    });

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" type="button">
                    <UserPlus className="mr-1 h-4 w-4" /> New Customer
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <p className="font-semibold mb-3">Quick Create Customer</p>
                <form
                    onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
                    className="space-y-3"
                >
                    <div className="space-y-1">
                        <Label htmlFor="qc-name">Name *</Label>
                        <Input id="qc-name" {...form.register("name")} />
                        {form.formState.errors.name && (
                            <p className="text-red-600 text-xs">{form.formState.errors.name.message}</p>
                        )}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="qc-phone">Phone</Label>
                        <Input id="qc-phone" {...form.register("phone")} />
                    </div>
                    <div className="space-y-1">
                        <Label>Shipping Company</Label>
                        <Select
                            onValueChange={(v) => form.setValue("shippingCompany", v as any)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select carrier" />
                            </SelectTrigger>
                            <SelectContent>
                                {CARRIERS.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>
                                        {c.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit" className="w-full" disabled={mutation.isPending}>
                        {mutation.isPending ? "Creating..." : "Create Customer"}
                    </Button>
                    {mutation.error && (
                        <p className="text-red-600 text-sm">{mutation.error.message}</p>
                    )}
                </form>
            </PopoverContent>
        </Popover>
    );
}
