import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Building2, Server, Mail, Settings as SettingsIcon, Bell } from "lucide-react";

export const Route = createFileRoute("/_auth/settings/")({
    component: SettingsDashboard,
});

const cards = [
    {
        title: "User Management",
        description: "Add, edit roles, reset passwords, or remove team members.",
        icon: Users,
        href: "/settings/users",
        color: "text-blue-600",
        bg: "bg-blue-50",
    },
    {
        title: "Company Profile",
        description: "Set the global company name, address, tax ID, and timezone.",
        icon: Building2,
        href: "/settings/company",
        color: "text-purple-600",
        bg: "bg-purple-50",
    },
    {
        title: "Email & SMTP",
        description: "Configure the outbound email server used for labels and reports.",
        icon: Mail,
        href: "/settings/email",
        color: "text-green-600",
        bg: "bg-green-50",
    },
    {
        title: "Notifications",
        description: "Toggle automated Slack alerts for orders and inventory thresholds.",
        icon: Bell,
        href: "/settings/notifications",
        color: "text-orange-600",
        bg: "bg-orange-50",
    },
    {
        title: "System Diagnostics",
        description: "View database health, memory usage, and manage active caches.",
        icon: Server,
        href: "/settings/system",
        color: "text-gray-600",
        bg: "bg-gray-100",
    },
];

function SettingsDashboard() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gray-100 p-2">
                    <SettingsIcon className="h-6 w-6 text-gray-700" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    Administrator Settings
                </h1>
            </div>

            <p className="text-base text-gray-500">
                Configure global application parameters, manage access controls, and view system health.
                These actions affect all users in Amphoreus.
            </p>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((card) => (
                    <Link
                        key={card.href}
                        to={card.href}
                        className="group relative flex flex-col items-start gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                    >
                        <div className={`rounded-lg p-3 \${card.bg} transition-colors`}>
                            <card.icon className={`h-6 w-6 \${card.color}`} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                {card.title}
                            </h3>
                            <p className="text-sm text-gray-500 line-clamp-2">
                                {card.description}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
