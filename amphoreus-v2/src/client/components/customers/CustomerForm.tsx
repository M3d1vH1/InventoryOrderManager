import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { Card, CardContent } from "../ui/card";

const SHIPPING_COMPANIES = [
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

const customerSchema = z.object({
    name: z.string().min(1, "Name is required").max(255),
    vatNumber: z.string().max(50).optional(),
    phone: z.string().max(50).optional(),
    email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
    address: z.string().optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    contactPerson: z.string().max(255).optional(),
    billingCompany: z.string().max(255).optional(),
    shippingCompany: z.enum(["brt", "dhl", "gls", "sda", "tnt", "ups", "fedex", "poste_italiane", "other", "pickup"]).optional(),
    preferredShippingCompany: z.enum(["brt", "dhl", "gls", "sda", "tnt", "ups", "fedex", "poste_italiane", "other", "pickup"]).optional(),
    notes: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerFormProps {
    initialData?: Partial<{
        id?: number;
        name?: string | null;
        vatNumber?: string | null;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        city?: string | null;
        state?: string | null;
        postalCode?: string | null;
        country?: string | null;
        contactPerson?: string | null;
        billingCompany?: string | null;
        shippingCompany?: "brt" | "dhl" | "gls" | "sda" | "tnt" | "ups" | "fedex" | "poste_italiane" | "other" | "pickup" | null;
        preferredShippingCompany?: "brt" | "dhl" | "gls" | "sda" | "tnt" | "ups" | "fedex" | "poste_italiane" | "other" | "pickup" | null;
        notes?: string | null;
    }>;
    onSubmitSuccess: (customer: { id: number; name: string }) => void;
}

export function CustomerForm({ initialData, onSubmitSuccess }: CustomerFormProps) {
    const isEditing = !!initialData?.id;

    const form = useForm<CustomerFormValues>({
        resolver: zodResolver(customerSchema),
        defaultValues: {
            name: initialData?.name ?? "",
            vatNumber: initialData?.vatNumber ?? "",
            phone: initialData?.phone ?? "",
            email: initialData?.email ?? "",
            address: initialData?.address ?? "",
            city: initialData?.city ?? "",
            state: initialData?.state ?? "",
            postalCode: initialData?.postalCode ?? "",
            country: initialData?.country ?? "IT",
            contactPerson: initialData?.contactPerson ?? "",
            billingCompany: initialData?.billingCompany ?? "",
            shippingCompany: initialData?.shippingCompany ?? undefined,
            preferredShippingCompany: initialData?.preferredShippingCompany ?? undefined,
            notes: initialData?.notes ?? "",
        },
    });

    const createMutation = trpc.customers.create.useMutation({
        onSuccess: (c) => onSubmitSuccess({ id: c.id, name: c.name }),
    });

    const updateMutation = trpc.customers.update.useMutation({
        onSuccess: (c) => onSubmitSuccess({ id: c.id, name: c.name }),
    });

    const isPending = createMutation.isPending || updateMutation.isPending;
    const globalError = createMutation.error || updateMutation.error;

    function onSubmit(data: any) {
        if (isEditing) {
            updateMutation.mutate({ id: initialData!.id!, ...data });
        } else {
            createMutation.mutate(data);
        }
    }

    const field = (id: keyof CustomerFormValues, label: string, type = "text") => (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} type={type} {...form.register(id)} />
            {form.formState.errors[id] && (
                <p className="text-red-600 text-xs">{form.formState.errors[id]?.message as string}</p>
            )}
        </div>
    );

    return (
        <Card className="border-0 shadow-sm sm:border sm:shadow">
            <CardContent className="pt-6">
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {globalError && (
                        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                            {globalError.message}
                        </div>
                    )}

                    <div>
                        <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">
                            Basic Info
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {field("name", "Customer Name *")}
                            {field("vatNumber", "VAT Number")}
                            {field("phone", "Phone")}
                            {field("email", "Email")}
                            {field("contactPerson", "Contact Person")}
                            {field("billingCompany", "Billing Company")}
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">
                            Address
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {field("address", "Street Address")}
                            {field("city", "City")}
                            {field("state", "State / Province")}
                            {field("postalCode", "Postal Code")}
                            {field("country", "Country")}
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">
                            Shipping
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Default Shipping Company</Label>
                                <Select
                                    defaultValue={form.getValues("shippingCompany")}
                                    onValueChange={(v) => form.setValue("shippingCompany", v as any)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select carrier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SHIPPING_COMPANIES.map((c) => (
                                            <SelectItem key={c.value} value={c.value}>
                                                {c.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Preferred Shipping Company</Label>
                                <Select
                                    defaultValue={form.getValues("preferredShippingCompany")}
                                    onValueChange={(v) => form.setValue("preferredShippingCompany", v as any)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select carrier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SHIPPING_COMPANIES.map((c) => (
                                            <SelectItem key={c.value} value={c.value}>
                                                {c.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="notes">Notes</Label>
                        <textarea
                            id="notes"
                            {...form.register("notes")}
                            rows={3}
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Internal notes..."
                        />
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditing ? "Save Changes" : "Create Customer"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
