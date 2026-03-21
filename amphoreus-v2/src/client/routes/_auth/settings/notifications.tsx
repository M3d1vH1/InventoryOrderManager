import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { trpc } from "../../../lib/trpc";
import { Save } from "lucide-react";
import React, { useState } from "react";

export const Route = createFileRoute("/_auth/settings/notifications")({
    component: NotificationSettingsPage,
});

type FormValues = {
    slackWebhookUrl: string;
    slackEnabled: boolean;
    emailEnabled: boolean;
    notifyNewOrder: boolean;
    notifyShipped: boolean;
    notifyLowStock: boolean;
    dailySummaryEnabled: boolean;
    dailySummaryTime: string;
};

function NotificationSettingsPage() {
    const utils = trpc.useUtils();
    const [saved, setSaved] = useState(false);

    const { data: initialData, isLoading } = trpc.settings.notifications.get.useQuery();

    const mutation = trpc.settings.notifications.update.useMutation({
        onSuccess: () => {
            utils.settings.notifications.get.invalidate();
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        },
    });

    const form = useForm<FormValues>({
        values: initialData ? {
            slackWebhookUrl: initialData.slackWebhookUrl || "",
            slackEnabled: initialData.slackEnabled,
            emailEnabled: initialData.emailEnabled,
            notifyNewOrder: initialData.notifyNewOrder,
            notifyShipped: initialData.notifyShipped,
            notifyLowStock: initialData.notifyLowStock,
            dailySummaryEnabled: initialData.dailySummaryEnabled,
            dailySummaryTime: initialData.dailySummaryTime,
        } : {
            slackWebhookUrl: "",
            slackEnabled: false,
            emailEnabled: false,
            notifyNewOrder: true,
            notifyShipped: true,
            notifyLowStock: true,
            dailySummaryEnabled: true,
            dailySummaryTime: "18:00",
        },
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
                <h2 className="text-xl font-bold tracking-tight text-gray-900">Notification Preferences</h2>
                <p className="text-sm text-gray-500">
                    Control what triggers system-wide automated alerts via Slack and Email.
                </p>
            </div>

            <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">

                    <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                        <div>
                            <span className="block text-sm font-medium text-gray-900">Enable Slack Webhooks</span>
                            <span className="text-xs text-gray-500">Push rich notifications directly to a Slack channel.</span>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                            <input type="checkbox" {...form.register("slackEnabled")} className="peer sr-only" />
                            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none focus-within:ring-4 focus-within:ring-blue-300"></div>
                        </label>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">Slack Webhook URL</label>
                        <input
                            {...form.register("slackWebhookUrl")}
                            type="url"
                            placeholder="https://hooks.slack.com/services/..."
                            className="w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
                    <h3 className="text-md font-semibold text-gray-900 mb-2">Event Triggers</h3>

                    <ToggleRow
                        label="New Orders Created"
                        desc="Alert when a customer or agent creates a high-priority order."
                        {...form.register("notifyNewOrder")}
                    />
                    <ToggleRow
                        label="Orders Shipped"
                        desc="Alert when warehouse marks an order as fully picked and shipped."
                        {...form.register("notifyShipped")}
                    />
                    <ToggleRow
                        label="Low Stock Alerts"
                        desc="Alert when available inventory drops below minimum thresholds."
                        {...form.register("notifyLowStock")}
                    />

                    <div className="border-t border-gray-100 pt-4 mt-2">
                        <ToggleRow
                            label="Daily Operations Summary"
                            desc="Receive a roll-up report of orders fulfilled and standing inventory."
                            {...form.register("dailySummaryEnabled")}
                        />
                        <div className="pl-14 mt-2">
                            <label className="mr-3 text-sm text-gray-600">Summary Dispatch Time (Local):</label>
                            <input
                                {...form.register("dailySummaryTime")}
                                type="time"
                                className="rounded-md border border-gray-300 p-1 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4">
                    {saved && <span className="text-sm font-medium text-green-600">Preferences updated!</span>}
                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        <Save className="h-4 w-4" />
                        {mutation.isPending ? "Saving..." : "Save Preferences"}
                    </button>
                </div>
            </form>
        </div>
    );
}

const ToggleRow = React.forwardRef<HTMLInputElement, { label: string, desc: string }>(({ label, desc, ...props }, ref) => (
    <div className="flex items-center justify-between">
        <div>
            <span className="block text-sm font-medium text-gray-800">{label}</span>
            <span className="text-xs text-gray-500">{desc}</span>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" ref={ref} {...props} className="peer sr-only" />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none focus-within:ring-4 focus-within:ring-blue-300"></div>
        </label>
    </div>
));
ToggleRow.displayName = "ToggleRow";
