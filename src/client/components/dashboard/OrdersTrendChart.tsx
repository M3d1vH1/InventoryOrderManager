import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { BarChart3 } from "lucide-react";

interface DataPoint {
    date: string;
    total: number;
    shipped: number;
}

export function OrdersTrendChart({ data }: { data: DataPoint[] }) {
    const maxValue = Math.max(...data.map((d) => d.total), 1);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-0">
                <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Orders Volume (Last 14 Days)
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-end pt-6">
                <div className="flex items-end gap-1.5 h-48 w-full border-b border-border/50 pb-2">
                    {data.map((d) => {
                        const totalHeight = `${(d.total / maxValue) * 100}%`;
                        const shippedHeight = `${(d.shipped / d.total || 0) * 100}%`;

                        return (
                            <div key={d.date} className="flex-1 flex flex-col justify-end items-center h-full group">
                                <div
                                    className="w-full bg-primary/20 rounded-t-sm relative transition-all group-hover:bg-primary/30"
                                    style={{ height: totalHeight }}
                                >
                                    <div
                                        className="absolute bottom-0 w-full bg-primary rounded-t-sm transition-all"
                                        style={{ height: shippedHeight }}
                                    />
                                    {/* Tooltip on hover */}
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs rounded px-2 py-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border">
                                        Total: {d.total} | Shipped: {d.shipped}
                                    </div>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-2 truncate max-w-full">
                                    {new Date(d.date).getDate()}
                                </span>
                            </div>
                        );
                    })}
                </div>
                <div className="flex gap-6 mt-4 text-xs font-medium text-muted-foreground justify-center">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-primary/20 rounded-sm" /> Total Orders
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-primary rounded-sm" /> Shipped/Delivered
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
