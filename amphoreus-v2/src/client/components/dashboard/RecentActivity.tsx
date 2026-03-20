import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { formatDistanceToNow } from "date-fns";
import { Activity } from "lucide-react";

interface Entry {
    id: number;
    orderNumber: string | null;
    action: string;
    notes: string | null;
    timestamp: string;
}

const actionColors: Record<string, string> = {
    created: "border-blue-200",
    status_changed: "border-purple-200",
    items_modified: "border-orange-200",
    cancelled: "border-red-200",
    reservation_released: "border-green-200",
};

export function RecentActivity({ entries }: { entries: Entry[] }) {
    if (entries.length === 0) return null;

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    Recent Activity
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-4 space-y-4">
                {entries.map((entry) => {
                    const borderColor = actionColors[entry.action] ?? "border-border";
                    return (
                        <div key={entry.id} className={`border-l-2 ${borderColor} pl-4 py-1 relative`}>
                            <div className={`absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-background border-2 ${borderColor}`} />
                            <p className="text-sm leading-relaxed">
                                <span className="font-mono text-xs font-semibold bg-muted px-1.5 py-0.5 rounded mr-1.5">
                                    {entry.orderNumber}
                                </span>
                                {entry.notes || entry.action}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                            </p>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
