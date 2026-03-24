import { type CalendarEvent } from "../../types/calendar";

interface EventChipProps {
    event: CalendarEvent;
    onClick?: (e: React.MouseEvent) => void;
    compact?: boolean;
}

const typeLabels: Record<string, string> = {
    custom: "Custom",
    shipping: "Ship",
    production: "Prod",
    follow_up: "Follow-up",
    invoice_due: "Invoice",
};

export function EventChip({ event, onClick, compact = false }: EventChipProps) {
    return (
        <button
            onClick={onClick}
            title={event.title}
            className="w-full text-left truncate rounded px-1.5 py-0.5 text-white text-xs font-medium leading-snug hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/50"
            style={{ backgroundColor: event.color }}
        >
            {!compact && (
                <span className="opacity-75 mr-1">[{typeLabels[event.type] ?? event.type}]</span>
            )}
            <span className="truncate">{event.title}</span>
        </button>
    );
}
