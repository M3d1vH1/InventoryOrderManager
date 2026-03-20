import { Card, CardContent } from "../ui/card";
import { cn } from "../../lib/utils";
import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Props {
    title: string;
    value: number | string;
    icon: LucideIcon;
    variant?: "default" | "success" | "warning" | "destructive";
    href?: string;
}

const variantStyles = {
    default: "text-primary",
    success: "text-green-600",
    warning: "text-yellow-600",
    destructive: "text-red-600",
};

export function StatCard({ title, value, icon: Icon, variant = "default", href }: Props) {
    const cardContent = (
        <Card className={cn("hover:shadow-md transition-shadow h-full", href && "cursor-pointer")}>
            <CardContent className="p-4 flex items-center gap-4 h-full">
                <div className={cn("p-3 rounded-lg bg-muted", variantStyles[variant])}>
                    <Icon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <p className="text-2xl font-bold tracking-tight">{value}</p>
                </div>
            </CardContent>
        </Card>
    );

    if (href) {
        return <Link to={href} className="block h-full">{cardContent}</Link>;
    }

    return cardContent;
}
