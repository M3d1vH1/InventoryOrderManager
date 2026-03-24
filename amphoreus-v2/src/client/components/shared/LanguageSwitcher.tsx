import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const isGreek = i18n.language === "el";

    return (
        <button
            onClick={() => i18n.changeLanguage(isGreek ? "en" : "el")}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
            aria-label="Toggle language"
        >
            <span className="text-base">{isGreek ? "🇬🇧" : "🇬🇷"}</span>
            <span>{isGreek ? "EN" : "ΕΛ"}</span>
        </button>
    );
}
