import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { X, Calendar } from "lucide-react";

interface AddEventDialogProps {
    defaultDate?: Date;
    onClose: () => void;
    onSuccess: () => void;
}

export function AddEventDialog({ defaultDate, onClose, onSuccess }: AddEventDialogProps) {
    const defaultStr = defaultDate
        ? defaultDate.toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startDate, setStartDate] = useState(defaultStr);
    const [endDate, setEndDate] = useState("");
    const [allDay, setAllDay] = useState(true);
    const [color, setColor] = useState("#6b7280");

    const create = trpc.calendar.createEvent.useMutation({
        onSuccess: () => { onSuccess(); onClose(); },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        create.mutate({
            title,
            description: description || undefined,
            startDate: new Date(startDate).toISOString(),
            endDate: endDate ? new Date(endDate).toISOString() : undefined,
            allDay,
            color,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        Add Event
                    </h2>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                        <input
                            required
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Event title"
                            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={2}
                            placeholder="Optional notes"
                            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 resize-none"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="allDay" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="rounded" />
                        <label htmlFor="allDay" className="text-sm text-gray-700 dark:text-gray-300">All day</label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start *</label>
                            <input
                                required
                                type={allDay ? "date" : "datetime-local"}
                                value={allDay ? startDate.slice(0, 10) : startDate}
                                onChange={e => setStartDate(allDay ? e.target.value + "T00:00" : e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End</label>
                            <input
                                type={allDay ? "date" : "datetime-local"}
                                value={allDay ? endDate.slice(0, 10) : endDate}
                                onChange={e => setEndDate(allDay ? e.target.value + "T23:59" : e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
                        <div className="flex items-center gap-2">
                            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border" />
                            <span className="text-sm text-gray-500">{color}</span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded-md transition-colors">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={create.isPending}
                            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
                        >
                            {create.isPending ? "Saving..." : "Add Event"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
