import { type CalendarEvent } from "../../types/calendar";
import { EventChip } from "./EventChip";
import {
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    addDays, isSameMonth, isSameDay, isToday, format, getDay,
} from "date-fns";

interface CalendarGridProps {
    currentDate: Date;
    events: CalendarEvent[];
    onDayClick: (date: Date) => void;
    onEventClick: (event: CalendarEvent) => void;
}

export function CalendarGrid({ currentDate, events, onDayClick, onEventClick }: CalendarGridProps) {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let cursor = gridStart;
    while (cursor <= gridEnd) {
        days.push(cursor);
        cursor = addDays(cursor, 1);
    }

    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
        <div className="flex flex-col h-full">
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 border-b">
                {dayNames.map(d => (
                    <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {d}
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 flex-1 divide-x divide-y">
                {days.map(day => {
                    const dayEvents = events.filter(e => isSameDay(new Date(e.start), day));
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const today = isToday(day);

                    // Adjust for week starting on Monday
                    const dowIndex = (getDay(day) + 6) % 7;
                    const isWeekend = dowIndex >= 5;

                    return (
                        <div
                            key={day.toISOString()}
                            onClick={() => onDayClick(day)}
                            className={`min-h-[100px] p-1.5 cursor-pointer transition-colors group
                ${isCurrentMonth ? "bg-white hover:bg-blue-50/40" : "bg-gray-50/70 hover:bg-gray-100/70"}
                ${isWeekend && isCurrentMonth ? "bg-slate-50/60" : ""}
              `}
                        >
                            <div className="flex justify-end mb-1">
                                <span className={`w-6 h-6 flex items-center justify-center text-xs rounded-full font-semibold
                  ${today ? "bg-blue-600 text-white" : isCurrentMonth ? "text-gray-700" : "text-gray-400"}
                `}>
                                    {format(day, "d")}
                                </span>
                            </div>
                            <div className="space-y-0.5 overflow-hidden">
                                {dayEvents.slice(0, 3).map(ev => (
                                    <EventChip
                                        key={ev.id}
                                        event={ev}
                                        compact
                                        onClick={(reactEv: React.MouseEvent) => { reactEv.stopPropagation(); onEventClick(ev); }}
                                    />
                                ))}
                                {dayEvents.length > 3 && (
                                    <div className="text-[10px] text-gray-400 pl-1">
                                        +{dayEvents.length - 3} more
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
