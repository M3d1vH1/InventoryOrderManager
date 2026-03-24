import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "../../../lib/trpc";
import { Save } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_auth/settings/company")({
    component: CompanySettingsPage,
});

const schema = z.object({
    companyName: z.string().min(1, "Company Name is required"),
    address: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    taxId: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email("Invalid email").or(z.literal("")).optional(),
    website: z.string().url("Invalid URL").or(z.literal("")).optional(),
    timezone: z.string().default("Europe/Athens"),
    defaultCurrency: z.string().default("EUR"),
});

type FormValues = z.input<typeof schema>;

function CompanySettingsPage() {
    const utils = trpc.useUtils();
    const [saved, setSaved] = useState(false);

    const { data: initialData, isLoading } = trpc.settings.company.get.useQuery();

    const mutation = trpc.settings.company.update.useMutation({
        onSuccess: () => {
            utils.settings.company.get.invalidate();
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        },
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        values: (initialData ? {
            companyName: initialData.companyName,
            address: initialData.address || "",
            city: initialData.city || "",
            postalCode: initialData.postalCode || "",
            country: initialData.country || "",
            taxId: initialData.taxId || "",
            phone: initialData.phone || "",
            email: initialData.email || "",
            website: initialData.website || "",
            timezone: initialData.timezone,
            defaultCurrency: initialData.defaultCurrency,
        } : {
            companyName: "",
            address: "",
            city: "",
            postalCode: "",
            country: "",
            taxId: "",
            phone: "",
            email: "",
            website: "",
            timezone: "Europe/Athens",
            defaultCurrency: "EUR",
        }) as FormValues,
    });

    if (isLoading) {
        return (
            <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900">Company Profile</h2>
                <p className="text-sm text-gray-500">
                    This information appears on packing slips, invoices, and system generated reports.
                </p>
            </div>

            <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-gray-700">Company Name</label>
                        <input
                            {...form.register("companyName")}
                            className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                        {form.formState.errors.companyName && (
                            <p className="mt-1 text-sm text-red-600">{form.formState.errors.companyName.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">Tax ID / VAT</label>
                        <input
                            {...form.register("taxId")}
                            className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">Default Currency</label>
                        <input
                            {...form.register("defaultCurrency")}
                            className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <hr className="my-2 border-gray-200" />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-gray-700">Address line 1</label>
                        <input
                            {...form.register("address")}
                            className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">City</label>
                        <input
                            {...form.register("city")}
                            className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">Postal Code</label>
                        <input
                            {...form.register("postalCode")}
                            className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-gray-700">Country</label>
                        <input
                            {...form.register("country")}
                            className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <hr className="my-2 border-gray-200" />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">Email Address</label>
                        <input
                            {...form.register("email")}
                            type="email"
                            className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                        {form.formState.errors.email && (
                            <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">Phone</label>
                        <input
                            {...form.register("phone")}
                            type="tel"
                            className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4">
                    {saved && <span className="text-sm font-medium text-green-600">Saved successfully!</span>}
                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        <Save className="h-4 w-4" />
                        {mutation.isPending ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}
