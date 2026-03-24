# Milestone 5 — Frontend Shell (React 19 + TanStack Router + Layout)

| Field | Value |
|-------|-------|
| **Step** | 5 of 5 |
| **Priority** | P0 |
| **Depends on** | Step 4 |
| **Estimated effort** | 1.5 days |

---

## Problem / Goal

Build the frontend application shell: React 19 with TanStack Router for file-based routing, TanStack Query for server state, tRPC client wired to the backend, and a complete layout system (sidebar, header, page wrapper). The login page must work end-to-end with the auth system from Milestone 4. The sidebar must be collapsible, role-aware, and support grouped navigation with submenus. The design follows a clean, functional aesthetic inspired by Linear and Vercel dashboards.

---

## Implementation

### 0. shadcn/ui initialization

```bash
# Initialize shadcn/ui (follow prompts: New York style, Zinc base color, CSS variables)
npx shadcn@latest init

# Install required components
npx shadcn@latest add button input card dialog dropdown-menu tooltip \
  popover select label table badge separator skeleton
```

### 1. `src/client/styles/globals.css`

```css
/* src/client/styles/globals.css */
@import "tailwindcss";

@theme {
  /* ── Colors ─────────────────────────────────────────────────── */
  --color-sidebar: #111827;
  --color-sidebar-hover: #1f2937;
  --color-sidebar-active: #374151;
  --color-sidebar-text: #9ca3af;
  --color-sidebar-text-active: #ffffff;

  --color-brand: #3b82f6;
  --color-brand-hover: #2563eb;

  --color-surface: #ffffff;
  --color-surface-secondary: #f9fafb;
  --color-border: #e5e7eb;

  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;

  /* ── Typography ─────────────────────────────────────────────── */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;

  /* ── Spacing scale ──────────────────────────────────────────── */
  --spacing-page: 24px;
  --spacing-section: 16px;
  --spacing-element: 8px;
  --spacing-tight: 4px;

  /* ── Sidebar ────────────────────────────────────────────────── */
  --sidebar-width: 256px;
  --sidebar-collapsed-width: 64px;
  --header-height: 56px;

  /* ── Transitions ────────────────────────────────────────────── */
  --transition-sidebar: width 200ms ease;
}

/* ── Base ──────────────────────────────────────────────────────── */
body {
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Scrollbar ────────────────────────────────────────────────── */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
```

### 2. `src/client/lib/trpc.ts`

```tsx
// src/client/lib/trpc.ts
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import { QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "../../server/router.js";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/trpc",
      headers() {
        return {};
      },
    }),
  ],
});
```

### 3. `src/client/router.tsx`

```tsx
// src/client/router.tsx
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

### 4. `src/client/main.tsx`

```tsx
// src/client/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient, queryClient } from "./lib/trpc";
import { router } from "./router";
import "./styles/globals.css";

function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

### 5. `src/client/index.html`

```html
<!-- src/client/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Amphoreus — Warehouse Management</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

### 6. `src/client/routes/__root.tsx`

```tsx
// src/client/routes/__root.tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV && (
        <TanStackRouterDevtools position="bottom-right" />
      )}
    </>
  );
}
```

### 7. `src/client/routes/login.tsx`

```tsx
// src/client/routes/login.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../lib/trpc";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      navigate({ to: "/" });
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    loginMutation.mutate({ username, password });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Amphoreus</h1>
          <p className="mt-1 text-sm text-gray-500">
            Warehouse Management System
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error message */}
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Username */}
            <div className="space-y-1">
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoFocus
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                           placeholder-gray-400 shadow-sm
                           focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter your username"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                           placeholder-gray-400 shadow-sm
                           focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter your password"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium
                         text-white shadow-sm hover:bg-blue-700
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loginMutation.isPending ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

### 8. `src/client/routes/_auth.tsx`

```tsx
// src/client/routes/_auth.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { trpc } from "../lib/trpc";
import { Sidebar } from "../components/layout/Sidebar";
import { Header } from "../components/layout/Header";
import { useState } from "react";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async () => {
    // This will be checked on the client side via the component
    // Server-side redirect is handled by the component below
  },
});

function AuthLayout() {
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Show loading skeleton while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        userRole={user.role}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          user={user}
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

### 9. `src/client/routes/_auth/index.tsx`

```tsx
// src/client/routes/_auth/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "../../components/layout/PageShell";

export const Route = createFileRoute("/_auth/")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <PageShell title="Dashboard">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Placeholder cards */}
        {["Pending Orders", "Low Stock Items", "Shipments Today", "Quality Issues"].map(
          (label) => (
            <div
              key={label}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
            >
              <p className="text-sm font-medium text-gray-500">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">--</p>
            </div>
          )
        )}
      </div>
    </PageShell>
  );
}
```

### 10. `src/client/components/layout/Sidebar.tsx`

```tsx
// src/client/components/layout/Sidebar.tsx
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
      { label: "Shipping", href: "/shipping", icon: Truck },
      { label: "Unshipped Items", href: "/unshipped", icon: AlertTriangle },
      { label: "Quality", href: "/quality", icon: AlertTriangle },
    ],
  },
  {
    label: "Inventory",
    icon: Package,
    items: [
      { label: "Products", href: "/products", icon: Archive },
      { label: "Categories", href: "/categories", icon: Tags },
      { label: "Stock Changes", href: "/inventory-changes", icon: BarChart3 },
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

  const link = (
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
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
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
            {visibleItems.map((item) => (
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
            ))}
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
            return (
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
```

### 11. `src/client/components/layout/Header.tsx`

```tsx
// src/client/components/layout/Header.tsx
import { LogOut, User } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { cn } from "../../lib/utils";
import type { SafeUser } from "../../../shared/types";

interface HeaderProps {
  user: SafeUser;
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
```

### 12. `src/client/components/layout/PageShell.tsx`

```tsx
// src/client/components/layout/PageShell.tsx
import { type ReactNode } from "react";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageShellProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({
  title,
  description,
  breadcrumbs,
  actions,
  children,
}: PageShellProps) {
  return (
    <div className="p-6">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-4 flex items-center gap-1.5 text-sm text-gray-500">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-gray-300">/</span>}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="hover:text-gray-700 transition-colors"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className="text-gray-900 font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
```

### 13. `src/client/lib/utils.ts`

```ts
// src/client/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/client/main.tsx` | React entry point with tRPC + TanStack Query + Router providers |
| `src/client/index.html` | HTML entry point for Vite |
| `src/client/lib/trpc.ts` | tRPC client setup with TanStack Query |
| `src/client/lib/utils.ts` | Utility functions (`cn` for className merging) |
| `src/client/router.tsx` | TanStack Router creation and type registration |
| `src/client/routes/__root.tsx` | Root layout (outlet + devtools) |
| `src/client/routes/login.tsx` | Login page (username + password form) |
| `src/client/routes/_auth.tsx` | Auth guard layout (redirects unauthenticated users) |
| `src/client/routes/_auth/index.tsx` | Dashboard placeholder page |
| `src/client/components/layout/Sidebar.tsx` | Collapsible sidebar with grouped navigation |
| `src/client/components/layout/Header.tsx` | Top bar with user info and logout |
| `src/client/components/layout/PageShell.tsx` | Page wrapper with title, breadcrumbs, actions slot |
| `src/client/styles/globals.css` | Tailwind imports + CSS variables for design system |

Files generated automatically:
- `src/client/routeTree.gen.ts` — Auto-generated by `@tanstack/router-plugin` (Vite plugin)

---

## Verification

```bash
# 1. TypeScript compiles
npx tsc --noEmit
# Expected: zero errors

# 2. Vite dev server starts
npx vite --config vite.config.ts &
VITE_PID=$!
sleep 3

# 3. Dev server responds
curl -sI http://localhost:5173/
# Expected: 200 OK with text/html content-type

# 4. Start the backend (with DB and seed already done from Milestone 4)
npx tsx src/server/index.ts &
SERVER_PID=$!
sleep 2

# 5. Open browser to http://localhost:5173/
# Expected: Redirected to /login page

# 6. Login with admin credentials
# Enter admin / (ADMIN_INITIAL_PASSWORD) in the form
# Expected: Redirect to / (dashboard), sidebar visible, header shows user name

# 7. Sidebar collapse toggle works
# Click the collapse button at bottom of sidebar
# Expected: Sidebar shrinks to icon-only mode, tooltips appear on hover

# 8. Logout works
# Click "Sign out" in header
# Expected: Redirected to /login page

# 9. Auth guard works
# Navigate to http://localhost:5173/ directly without session
# Expected: Redirected to /login

# 10. Cleanup
kill $VITE_PID $SERVER_PID
```

---

## Definition of Done

- [ ] `npm run dev:client` (Vite) starts without errors on port 5173
- [ ] TanStack Router auto-generates route tree from file-based routes
- [ ] tRPC client connects to the backend via `/trpc` proxy
- [ ] Login page renders with username, password, and submit button
- [ ] Login submits to `auth.login`, sets session cookie, redirects to `/`
- [ ] Login displays error message on invalid credentials
- [ ] `_auth.tsx` layout checks `auth.me` and redirects to `/login` if unauthenticated
- [ ] `_auth.tsx` shows a loading spinner while checking auth status
- [ ] Dashboard page renders with "Dashboard" heading and placeholder stat cards
- [ ] Sidebar displays grouped navigation: Orders (5 items), Inventory (3 items), Sales (1 item)
- [ ] Sidebar collapses to icon-only mode with a toggle button
- [ ] Collapsed sidebar shows flyout popovers on hover via Tooltip
- [ ] Sidebar highlights the currently active route
- [ ] Sidebar hides admin-only items for non-admin roles
- [ ] Submenu state is managed via React `useState` (no DOM manipulation)
- [ ] Header shows company name (when sidebar collapsed), user role badge, full name, and logout button
- [ ] Logout invalidates session and redirects to `/login`
- [ ] `PageShell` component renders title, optional description, optional breadcrumbs, optional actions slot, and children
- [ ] Inter font is loaded from Google Fonts
- [ ] Global CSS sets up Tailwind v4 with custom CSS variables for colors, spacing, and sidebar dimensions
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No blank pages — loading states show spinner or skeleton everywhere
