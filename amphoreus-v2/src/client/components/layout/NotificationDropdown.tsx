import { formatDistanceToNow } from "date-fns";
import { Check, CheckCircle2, Box, Package, AlertTriangle, Info, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

// Matches DB inference
type Notification = {
    id: string;
    title: string;
    message: string;
    type: string;
    read: boolean;
    referenceId: string | null;
    referenceType: string | null;
    createdAt: string | Date;
};

interface NotificationDropdownProps {
    notifications: Notification[];
    onMarkRead: (id: string) => void;
    onMarkAllRead: () => void;
    onClose: () => void;
}

const getIcon = (type: string) => {
    switch (type) {
        case "order_shipped":
            return <Package className="w-5 h-5 text-green-500" />;
        case "new_order":
            return <Box className="w-5 h-5 text-blue-500" />;
        case "low_stock":
        case "error":
            return <AlertTriangle className="w-5 h-5 text-amber-500" />;
        default:
            return <Info className="w-5 h-5 text-gray-500" />;
    }
};

const getLink = (notification: Notification) => {
    if (!notification.referenceType || !notification.referenceId) return null;
    switch (notification.referenceType) {
        case "order":
            return `/orders/${notification.referenceId}`;
        case "product":
            return `/products/${notification.referenceId}`;
        default:
            return null;
    }
};

export function NotificationDropdown({
    notifications,
    onMarkRead,
    onMarkAllRead,
    onClose,
}: NotificationDropdownProps) {
    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-800">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                {unreadCount > 0 && (
                    <button
                        onClick={onMarkAllRead}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1"
                    >
                        <CheckCircle2 className="w-3 h-3" />
                        Mark all read
                    </button>
                )}
            </div>

            <div className="max-h-[min(400px,60vh)] overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">
                        No notifications yet
                    </div>
                ) : (
                    <div className="divide-y dark:divide-gray-800">
                        {notifications.map((n) => {
                            const link = getLink(n);
                            const readOp = n.read ? 0.6 : 1;
                            return (
                                <div
                                    key={n.id}
                                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex gap-3 ${!n.read ? "bg-blue-50/30 dark:bg-blue-900/10" : ""
                                        }`}
                                    style={{ opacity: readOp }}
                                >
                                    <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                            {n.title}
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 break-words">
                                            {n.message}
                                        </p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-xs text-gray-400">
                                                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                {link && (
                                                    <Link
                                                        to={link as any}
                                                        onClick={() => {
                                                            onMarkRead(n.id);
                                                            onClose();
                                                        }}
                                                        className="text-xs text-blue-600 hover:underline font-medium inline-flex items-center gap-0.5"
                                                    >
                                                        View <ArrowRight className="w-3 h-3" />
                                                    </Link>
                                                )}
                                                {!n.read && (
                                                    <button
                                                        onClick={() => onMarkRead(n.id)}
                                                        title="Mark as read"
                                                        className="text-gray-400 hover:text-blue-600"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className="p-3 border-t dark:border-gray-800 text-center bg-gray-50 dark:bg-gray-900/50">
                <span className="text-xs text-gray-500">Showing latest {notifications.length} alerts</span>
            </div>
        </div>
    );
}
