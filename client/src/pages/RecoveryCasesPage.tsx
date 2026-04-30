import { useEffect, useState } from 'react';
import { getAllRecoveryCases, advanceRecovery } from '../api/client';

export default function RecoveryCasesPage() {
    const [cases, setCases] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('All');
    const [advancingId, setAdvancingId] = useState<string | null>(null);
    const [nowTime, setNowTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNowTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchCases = async () => {
        try {
            const data = await getAllRecoveryCases();
            setCases(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCases();
    }, []);

    const handleAdvance = async (id: string) => {
        setAdvancingId(id);
        try {
            await advanceRecovery(id);
            await fetchCases();
        } catch (err) {
            alert("Failed to advance state.");
        } finally {
            setAdvancingId(null);
        }
    };

    const getDaysRemaining = (expiresAt: string) => {
        const remainingTicks = new Date(expiresAt).getTime() - new Date().getTime();
        const days = Math.ceil(remainingTicks / (1000 * 60 * 60 * 24));
        return Math.max(0, days);
    };

    const filteredCases = cases.filter(c => filterStatus === 'All' || c.status === filterStatus);

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

                <h1 className="text-sm font-bold tracking-widest text-white uppercase ml-auto lg:ml-0 md:hidden">Recovery Cases</h1>
            </header>

            <main className="max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-6 flex-1">
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl flex flex-col shadow-lg overflow-hidden relative">
                    <div className="px-5 py-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 bg-[var(--color-bg-elevated)]/50 backdrop-blur-sm">
                        <h2 className="text-sm font-bold tracking-widest text-[#e2e8f0] uppercase flex items-center gap-3">
                            <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            Dispute Resolution Matrix
                        </h2>

                        <select
                            className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-inner rounded text-xs px-3 py-2 text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)] font-bold tracking-wider uppercase font-mono"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="All">VERDICT: All</option>
                            <option value="INITIATED">INITIATED</option>
                            <option value="BANK_NOTIFIED">BANK_NOTIFIED</option>
                            <option value="RBI_ESCALATED">RBI_ESCALATED</option>
                            <option value="RESOLVED">RESOLVED</option>
                            <option value="EXPIRED">EXPIRED</option>
                        </select>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest bg-[var(--color-bg-card)] border-b border-[var(--color-border)] shadow-sm">
                                <tr>
                                    <th className="px-5 py-4 font-bold">Dispute ID / RRN</th>
                                    <th className="px-5 py-4 font-bold hidden md:table-cell">Complainant</th>
                                    <th className="px-5 py-4 font-bold">State Machine</th>
                                    <th className="px-5 py-4 font-bold text-right hidden lg:table-cell">Days Left</th>
                                    <th className="px-5 py-4 font-bold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border-subtle)]">
                                {filteredCases.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center justify-center text-[var(--color-text-muted)] space-y-4">
                                                <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                <p className="text-xs uppercase tracking-widest font-bold">No active dispute maps found.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {loading && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-10 space-y-4">
                                            {[...Array(5)].map((_, i) => (
                                                <div key={i} className="h-12 bg-[var(--color-border)]/30 rounded xl w-full animate-pulse my-2"></div>
                                            ))}
                                        </td>
                                    </tr>
                                )}
                                {filteredCases.map(c => {
                                    const days = getDaysRemaining(c.expiresAt);
                                    let daysColor = 'text-[var(--color-success)]';
                                    if (days <= 30 && days > 10) daysColor = 'text-[var(--color-warning)]';
                                    if (days <= 10) daysColor = 'text-[var(--color-danger)]';

                                    const stages = ['INITIATED', 'BANK_NOTIFIED', 'RBI_ESCALATED', 'RESOLVED'];
                                    const cIndex = stages.indexOf(c.status);

                                    return (
                                        <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-5 py-4">
                                                <div className="font-mono text-xs text-[var(--color-text-secondary)] truncate w-32 md:w-auto" title={c.id}>{c.id}</div>
                                                <div className="font-mono text-[10px] text-[var(--color-text-muted)] mt-1">RRN: <span className="text-white font-semibold">{c.transactionRrn}</span></div>
                                            </td>
                                            <td className="px-5 py-4 hidden md:table-cell">
                                                <div className="text-xs text-white font-medium">{c.complainantName}</div>
                                                <div className="text-[10px] font-mono text-[var(--color-text-muted)] mt-0.5">{c.complainantEmail}</div>
                                                <div className="text-xs font-mono font-bold text-[var(--color-text-secondary)] mt-1 tracking-wider">₹ {Number(c.amountDisputed).toLocaleString('en-IN')}</div>
                                            </td>
                                            <td className="px-5 py-4 min-w-[200px]">
                                                {c.status === 'EXPIRED' ? (
                                                    <span className="px-3 py-1 bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/20 rounded text-[10px] font-bold uppercase tracking-widest shadow-inner">EXPIRED</span>
                                                ) : (
                                                    <div className="flex flex-col gap-2 relative max-w-[220px]">
                                                        <div className="h-1 bg-[var(--color-border)] w-full rounded-full absolute top-[7px] -z-10"></div>
                                                        <div className="h-1 bg-[var(--color-accent)] rounded-full absolute top-[7px] -z-10 transition-all duration-500 shadow-[0_0_5px_var(--color-accent)]" style={{ width: `${(Math.max(0, cIndex) / (stages.length - 1)) * 100}%` }}></div>
                                                        <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                                            {stages.map((stage, idx) => (
                                                                <div key={stage} className="flex flex-col items-center group relative cursor-help" title={stage}>
                                                                    <div className={`w-4 h-4 rounded-full mb-1 border-2 transition-colors ${idx <= cIndex ? 'bg-[var(--color-accent)] border-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]' : 'bg-[var(--color-bg-card)] border-[var(--color-border)]'}`}></div>
                                                                    <span className={`transition-colors ${idx === cIndex ? 'text-white' : ''}`}>{stage.split('_')[0]}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-right hidden lg:table-cell">
                                                {c.status !== 'RESOLVED' && c.status !== 'EXPIRED' ? (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className={`font-mono text-xl font-black tracking-tight ${daysColor} drop-shadow-md`}>{days} <span className="text-[10px] tracking-widest uppercase">Days</span></span>
                                                        <span className="text-[9px] text-[var(--color-text-muted)] font-mono">{new Date(c.expiresAt).toLocaleDateString()}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold tracking-widest text-[var(--color-text-muted)] uppercase">Concluded</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-right space-y-2">
                                                {cIndex >= 0 && cIndex < stages.length - 1 && (
                                                    <button
                                                        onClick={() => handleAdvance(c.id)}
                                                        disabled={advancingId === c.id}
                                                        className="block w-full text-center text-[10px] font-bold uppercase tracking-widest text-white bg-[var(--color-accent)]/80 hover:bg-[var(--color-accent)] border border-[var(--color-accent)] py-2 px-3 rounded shadow-lg transition-all disabled:opacity-50 active:scale-[0.97]"
                                                    >
                                                        {advancingId === c.id ? 'Advancing...' : 'Advance State'}
                                                    </button>
                                                )}
                                                {c.pdfPath && (
                                                    <a
                                                        href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/generated-pdfs/${c.id}.pdf`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="block w-full text-center text-[10px] font-bold uppercase tracking-widest text-[var(--color-success)] bg-[var(--color-success)]/10 hover:bg-[var(--color-success)]/20 border border-[var(--color-success)]/30 py-2 px-3 rounded shadow-sm transition-all"
                                                    >
                                                        Download PDF
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
