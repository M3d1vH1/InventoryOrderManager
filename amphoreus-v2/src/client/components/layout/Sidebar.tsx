import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
    Package,
    ShoppingCart,
    BarChart3,
    Users,
    Settings,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Truck,
    AlertTriangle,
    Archive,
    Tags,
    ScanBarcode,
    LayoutDashboard,
    type LucideIcon,
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "../ui/tooltip";
import { cn } from "../../lib/utils";
import type { UserRole } from "../../../shared/types";

interface NavItem {
    label: string;
    href: string;
    icon: LucideIcon;
    roles?: UserRole[];
    disabled?: boolean;
}

interface NavGroup {
    label: string;
    icon: LucideIcon;
    roles?: UserRole[];
    items: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
    return "items" in entry;
}

const navigation: NavEntry[] = [
    {
        label: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
    },
    {
        label: "Orders",
        icon: ShoppingCart,
        items: [
            { label: "All Orders", href: "/orders", icon: ClipboardList },
            { label: "Picking", href: "/picking", icon: ScanBarcode },
            { label: "Shipping", href: "/shipping", icon: Truck, disabled: true },
            { label: "Unshipped Items", href: "/unshipped", icon: AlertTriangle, disabled: true },
            { label: "Quality", href: "/quality", icon: AlertTriangle, disabled: true },
        ],
    },
    {
        label: "Inventory",
        icon: Package,
        items: [
            { label: "Products", href: "/products", icon: Archive },
            { label: "Categories", href: "/categories", icon: Tags, disabled: true },
            { label: "Stock Changes", href: "/inventory-changes", icon: BarChart3, disabled: true },
        ],
    },
    {
        label: "Sales",
        icon: BarChart3,
        items: [
            { label: "Customers", href: "/customers", icon: Users },
        ],
    },
    {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        roles: ["admin"],
        disabled: true,
    },
];

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    userRole: UserRole;
}

export function Sidebar({ collapsed, onToggle, userRole }: SidebarProps) {
    const routerState = useRouterState();
    const currentPath = routerState.location.pathname;

    // Filter items by role
    function isVisible(entry: { roles?: UserRole[] }): boolean {
        if (!entry.roles) return true;
        return entry.roles.includes(userRole);
    }

    return (
        <TooltipProvider delayDuration={0}>
            <aside
                className={cn(
                    "flex h-screen flex-col bg-gray-900 text-gray-400 transition-[width]",
                    collapsed ? "w-16" : "w-64"
                )}
                style={{
                    transition: "var(--transition-sidebar)",
                }}
            >
                {/* Brand */}
                <div className="flex h-14 items-center border-b border-gray-800 px-4">
                    {!collapsed && (
                        <span className="text-lg font-semibold text-white">Amphoreus</span>
                    )}
                    {collapsed && (
                        <span className="mx-auto text-lg font-bold text-white">A</span>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-2 py-4">
                    <ul className="space-y-1">
                        {navigation.filter(isVisible).map((entry) =>
                            isGroup(entry) ? (
                                <NavGroupItem
                                    key={entry.label}
                                    group={entry}
                                    collapsed={collapsed}
                                    currentPath={currentPath}
                                    userRole={userRole}
                                />
                            ) : (
                                <NavLinkItem
                                    key={entry.href}
                                    item={entry}
                                    collapsed={collapsed}
                                    currentPath={currentPath}
                                />
                            )
                        )}
                    </ul>
                </nav>

                {/* Collapse toggle */}
                <div className="border-t border-gray-800 p-2">
                    <button
                        onClick={onToggle}
                        className="flex w-full items-center justify-center rounded-md p-2
                       text-gray-400 hover:bg-gray-800 hover:text-white"
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? (
                            <ChevronRight className="h-4 w-4" />
                        ) : (
                            <ChevronLeft className="h-4 w-4" />
                        )}
                    </button>
                </div>
            </aside>
        </TooltipProvider>
    );
}

// ── Single nav link ──────────────────────────────────────────────────────────

interface NavLinkItemProps {
    item: NavItem;
    collapsed: boolean;
    currentPath: string;
}

function NavLinkItem({ item, collapsed, currentPath }: NavLinkItemProps) {
    const isActive = currentPath === item.href;
    const Icon = item.icon;

    const inner = (
        <>
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
        </>
    );

    const link = item.disabled ? (
        <li>
            <span
                className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors opacity-40 cursor-not-allowed select-none",
                    collapsed && "justify-center px-2"
                )}
                title="Coming Soon"
            >
                {inner}
            </span>
        </li>
    ) : (
        <li>
            <Link
                to={item.href}
                className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                        ? "bg-gray-800 text-white"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white",
                    collapsed && "justify-center px-2"
                )}
            >
                {inner}
            </Link>
        </li>
    );

    if (collapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                </TooltipContent>
            </Tooltip>
        );
    }

    return link;
}

// ── Nav group with submenu ───────────────────────────────────────────────────

interface NavGroupItemProps {
    group: NavGroup;
    collapsed: boolean;
    currentPath: string;
    userRole: UserRole;
}

function NavGroupItem({
    group,
    collapsed,
    currentPath,
    userRole,
}: NavGroupItemProps) {
    const visibleItems = group.items.filter(
        (item) => !item.roles || item.roles.includes(userRole)
    );
    const isAnyChildActive = visibleItems.some(
        (item) => currentPath === item.href
    );
    const [isOpen, setIsOpen] = useState(isAnyChildActive);

    const Icon = group.icon;

    // Collapsed mode: show flyout via Tooltip
    if (collapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <li>
                        <button
                            className={cn(
                                "flex w-full items-center justify-center rounded-md px-2 py-2 text-sm font-medium transition-colors",
                                isAnyChildActive
                                    ? "bg-gray-800 text-white"
                                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                        </button>
                    </li>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="p-0">
                    <div className="min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                        <p className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                            {group.label}
                        </p>
                        {visibleItems.map((item) => {
                            if (item.disabled) {
                                return (
                                    <span
                                        key={item.href}
                                        className="flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-gray-400 opacity-50 cursor-not-allowed select-none"
                                        title="Coming Soon"
                                    >
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                    </span>
                                );
                            }
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors",
                                        currentPath === item.href
                                            ? "bg-gray-100 text-gray-900 font-medium"
                                            : "text-gray-700 hover:bg-gray-50"
                                    )}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                </TooltipContent>
            </Tooltip>
        );
    }

    // Expanded mode: collapsible submenu
    return (
        <li>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isAnyChildActive
                        ? "text-white"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                )}
            >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown
                    className={cn(
                        "h-4 w-4 transition-transform",
                        isOpen && "rotate-180"
                    )}
                />
            </button>

            {isOpen && (
                <ul className="ml-4 mt-1 space-y-0.5 border-l border-gray-800 pl-3">
                    {visibleItems.map((item) => {
                        const isActive = currentPath === item.href;
                        return item.disabled ? (
                            <li key={item.href}>
                                <span
                                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-gray-500 opacity-40 cursor-not-allowed select-none"
                                    title="Coming Soon"
                                >
                                    <item.icon className="h-4 w-4 shrink-0" />
                                    <span>{item.label}</span>
                                </span>
                            </li>
                        ) : (
                            <li key={item.href}>
                                <Link
                                    to={item.href}
                                    className={cn(
                                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                                        isActive
                                            ? "bg-gray-800 text-white font-medium"
                                            : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                    )}
                                >
                                    <item.icon className="h-4 w-4 shrink-0" />
                                    <span>{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </li>
    );
}
