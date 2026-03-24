import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";

interface ChangelogEntry {
    id: number;
    action: string;
    notes: string | null;
    timestamp: Date | string;
}

export function OrderTimeline({ entries }: { entries: ChangelogEntry[] }) {
    const { t } = useTranslation("orders");

    if (entries.length === 0) {
        return <p className="text-sm text-muted-foreground">{t("components.timelineNone")}</p>;
    }

    return (
        <div className="space-y-2">
            <h3 className="font-semibold text-base">{t("components.timelineTitle")}</h3>
            <div className="relative border-l-2 border-muted ml-2 pl-5 space-y-4">
                {entries.map((entry) => (
                    <div key={entry.id} className="relative">
                        <div className="absolute -left-[23px] top-1 w-3 h-3 bg-background border-2 border-primary rounded-full" />
                        <p className="text-sm font-medium capitalize">{entry.action.replace(/_/g, " ")}</p>
                        {entry.notes && (
                            <p className="text-sm text-muted-foreground">{entry.notes}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
