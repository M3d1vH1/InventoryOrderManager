import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { formatDistanceToNow } from "date-fns";
import { Activity } from "lucide-react";
import { Button } from "../ui/button";

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

export function RecentActivity({
    entries,
    page,
    totalPages,
    onNext,
    onPrev,
}: {
    entries: Entry[];
    page: number;
    totalPages: number;
    onNext: () => void;
    onPrev: () => void;
}) {
    return (
        <Card className="h-full flex flex-col overflow-hidden border">
            <CardHeader className="pb-3 border-b border-border/50 shrink-0 bg-muted/10">
                <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    Recent Activity
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-4 space-y-4">
                {entries.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground italic text-sm">
                        No recent activity found.
                    </div>
                ) : (
                    entries.map((entry) => {
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
                    })
                )}
            </CardContent>

            {/* Pagination Controls */}
            {totalPages > 0 && (
                <div className="flex items-center justify-between p-3 border-t bg-muted/20 shrink-0">
                    <span className="text-xs text-muted-foreground font-medium">
                        Page {page + 1} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs px-3 bg-card"
                            onClick={onPrev}
                            disabled={page === 0}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs px-3 bg-card"
                            onClick={onNext}
                            disabled={page >= totalPages - 1}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
}
