import { type CalendarEvent } from "../../types/calendar";
import { EventChip } from "./EventChip";
import { startOfWeek, addDays, addHours, startOfDay, isSameDay, format, isToday } from "date-fns";

interface WeekViewProps {
    currentDate: Date;
    events: CalendarEvent[];
    onEventClick: (event: CalendarEvent) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function WeekView({ currentDate, events, onEventClick }: WeekViewProps) {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const allDayEvents = events.filter(e => e.allDay);
    const timedEvents = events.filter(e => !e.allDay);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* All-day row */}
            <div className="flex border-b bg-gray-50">
                <div className="w-14 shrink-0 py-2 text-xs text-gray-400 text-center">All day</div>
                {days.map(day => {
                    const dayAllDay = allDayEvents.filter(e => isSameDay(new Date(e.start), day));
                    return (
                        <div key={day.toISOString()} className={`flex-1 border-l p-1 min-h-[40px] ${isToday(day) ? "bg-blue-50/50" : ""}`}>
                            <div className="space-y-0.5">
                                {dayAllDay.map(ev => (
                                    <EventChip
                                        key={ev.id}
                                        event={ev}
                                        compact
                                        onClick={() => onEventClick(ev)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Column headers */}
            <div className="flex border-b sticky top-0 bg-white z-10">
                <div className="w-14 shrink-0" />
                {days.map(day => (
                    <div key={day.toISOString()} className={`flex-1 border-l py-2 text-center ${isToday(day) ? "bg-blue-50" : ""}`}>
                        <div className="text-xs font-medium text-gray-500 uppercase">{format(day, "EEE")}</div>
                        <div className={`text-lg font-semibold mt-0.5 mx-auto w-8 h-8 flex items-center justify-center rounded-full
              ${isToday(day) ? "bg-blue-600 text-white" : "text-gray-700"}`}
                        >
                            {format(day, "d")}
                        </div>
                    </div>
                ))}
            </div>

            {/* Time grid */}
            <div className="flex-1 overflow-y-auto">
                <div className="flex min-h-[960px]">
                    {/* Time labels */}
                    <div className="w-14 shrink-0">
                        {HOURS.map(h => (
                            <div key={h} className="h-10 border-b border-gray-100 flex items-start pt-1">
                                <span className="text-[10px] text-gray-400 px-1 tabular-nums">
                                    {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Day columns */}
                    {days.map(day => {
                        const dayTimed = timedEvents.filter(e => isSameDay(new Date(e.start), day));
                        return (
                            <div
                                key={day.toISOString()}
                                className={`flex-1 border-l relative ${isToday(day) ? "bg-blue-50/20" : ""}`}
                            >
                                {HOURS.map(h => (
                                    <div key={h} className="h-10 border-b border-gray-100" />
                                ))}
                                {/* Timed events — simple overlap-free list overlay */}
                                <div className="absolute inset-0 pointer-events-none">
                                    {dayTimed.map(ev => {
                                        const startH = new Date(ev.start).getHours();
                                        const startM = new Date(ev.start).getMinutes();
                                        const endH = ev.end ? new Date(ev.end).getHours() : startH + 1;
                                        const endM = ev.end ? new Date(ev.end).getMinutes() : 0;
                                        const top = (startH * 60 + startM) / 60 * 40;
                                        const height = Math.max(((endH * 60 + endM) - (startH * 60 + startM)) / 60 * 40, 20);
                                        return (
                                            <div
                                                key={ev.id}
                                                className="absolute left-0.5 right-0.5 pointer-events-auto"
                                                style={{ top: `${top}px`, height: `${height}px` }}
                                                onClick={() => onEventClick(ev)}
                                            >
                                                <EventChip event={ev} compact />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
