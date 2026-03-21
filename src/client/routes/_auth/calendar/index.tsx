import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { trpc } from "../../../lib/trpc";
import {
    format, addMonths, subMonths, addWeeks, subWeeks,
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    startOfDay, endOfDay,
} from "date-fns";
import { CalendarGrid } from "../../../components/calendar/CalendarGrid";
import { WeekView } from "../../../components/calendar/WeekView";
import { AddEventDialog } from "../../../components/calendar/AddEventDialog";
import {
    ChevronLeft, ChevronRight, CalendarDays, Plus, Truck,
    Factory, BellRing, Receipt, Layout,
} from "lucide-react";

export const Route = createFileRoute("/_auth/calendar/")({
    component: CalendarPage,
});

type ViewMode = "month" | "week";
type FilterKey = "custom" | "shipping" | "production" | "follow_up" | "invoice_due";

const FILTER_OPTIONS: { key: FilterKey; label: string; icon: React.ElementType; color: string }[] = [
    { key: "custom", label: "Events", icon: Layout, color: "#6b7280" },
    { key: "shipping", label: "Shipping", icon: Truck, color: "#3b82f6" },
    { key: "production", label: "Production", icon: Factory, color: "#8b5cf6" },
    { key: "follow_up", label: "Follow-ups", icon: BellRing, color: "#f59e0b" },
    { key: "invoice_due", label: "Invoices", icon: Receipt, color: "#ef4444" },
];

function CalendarPage() {
    const [view, setView] = useState<ViewMode>("month");
    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(
        new Set(["custom", "shipping", "production", "invoice_due"])
    );
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [clickedDay, setClickedDay] = useState<Date | undefined>();
    const [selectedEvent, setSelectedEvent] = useState<{ id: string; title: string; description?: string | null; type: string; referenceId?: string | number | null; referenceType?: string | null } | null>(null);

    const utils = trpc.useUtils();

    // Compute date window for the query
    const { from, to } = useMemo(() => {
        if (view === "month") {
            return {
                from: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }).toISOString(),
                to: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }).toISOString(),
            };
        } else {
            return {
                from: startOfDay(startOfWeek(currentDate, { weekStartsOn: 1 })).toISOString(),
                to: endOfDay(endOfWeek(currentDate, { weekStartsOn: 1 })).toISOString(),
            };
        }
    }, [view, currentDate]);

    const { data: events = [], isFetching } = trpc.calendar.getEvents.useQuery({
        from,
        to,
        types: Array.from(activeFilters),
    });

    const toggleFilter = (key: FilterKey) => {
        setActiveFilters(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const navigate = (direction: 1 | -1) => {
        if (view === "month") {
            setCurrentDate(d => direction === 1 ? addMonths(d, 1) : subMonths(d, 1));
        } else {
            setCurrentDate(d => direction === 1 ? addWeeks(d, 1) : subWeeks(d, 1));
        }
    };

    const heading = view === "month"
        ? format(currentDate, "MMMM yyyy")
        : `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d, yyyy")}`;

    const getReferenceLink = (ev: typeof selectedEvent) => {
        if (!ev?.referenceType || !ev?.referenceId) return null;
        if (ev.referenceType === "order") return `/orders/${ev.referenceId}`;
        if (ev.referenceType === "batch") return `/production/batches/${ev.referenceId}`;
        if (ev.referenceType === "invoice") return `/suppliers`;
        return null;
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-4 sm:p-6 gap-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div className="flex items-center gap-3">
                    <CalendarDays className="w-6 h-6 text-blue-600 shrink-0" />
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Business Calendar</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Shipping · Production · Invoices · Events</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* View toggle */}
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                        {(["month", "week"] as ViewMode[]).map(v => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`px-3 py-1 text-sm rounded-md transition-colors capitalize font-medium ${view === v ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => { setClickedDay(undefined); setShowAddDialog(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Event
                    </button>
                </div>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.map(f => (
                    <button
                        key={f.key}
                        onClick={() => toggleFilter(f.key)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${activeFilters.has(f.key)
                                ? "text-white border-transparent"
                                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                            }`}
                        style={activeFilters.has(f.key) ? { backgroundColor: f.color, borderColor: f.color } : {}}
                    >
                        <f.icon className="w-3 h-3" />
                        {f.label}
                    </button>
                ))}
                {isFetching && <span className="text-xs text-gray-400 self-center ml-1 animate-pulse">Refreshing…</span>}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h2 className="text-lg font-semibold text-gray-800 min-w-[180px] text-center">{heading}</h2>
                <button onClick={() => navigate(1)} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
                <button
                    onClick={() => setCurrentDate(new Date())}
                    className="ml-1 px-3 py-1 text-sm border rounded-md hover:bg-gray-50 transition-colors text-gray-700"
                >
                    Today
                </button>
            </div>

            {/* Calendar body */}
            <div className="flex-1 border rounded-xl overflow-hidden bg-white shadow-sm">
                {view === "month" ? (
                    <CalendarGrid
                        currentDate={currentDate}
                        events={events}
                        onDayClick={d => { setClickedDay(d); setShowAddDialog(true); }}
                        onEventClick={ev => setSelectedEvent(ev)}
                    />
                ) : (
                    <WeekView
                        currentDate={currentDate}
                        events={events}
                        onEventClick={ev => setSelectedEvent(ev)}
                    />
                )}
            </div>

            {/* Add event dialog */}
            {showAddDialog && (
                <AddEventDialog
                    defaultDate={clickedDay}
                    onClose={() => setShowAddDialog(false)}
                    onSuccess={() => utils.calendar.getEvents.invalidate()}
                />
            )}

            {/* Event detail popover */}
            {selectedEvent && (
                <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={() => setSelectedEvent(null)}>
                    <div
                        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-3"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="font-semibold text-gray-900">{selectedEvent.title}</h3>
                        {selectedEvent.description && (
                            <p className="text-sm text-gray-500">{selectedEvent.description}</p>
                        )}
                        <div className="flex items-center justify-between pt-2">
                            {getReferenceLink(selectedEvent) ? (
                                <Link
                                    to={getReferenceLink(selectedEvent) as any}
                                    className="text-sm text-blue-600 hover:underline font-medium"
                                    onClick={() => setSelectedEvent(null)}
                                >
                                    View record →
                                </Link>
                            ) : <span />}
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
