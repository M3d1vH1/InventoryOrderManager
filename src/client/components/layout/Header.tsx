import { LogOut, User } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { cn } from "../../lib/utils";
import type { SafeUser } from "../../../shared/types";
import { NotificationBell } from "./NotificationBell";
import { LanguageSwitcher } from "../shared/LanguageSwitcher";

interface HeaderProps {
    user: Omit<SafeUser, "createdAt" | "lastLogin"> & {
        createdAt: string;
        lastLogin: string | null;
    };
    sidebarCollapsed: boolean;
}

export function Header({ user, sidebarCollapsed }: HeaderProps) {
    const utils = trpc.useUtils();

    const logoutMutation = trpc.auth.logout.useMutation({
        onSuccess: () => {
            utils.auth.me.invalidate();
            window.location.href = "/login";
        },
    });

    const roleBadgeColors: Record<string, string> = {
        admin: "bg-purple-100 text-purple-700",
        front_office: "bg-blue-100 text-blue-700",
        warehouse: "bg-green-100 text-green-700",
    };

    return (
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
            {/* Left: Company name (visible when sidebar is collapsed) */}
            <div className="flex items-center gap-3">
                {sidebarCollapsed && (
                    <span className="text-lg font-semibold text-gray-900">Amphoreus</span>
                )}
            </div>

            {/* Right: User info + logout */}
            <div className="flex items-center gap-4">
                <LanguageSwitcher />
                <NotificationBell />

                {/* Role badge */}
                <span
                    className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                        roleBadgeColors[user.role] ?? "bg-gray-100 text-gray-700"
                    )}
                >
                    {user.role.replace("_", " ")}
                </span>

                {/* User name */}
                <div className="flex items-center gap-2 text-sm text-gray-700">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{user.fullName}</span>
                </div>

                {/* Logout button */}
                <button
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm
                     text-gray-500 hover:bg-gray-100 hover:text-gray-700
                     disabled:cursor-not-allowed disabled:opacity-50"
                    title="Sign out"
                >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign out</span>
                </button>
            </div>
        </header>
    );
}
