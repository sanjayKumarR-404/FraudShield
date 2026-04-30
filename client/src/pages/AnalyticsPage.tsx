import { useEffect, useState } from 'react';
import { getAllTransactions, getAllRecoveryCases } from '../api/client';

export default function AnalyticsPage() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [recoveries, setRecoveries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [nowTime, setNowTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNowTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const txs = await getAllTransactions();
                const recs = await getAllRecoveryCases();
                setTransactions(txs);
                setRecoveries(recs);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    // Calculated metrics
    const totalTx = transactions.length;
    const frozenTx = transactions.filter(t => t.status === 'FROZEN');
    const totalFrozen = frozenTx.length;
    const totalRecovered = recoveries.filter(r => r.status === 'RESOLVED').length;
    const avgRisk = totalTx > 0 ? (transactions.reduce((acc, t) => acc + (Number(t.riskScore) || 0), 0) / totalTx).toFixed(4) : "0.0000";

    // Charts Maps
    const safeCount = transactions.filter(t => (Number(t.riskScore) || 0) < 0.3).length;
    const medCount = transactions.filter(t => (Number(t.riskScore) || 0) >= 0.3 && (Number(t.riskScore) || 0) < 0.65).length;
    const highCount = transactions.filter(t => (Number(t.riskScore) || 0) >= 0.65).length;
    const startOffsetMed = (safeCount / (totalTx || 1)) * 100;
    const startOffsetHigh = startOffsetMed + ((medCount / (totalTx || 1)) * 100);

    const locations = Array.from(new Set(transactions.map(t => t.location || 'Unknown')));
    const locationStats = locations.map(loc => {
        const locTxs = transactions.filter(t => (t.location || 'Unknown') === loc);
        const avg = locTxs.reduce((a, b) => a + (Number(b.riskScore) || 0), 0) / locTxs.length;
        return { name: loc, count: locTxs.length, avg };
    }).sort((a, b) => b.count - a.count).slice(0, 8);

    // Mock line chart trend purely for aesthetic simulation using actual counts but distributed
    // since we don't have deeply historical buckets in demo
    const yMax = Math.max(10, totalTx + 10);
    const getTrendPoints = (val: number, points: number) => {
        let pts = [];
        let curr = 0;
        for (let i = 0; i < points; i++) {
            curr += val / points + (Math.random() * (val / points) - (val / (points * 2)));
            pts.push(Math.max(0, curr));
        }
        return pts.map((p, i) => `${(i / (points - 1)) * 100},${100 - (p / yMax) * 100}`).join(' L ');
    }
    const trendSafe = getTrendPoints(totalTx, 7);
    const trendRisk = getTrendPoints(totalFrozen, 7);

    return (
        <div className="font-sans relative flex flex-col min-h-screen pb-20">
            {/* Header matches dashboard */}
            <header className="bg-[var(--color-bg-card)] border-b border-[var(--color-border)] px-4 md:px-6 py-3.5 flex justify-between items-center sticky top-0 z-30 shadow-sm backdrop-blur-md bg-opacity-95">
                <div className="flex items-center gap-4 hidden md:flex">
                    <div className="flex items-center gap-2 px-2.5 py-1 text-[11px] rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] font-mono text-[var(--color-text-secondary)] shadow-inner">
                        <span>SYS_ADMIN: agent@fraudshield.internal</span>
                    </div>
                </div>

                <div className="hidden lg:flex flex-col items-center justify-center absolute left-1/2 -translate-x-1/2">
                    <span className="text-sm font-mono text-white tracking-wider">{nowTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}</span>
                    <span className="text-xs font-mono text-[var(--color-text-muted)]">{nowTime.toLocaleTimeString('en-US', { hour12: false })}</span>
                </div>

                <h1 className="text-sm font-bold tracking-widest text-white uppercase ml-auto lg:ml-0 md:hidden">System Analytics</h1>
            </header>

            <main className="max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-6 flex-1 animate-in fade-in duration-500">
                {/* Metric Cards Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 rounded-2xl shadow-lg relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent-glow)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-text-muted)] mb-2 relative z-10">Total Transactions</p>
                        <p className="text-3xl lg:text-4xl font-bold text-white font-mono relative z-10">{totalTx.toLocaleString()}</p>
                    </div>
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 rounded-2xl shadow-lg relative overflow-hidden group">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-text-muted)] mb-2 relative z-10">Total Frozen</p>
                        <p className="text-3xl lg:text-4xl font-bold text-[var(--color-danger)] font-mono relative z-10">{totalFrozen.toLocaleString()}</p>
                    </div>
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 rounded-2xl shadow-lg relative overflow-hidden group">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-text-muted)] mb-2 relative z-10">Disputes Resolved</p>
                        <p className="text-3xl lg:text-4xl font-bold text-[var(--color-success)] font-mono relative z-10">{totalRecovered.toLocaleString()}</p>
                    </div>
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 rounded-2xl shadow-lg relative overflow-hidden group">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-text-muted)] mb-2 relative z-10">Global Average Risk</p>
                        <p className="text-3xl lg:text-4xl font-bold text-[var(--color-warning)] font-mono relative z-10">{avgRisk}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* SVG Line Chart */}
                    <div className="lg:col-span-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 rounded-2xl shadow-lg flex flex-col min-h-[350px] overflow-hidden">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-[#e2e8f0] flex items-center gap-2">
                                <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                Fraud Volume Trend
                            </h2>
                            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[var(--color-accent)]"></div>Volume</span>
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[var(--color-danger)]"></div>Frozen</span>
                            </div>
                        </div>
                        <div className="flex-1 relative w-full border-b border-l border-[var(--color-border)] pt-4 pb-2 px-2">
                            <svg className="w-full h-full text-[var(--color-border-subtle)]" preserveAspectRatio="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                                {/* Grid Lines */}
                                {[20, 40, 60, 80].map(y => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />)}

                                {/* Trend Lines */}
                                {!loading && totalTx > 0 && (
                                    <>
                                        <g className="animate-[dash_2s_ease-out_forwards]" style={{ strokeDasharray: 200, strokeDashoffset: 200 }}>
                                            <path d={`M 0,100 L ${trendSafe}`} fill="none" stroke="var(--color-accent)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                                            {/* Fill Gradient */}
                                            <path d={`M 0,100 L ${trendSafe} L 100,100 Z`} fill="var(--color-accent-glow)" opacity="0.3" stroke="none" />
                                        </g>
                                        <g className="animate-[dash_2.5s_ease-out_forwards]" style={{ strokeDasharray: 200, strokeDashoffset: 200 }}>
                                            <path d={`M 0,100 L ${trendRisk}`} fill="none" stroke="var(--color-danger)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                                        </g>
                                    </>
                                )}
                            </svg>
                            {loading && <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)] text-[10px] font-bold tracking-widest uppercase animate-pulse">Rendering Vectors...</div>}
                            <style>{`@keyframes dash { to { stroke-dashoffset: 0; } }`}</style>
                        </div>
                    </div>

                    {/* SVG Donut Chart */}
                    <div className="lg:col-span-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 rounded-2xl shadow-lg flex flex-col min-h-[350px]">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-[#e2e8f0] flex items-center gap-2 mb-6">
                            Risk Distribution Matrix
                        </h2>
                        <div className="flex-1 flex justify-center items-center relative">
                            {loading ? (
                                <div className="w-40 h-40 border-4 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <svg viewBox="0 0 100 100" className="w-[85%] h-[85%] max-w-[200px] -rotate-90 origin-center drop-shadow-xl animate-in zoom-in-95 duration-700">
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-success)" strokeWidth="16" strokeDasharray={`${Math.max(0, startOffsetMed - 1)} 100`} />
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-warning)" strokeWidth="16" strokeDasharray={`${Math.max(0, startOffsetHigh - startOffsetMed - 1)} 100`} strokeDashoffset={`-${startOffsetMed}`} />
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-danger)" strokeWidth="16" strokeDasharray={`${Math.max(0, 100 - startOffsetHigh)} 100`} strokeDashoffset={`-${startOffsetHigh}`} />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                                        <span className="text-3xl font-black text-white">{totalTx}</span>
                                        <span className="text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">Evaluations</span>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest mt-6 pt-4 border-t border-[var(--color-border)]">
                            <span className="text-[var(--color-success)] relative pl-3 border-l-2 border-[var(--color-success)]">{((safeCount / totalTx) * 100).toFixed(0)}% Safe</span>
                            <span className="text-[var(--color-warning)] relative pl-3 border-l-2 border-[var(--color-warning)]">{((medCount / totalTx) * 100).toFixed(0)}% Mod</span>
                            <span className="text-[var(--color-danger)] relative pl-3 border-l-2 border-[var(--color-danger)]">{((highCount / totalTx) * 100).toFixed(0)}% Crit</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Location Heatmap Data */}
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 rounded-2xl shadow-lg">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-[#e2e8f0] flex items-center gap-2 mb-6">
                            Location Risk Vector Heatmap
                        </h2>
                        <div className="space-y-4">
                            {locationStats.length === 0 && !loading && <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest">No nodes tracked</span>}
                            {locationStats.map((loc, idx) => (
                                <div key={idx} className="flex flex-col gap-1.5 animate-in slide-in-from-bottom flex-1" style={{ animationDelay: `${idx * 100}ms` }}>
                                    <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest">
                                        <span className="text-[var(--color-text-primary)]">{loc.name}</span>
                                        <span className="text-[var(--color-text-secondary)] font-mono">{loc.count} TX</span>
                                    </div>
                                    <div className="w-full bg-[var(--color-bg-primary)] h-1.5 rounded-full overflow-hidden flex">
                                        <div className={`h-full opacity-90 transition-all duration-1000 ${loc.avg >= 0.65 ? 'bg-[var(--color-danger)]' : loc.avg > 0.3 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]'}`} style={{ width: `${(loc.count / Math.max(...locationStats.map(x => x.count))) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 rounded-2xl shadow-lg max-h-[450px] overflow-y-auto custom-scrollbar">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-[#e2e8f0] flex items-center gap-2 mb-6 sticky top-0 bg-[var(--color-bg-card)] pb-4 z-10 border-b border-[var(--color-border)]">
                            Temporal Event Feed
                        </h2>
                        <div className="relative border-l-2 border-[var(--color-border)] ml-3 space-y-8 pb-4">
                            {transactions.slice(0, 10).map((tx, idx) => (
                                <div key={tx.id} className="relative pl-6 animate-in fade-in" style={{ animationDelay: `${idx * 150}ms` }}>
                                    <span className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full border-2 border-[var(--color-bg-card)] ${tx.status === 'FROZEN' ? 'bg-[var(--color-danger)] shadow-[0_0_8px_var(--color-danger)]' : 'bg-[var(--color-success)]'}`}></span>
                                    <div className="flex flex-col gap-1 bg-[var(--color-bg-elevated)] p-3 rounded-lg border border-[var(--color-border)] shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <span className="text-[10px] font-mono font-black tracking-widest text-[var(--color-text-muted)]">
                                                {tx.createdAt || tx.timestamp ? new Date((tx.createdAt || tx.timestamp) as string).toLocaleTimeString() : 'N/A'}
                                            </span>
                                            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${tx.status === 'FROZEN' ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' : 'bg-[var(--color-success)]/10 text-[var(--color-success)]'}`}>{tx.status}</span>
                                        </div>
                                        <div className="font-mono text-xs text-white">₹ {Number(tx.amount).toLocaleString('en-IN')}</div>
                                        <div className="font-mono text-[9px] text-[var(--color-text-secondary)] mt-1 truncate">{tx.senderVpa} → {tx.receiverVpa}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
