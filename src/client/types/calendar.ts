/** Unified CalendarEvent type shared across calendar components */
export interface CalendarEvent {
    id: string;
    title: string;
    description?: string | null;
    start: Date | string;
    end: Date | string | null;
    type: string;
    color: string;
    allDay: boolean;
    referenceId?: string | number | null;
    referenceType?: string | null;
}
