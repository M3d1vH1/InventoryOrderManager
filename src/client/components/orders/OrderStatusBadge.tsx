import { Badge } from "../ui/badge";

const statusStyles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    picked: "bg-blue-100 text-blue-800 border-blue-200",
    partially_shipped: "bg-purple-100 text-purple-800 border-purple-200",
    shipped: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

const priorityStyles: Record<string, string> = {
    normal: "bg-gray-100 text-gray-600",
    high: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700",
};

export function OrderStatusBadge({ status }: { status: string }) {
    return (
        <Badge className={statusStyles[status] ?? "bg-gray-100"}>
            {status.replace(/_/g, " ")}
        </Badge>
    );
}

export function OrderPriorityBadge({ priority }: { priority: string }) {
    return (
        <Badge variant="outline" className={priorityStyles[priority] ?? ""}>
            {priority}
        </Badge>
    );
}
