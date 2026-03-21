import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { NotificationDropdown } from "./NotificationDropdown";

export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Poll for new notifications every 30s
    const { data: count = 0, refetch: refetchCount } = trpc.notifications.unreadCount.useQuery(
        undefined,
        { refetchInterval: 30000 }
    );

    const { data: notifications = [], refetch: refetchList } = trpc.notifications.list.useQuery(
        { limit: 20 },
        { enabled: open }
    );

    const utils = trpc.useUtils();

    const markRead = trpc.notifications.markRead.useMutation({
        onSuccess: () => {
            utils.notifications.unreadCount.invalidate();
            utils.notifications.list.invalidate();
        },
    });

    const markAllRead = trpc.notifications.markAllRead.useMutation({
        onSuccess: () => {
            utils.notifications.unreadCount.invalidate();
            utils.notifications.list.invalidate();
        },
    });

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => {
                    if (!open) refetchList();
                    setOpen(!open);
                }}
                className={`p-2 rounded-full transition-colors relative ${open ? "bg-gray-100 dark:bg-gray-800 text-blue-600" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
            >
                <Bell className="w-5 h-5" />
                {count > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 sm:w-auto sm:h-auto sm:px-1.5 sm:py-0.5 sm:-mt-1 sm:-mr-1 bg-red-500 text-white text-[10px] sm:text-xs font-bold sm:leading-none rounded-full flex items-center justify-center transform scale-100 motion-safe:animate-bounce-short">
                        <span className="sr-only sm:not-sr-only sm:inline">{count > 99 ? "99+" : count}</span>
                    </span>
                )}
            </button>

            {open && (
                <NotificationDropdown
                    notifications={notifications as any}
                    onMarkRead={(id) => markRead.mutate({ id })}
                    onMarkAllRead={() => markAllRead.mutate()}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
}
