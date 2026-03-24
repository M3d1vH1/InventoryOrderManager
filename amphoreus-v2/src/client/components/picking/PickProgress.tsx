import { useTranslation } from "react-i18next";

export function PickProgress({ total, picked }: { total: number; picked: number }) {
    const pct = total === 0 ? 0 : Math.round((picked / total) * 100);
    const { t } = useTranslation("picking");

    return (
        <div className="bg-card rounded-xl border p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">{t("progress.title")}</span>
                <span className="text-sm font-bold text-foreground">
                    {t("progress.ratioText", { picked, total })}
                </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${pct}%` }}
                />
            </div>
            {picked === total && total > 0 && (
                <p className="mt-3 text-center text-sm font-semibold text-green-600 dark:text-green-500 animate-in fade-in zoom-in duration-300">
                    {t("progress.allPicked")}
                </p>
            )}
        </div>
    );
}
