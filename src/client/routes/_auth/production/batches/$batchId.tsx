import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../../lib/trpc";
import {
    ArrowLeft,
    Calendar,
    Clock,
    CheckCircle2,
    XCircle,
    PlayCircle,
    ClipboardList,
    FlaskConical,
    Beaker,
    AlertTriangle,
    History,
    Check,
    Plus
} from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_auth/production/batches/$batchId")({
    component: BatchDetailPage,
});

function BatchDetailPage() {
    const { batchId } = Route.useParams();
    const navigate = useNavigate();
    const utils = trpc.useUtils();
    const [actualQuantity, setActualQuantity] = useState<number>(0);
    const [qaForm, setQaForm] = useState({ checkType: "visual", result: "pass", notes: "", value: "" });
    const [showQaForm, setShowQaForm] = useState(false);

    const { data: batch, isLoading } = trpc.production.batches.getById.useQuery({ id: batchId });

    const startBatch = trpc.production.batches.start.useMutation({
        onSuccess: () => utils.production.batches.getById.invalidate()
    });

    const completeBatch = trpc.production.batches.complete.useMutation({
        onSuccess: () => utils.production.batches.getById.invalidate()
    });

    const addQaCheck = trpc.production.batches.addQualityCheck.useMutation({
        onSuccess: () => {
            utils.production.batches.getById.invalidate();
            setShowQaForm(false);
            setQaForm({ checkType: "visual", result: "pass", notes: "", value: "" });
        }
    });

    if (isLoading) return <div className="p-8 text-center animate-pulse">Loading batch details...</div>;
    if (!batch) return <div className="p-8 text-center text-destructive">Batch not found</div>;

    const isPlanned = batch.status === "planned";
    const isInProgress = batch.status === "in_progress";
    const isCompleted = batch.status === "completed";

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                    <Link to="/production/batches" className="p-2 border rounded-xl hover:bg-muted transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold">{batch.batchNumber}</h1>
                            <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full border 
                    ${batch.status === 'completed' ? 'bg-green-50 text-green-600 border-green-200' :
                                    batch.status === 'in_progress' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                        'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                {batch.status.replace("_", " ")}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{batch.recipe.name}</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    {isPlanned && (
                        <button
                            onClick={() => startBatch.mutate({ batchId })}
                            className="bg-primary text-primary-foreground font-bold px-6 py-2 rounded-xl flex items-center gap-2 shadow-lg hover:bg-primary/90 transition-all"
                            disabled={startBatch.isPending}
                        >
                            <PlayCircle className="w-4 h-4" />
                            Start Production
                        </button>
                    )}
                    {isInProgress && (
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={actualQuantity || batch.plannedQuantity}
                                onChange={(e) => setActualQuantity(Number(e.target.value))}
                                className="w-32 border rounded-xl px-3 bg-background outline-none focus:ring-2 focus:ring-primary text-sm font-bold"
                                placeholder="Final Qty"
                            />
                            <button
                                onClick={() => completeBatch.mutate({ batchId, actualQuantity: actualQuantity || batch.plannedQuantity })}
                                className="bg-green-600 text-white font-bold px-6 py-2 rounded-xl flex items-center gap-2 shadow-lg hover:bg-green-700 transition-all"
                                disabled={completeBatch.isPending}
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Complete Batch
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Details Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-card border rounded-2xl shadow-sm p-6 space-y-6">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 border-b pb-2 text-primary">
                            <ClipboardList className="w-4 h-4" />
                            Material Consumption Ledger
                        </h2>
                        <div className="divide-y">
                            {batch.consumptions.length === 0 ? (
                                <div className="py-8 text-center text-muted-foreground italic text-sm">
                                    Materials will be logged once production starts.
                                </div>
                            ) : (
                                batch.consumptions.map((cons) => (
                                    <div key={cons.id} className="py-4 flex justify-between items-center group">
                                        <div className="space-y-0.5">
                                            <p className="font-semibold text-sm">{cons.rawMaterial.name}</p>
                                            <p className="text-[10px] text-muted-foreground tabular-nums">Logged: {format(new Date(cons.consumedAt), "MMM d, HH:mm")}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">{cons.actualQuantity} {cons.rawMaterial.unit}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-medium italic">Consumption Verified</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* QA Section */}
                    <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <FlaskConical className="w-4 h-4 text-purple-600" />
                                    Quality Control Logs
                                </h2>
                                {!isCompleted && (
                                    <button
                                        onClick={() => setShowQaForm(!showQaForm)}
                                        className="text-xs font-bold bg-muted hover:bg-primary/10 hover:text-primary transition-all px-3 py-1.5 rounded-lg flex items-center gap-1.5 border"
                                    >
                                        <Plus className="w-3 h-3" /> Add Check
                                    </button>
                                )}
                            </div>

                            {showQaForm && (
                                <div className="p-4 bg-muted/20 border rounded-xl space-y-4 animate-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest ml-1 opacity-60 text-primary">Test Type</label>
                                            <select
                                                value={qaForm.checkType}
                                                onChange={(e) => setQaForm({ ...qaForm, checkType: e.target.value })}
                                                className="w-full p-2 border rounded-lg bg-background text-xs outline-none focus:ring-1 focus:ring-primary"
                                            >
                                                {["visual", "chemical", "taste", "weight"].map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest ml-1 opacity-60 text-primary">Result</label>
                                            <select
                                                value={qaForm.result}
                                                onChange={(e) => setQaForm({ ...qaForm, result: e.target.value })}
                                                className="w-full p-2 border rounded-lg bg-background text-xs outline-none focus:ring-1 focus:ring-primary"
                                            >
                                                {["pass", "fail", "warning"].map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <textarea
                                            placeholder="Detailed QA findings..."
                                            value={qaForm.notes}
                                            onChange={(e) => setQaForm({ ...qaForm, notes: e.target.value })}
                                            className="w-full p-3 border rounded-lg bg-background text-xs h-20 outline-none"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setShowQaForm(false)} className="text-xs px-4 py-2 border rounded-lg">Cancel</button>
                                        <button
                                            onClick={() => addQaCheck.mutate({ batchId, ...qaForm, checkType: qaForm.checkType as any, result: qaForm.result as any })}
                                            className="text-xs px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg shadow-sm"
                                        >Log Assessment</button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                {batch.qualityChecks.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic py-4 text-center">No quality checks recorded for this batch yet.</p>
                                ) : (
                                    batch.qualityChecks.map((check) => (
                                        <div key={check.id} className="p-4 border rounded-xl flex gap-4 items-start bg-muted/10 group">
                                            <div className={`p-2 rounded-lg 
                             ${check.result === 'pass' ? 'bg-green-100 text-green-700' :
                                                    check.result === 'fail' ? 'bg-destructive/10 text-destructive' :
                                                        'bg-yellow-100 text-yellow-700'}`}>
                                                {check.result === 'pass' ? <Check className="w-4 h-4" /> :
                                                    check.result === 'fail' ? <XCircle className="w-4 h-4" /> :
                                                        <AlertTriangle className="w-4 h-4" />}
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-bold text-xs uppercase tracking-wider">{check.checkType} Test</h4>
                                                    <p className="text-[9px] font-medium text-muted-foreground">{format(new Date(check.createdAt), "MMM d, HH:mm")}</p>
                                                </div>
                                                <p className="text-xs leading-relaxed text-muted-foreground">{check.notes}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Stats */}
                <div className="space-y-6">
                    <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 border-b pb-2">
                            <History className="w-3.5 h-3.5" />
                            Lifecycle Timeline
                        </h3>
                        <div className="space-y-6 relative ml-2 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[1px] before:bg-muted-foreground/20">
                            <div className="relative pl-6">
                                <span className="absolute left-[-4.5px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-primary/10"></span>
                                <p className="text-xs font-bold">Batch Created</p>
                                <p className="text-[10px] text-muted-foreground">{format(new Date(batch.createdAt), "MMM d, HH:mm")}</p>
                            </div>
                            {batch.startedAt && (
                                <div className="relative pl-6 animate-in slide-in-from-left-2 transition-all">
                                    <span className="absolute left-[-4.5px] top-1.5 w-2 h-2 rounded-full bg-orange-500 ring-4 ring-orange-500/10"></span>
                                    <p className="text-xs font-bold">Production Started</p>
                                    <p className="text-[10px] text-muted-foreground">{format(new Date(batch.startedAt), "MMM d, HH:mm")}</p>
                                </div>
                            )}
                            {batch.completedAt && (
                                <div className="relative pl-6 animate-in slide-in-from-left-2 transition-all">
                                    <span className="absolute left-[-4.5px] top-1.5 w-2 h-2 rounded-full bg-green-500 ring-4 ring-green-500/10"></span>
                                    <p className="text-xs font-bold">Production Completed</p>
                                    <p className="text-[10px] text-muted-foreground">{format(new Date(batch.completedAt), "MMM d, HH:mm")}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                            <Beaker className="w-3.5 h-3.5" />
                            Recipe Reference
                        </h3>
                        <div className="space-y-1">
                            <p className="text-sm font-bold leading-tight">{batch.recipe.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono italic">Product ID: {batch.recipe.productId}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
