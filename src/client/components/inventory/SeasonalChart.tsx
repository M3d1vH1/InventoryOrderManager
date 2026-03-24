import React from 'react';

interface PatternData {
    month: number;
    demandMultiplier: number;
    sampleSize: number;
}

export function SeasonalChart({ data }: { data: PatternData[] }) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (!data?.length) return <div className="text-gray-500 text-sm">No historical seasonal data available.</div>;

    const maxMultiplier = Math.max(...data.map(d => Number(d.demandMultiplier)), 1.5);

    return (
        <div className="flex items-end space-x-1 sm:space-x-2 h-40 w-full pt-6">
            {months.map((m, i) => {
                const item = data.find(d => d.month === i + 1);
                const multiplier = item ? Number(item.demandMultiplier) : 0;
                const heightPct = (multiplier / maxMultiplier) * 100;

                return (
                    <div key={m} className="flex-1 flex flex-col justify-end items-center group relative cursor-help">
                        <div
                            className={`w-full rounded-t-sm transition-all duration-300 ${multiplier > 1.2 ? 'bg-amber-400 dark:bg-amber-500' :
                                    multiplier > 0.8 ? 'bg-blue-400 dark:bg-blue-500' :
                                        'bg-slate-300 dark:bg-slate-600'
                                }`}
                            style={{ height: `${Math.max(heightPct, 2)}%` }}
                        />
                        <span className="text-[10px] text-gray-500 mt-1">{m}</span>
                        <div className="absolute -top-8 bg-gray-800 text-white text-xs px-2 py-1 rounded hidden group-hover:block z-10 whitespace-nowrap shadow-lg">
                            {multiplier.toFixed(2)}x
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
