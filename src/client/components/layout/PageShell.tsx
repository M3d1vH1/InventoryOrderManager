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
