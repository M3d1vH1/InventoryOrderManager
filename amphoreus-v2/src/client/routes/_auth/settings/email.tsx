import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "../../../lib/trpc";
import { Save, Send } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_auth/settings/email")({
    component: EmailSettingsPage,
});

const schema = z.object({
    smtpHost: z.string().optional(),
    smtpPort: z.preprocess((val) => (val ? Number(val) : undefined), z.number().optional()),
    smtpUser: z.string().optional(),
    smtpPass: z.string().optional(),
    fromName: z.string().optional(),
    fromEmail: z.string().email("Invalid email").or(z.literal("")).optional(),
    enabled: z.boolean().default(false),
});

type FormValues = z.input<typeof schema>;

function EmailSettingsPage() {
    const utils = trpc.useUtils();
    const [saved, setSaved] = useState(false);

    const { data: initialData, isLoading } = trpc.settings.email.get.useQuery();

    const testMutation = trpc.settings.email.test.useMutation({
        onSuccess: (res) => alert(res.message),
        onError: (err) => alert("Error: " + err.message),
    });

    const mutation = trpc.settings.email.update.useMutation({
        onSuccess: () => {
            utils.settings.email.get.invalidate();
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        },
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        values: (initialData ? {
            smtpHost: initialData.smtpHost || "",
            smtpPort: initialData.smtpPort || undefined,
            smtpUser: initialData.smtpUser || "",
            smtpPass: initialData.smtpPass || "",
            fromName: initialData.fromName || "",
            fromEmail: initialData.fromEmail || "",
            enabled: initialData.enabled,
        } : {
            smtpHost: "",
            smtpPort: undefined,
            smtpUser: "",
            smtpPass: "",
            fromName: "",
            fromEmail: "",
            enabled: false,
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
                <h2 className="text-xl font-bold tracking-tight text-gray-900">Email SMTP Configuration</h2>
                <p className="text-sm text-gray-500">
                    Configure the outbound mail server used for sending shipping updates and summary reports.
                </p>
            </div>

            <form onSubmit={form.handleSubmit((d) => mutation.mutate(d as any))} className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-4">
                        <div>
                            <span className="block text-sm font-medium text-gray-900">Enable Outbound Email</span>
                            <span className="text-xs text-gray-500">Allow Amphoreus to send emails automatically.</span>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                            <input type="checkbox" {...form.register("enabled")} className="peer sr-only" />
                            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300"></div>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-gray-700">SMTP Host</label>
                            <input
                                {...form.register("smtpHost")}
                                placeholder="smtp.example.com"
                                className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">SMTP Port</label>
                            <input
                                {...form.register("smtpPort")}
                                type="number"
                                placeholder="587"
                                className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-gray-700">SMTP Username</label>
                            <input
                                {...form.register("smtpUser")}
                                className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-gray-700">SMTP Password</label>
                            <input
                                {...form.register("smtpPass")}
                                type="password"
                                placeholder={initialData?.smtpPass ? "••••••••" : ""}
                                className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                            <p className="mt-1 text-xs text-gray-500">Leave blank to keep current password unchanged.</p>
                        </div>

                        <div className="sm:col-span-2">
                            <hr className="my-2 border-gray-200" />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">From Name</label>
                            <input
                                {...form.register("fromName")}
                                placeholder="Amphoreus Logistics"
                                className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">From Email Address</label>
                            <input
                                {...form.register("fromEmail")}
                                type="email"
                                placeholder="noreply@example.com"
                                className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => testMutation.mutate()}
                        disabled={testMutation.isPending}
                        className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                    >
                        <Send className="h-4 w-4" />
                        {testMutation.isPending ? "Testing..." : "Send Test Email"}
                    </button>

                    <div className="flex items-center gap-4">
                        {saved && <span className="text-sm font-medium text-green-600">Saved successfully!</span>}
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            <Save className="h-4 w-4" />
                            {mutation.isPending ? "Saving..." : "Save Configuration"}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
