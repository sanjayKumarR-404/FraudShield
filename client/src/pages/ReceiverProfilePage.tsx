import { useEffect, useState, useCallback } from 'react';
import { getAllReceiverProfiles, getReceiverProfile, getReceiverTransactions } from '../api/client';

const RISK_COLORS: Record<string, string> = {
    SAFE: '#10b981', SUSPICIOUS: '#f59e0b', HIGH_RISK: '#f97316', FRAUD_MULE: '#ef4444', UNKNOWN: '#6b7280',
};

type SortKey = 'riskScore' | 'fraudRate' | 'totalReceived' | 'uniqueSendersLast24h' | 'avgAmountReceived';

interface ReceiverTx {
    id: string; rrn: string; amount: string; status: string;
    senderVpa: string; timestamp: string; riskScore?: number;
}

interface DetailProfile {
    vpa: string;
    profile: any;
    transactions: ReceiverTx[];
}

function HeatmapGrid({ transactions }: { transactions: ReceiverTx[] }) {
    // 24h × 7 day grid: columns = days (0=Mon..6=Sun), rows = hour groups (0–5, 6–11, 12–17, 18–23)
    const grid: Record<string, { count: number; fraud: number }> = {};
    for (let d = 0; d < 7; d++) for (let h = 0; h < 4; h++) grid[`${d}-${h}`] = { count: 0, fraud: 0 };

    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    transactions.forEach(tx => {
        const t = new Date(tx.timestamp);
        if (t.getTime() < cutoff) return;
        const day = t.getDay();
        const hourBand = Math.floor(t.getHours() / 6);
        const key = `${day}-${hourBand}`;
        if (!grid[key]) grid[key] = { count: 0, fraud: 0 };
        grid[key].count += 1;
        if (tx.status === 'FROZEN') grid[key].fraud += 1;
    });

    const maxCount = Math.max(...Object.values(grid).map(v => v.count), 1);
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const hours = ['0–5', '6–11', '12–17', '18–23'];

    return (
        <div className="mt-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Activity Heatmap (7d)</p>
            <div className="flex gap-1">
                {/* Y-axis labels */}
                <div className="flex flex-col justify-around pr-1">
                    {hours.map(h => <span key={h} className="text-[7px] text-[var(--color-text-muted)] font-mono">{h}</span>)}
                </div>
                {/* Grid */}
                <div className="flex gap-1">
                    {days.map((day, d) => (
                        <div key={d} className="flex flex-col gap-1">
                            {hours.map((_h, h) => {
                                const cell = grid[`${d}-${h}`] || { count: 0, fraud: 0 };
                                const intensity = cell.count / maxCount;
                                const fraudRatio = cell.count > 0 ? cell.fraud / cell.count : 0;
                                const r = Math.round(16 + fraudRatio * 223);
                                const g = Math.round(185 - fraudRatio * 117);
                                const b = Math.round(129 - fraudRatio * 61);
                                return (
                                    <div key={h} className="heatmap-cell w-7 h-4" title={`Day ${day}, Hour ${_h}: ${cell.count} txns, ${cell.fraud} frozen`}
                                        style={{ backgroundColor: cell.count === 0 ? 'var(--color-bg-elevated)' : `rgb(${r},${g},${b})`, opacity: cell.count === 0 ? 0.3 : 0.4 + intensity * 0.6 }} />
                                );
                            })}
                            <span className="text-[7px] text-[var(--color-text-muted)] text-center font-mono">{day}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MiniLineChart({ transactions }: { transactions: ReceiverTx[] }) {
    if (transactions.length < 2) return <p className="text-[9px] text-[var(--color-text-muted)] mt-2">Not enough data</p>;
    const last20 = [...transactions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).slice(-20);
    const amounts = last20.map(t => Number(t.amount));
    const maxA = Math.max(...amounts, 1);
    const minA = Math.min(...amounts, 0);
    const range = maxA - minA || 1;
    const W = 220; const H = 50; const pad = 5;
    const pts = amounts.map((a, i) => {
        const x = pad + (i / (amounts.length - 1)) * (W - pad * 2);
        const y = H - pad - ((a - minA) / range) * (H - pad * 2);
        return `${x},${y}`;
    });
    const area = `M${pts[0]} L${pts.join(' L')} L${W - pad},${H - pad} L${pad},${H - pad} Z`;

    return (
        <div className="mt-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">Amount Trend (Last {last20.length} txns)</p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                <defs>
                    <linearGradient id="line-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
                    </linearGradient>
                </defs>
                <path d={area} fill="url(#line-fill)" />
                <polyline points={pts.join(' ')} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                {amounts.map((_a, i) => {
                    const t = last20[i];
                    const [x, y] = pts[i].split(',').map(Number);
                    return <circle key={i} cx={x} cy={y} r="2" fill={t.status === 'FROZEN' ? '#ef4444' : '#3b82f6'} />;
                })}
            </svg>
        </div>
    );
}

export default function ReceiverProfilePage() {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortKey, setSortKey] = useState<SortKey>('riskScore');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [filterCat, setFilterCat] = useState('All');
    const [searchVpa, setSearchVpa] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [detail, setDetail] = useState<DetailProfile | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [compareOpen, setCompareOpen] = useState(false);
    const [compareProfiles, setCompareProfiles] = useState<any[]>([]);

    const loadProfiles = useCallback(async () => {
        try {
            const data = await getAllReceiverProfiles();
            setProfiles(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadProfiles(); }, [loadProfiles]);

    const openDetail = async (vpa: string) => {
        setDetailLoading(true);
        try {
            const [profile, transactions] = await Promise.all([getReceiverProfile(vpa), getReceiverTransactions(vpa)]);
            setDetail({ vpa, profile, transactions });
        } catch (e) { console.error(e); }
        finally { setDetailLoading(false); }
    };

    const handleCompare = async () => {
        if (selected.length < 2) return;
        try {
            const data = await Promise.all(selected.map(vpa => getReceiverProfile(vpa)));
            setCompareProfiles(data);
            setCompareOpen(true);
        } catch (e) { console.error(e); }
    };

    const toggleSelect = (vpa: string) => {
        setSelected(prev => prev.includes(vpa) ? prev.filter(v => v !== vpa) : prev.length < 2 ? [...prev, vpa] : prev);
    };

    const sorted = [...profiles]
        .filter(p => (filterCat === 'All' || p.riskCategory === filterCat) && (!searchVpa || p.receiverVpa.toLowerCase().includes(searchVpa.toLowerCase())))
        .sort((a, b) => {
            const va = a[sortKey] || 0; const vb = b[sortKey] || 0;
            return sortDir === 'desc' ? vb - va : va - vb;
        });

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const SortTh = ({ k, label }: { k: SortKey; label: string }) => (
        <th className="px-3 py-3 font-bold cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort(k)}>
            <span className={sortKey === k ? 'text-[var(--color-accent)]' : ''}>{label}</span>
            {sortKey === k && <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>}
        </th>
    );

    // Trending data
    const fastGrowing = [...profiles].filter(p => p.riskCategory !== 'SAFE').sort((a, b) => b.fraudRate - a.fraudRate).slice(0, 5);
    const newSuspicious = [...profiles].filter(p => {
        const ageMs = Date.now() - new Date(p.firstSeenAt || p.createdAt || 0).getTime();
        return ageMs < 7 * 24 * 60 * 60 * 1000 && p.totalReceived > 5;
    }).slice(0, 4);
    const highValueMules = [...profiles].filter(p => p.avgAmountReceived > 50000).sort((a, b) => b.avgAmountReceived - a.avgAmountReceived).slice(0, 4);

    return (
        <div className="flex flex-col h-screen bg-[var(--color-bg-primary)] overflow-hidden">
            {/* Header */}
            <header className="bg-[var(--color-bg-card)] border-b border-[var(--color-border)] px-6 py-3 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-500 to-red-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">Receiver Intelligence</h1>
                        <p className="text-[10px] text-[var(--color-text-muted)] font-mono">{profiles.length} profiled receivers</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input type="text" placeholder="Search VPA..." value={searchVpa} onChange={e => setSearchVpa(e.target.value)}
                        className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] w-44" />
                    <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                        className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded px-2 py-1.5 text-[10px] font-bold uppercase text-[var(--color-text-secondary)] focus:outline-none">
                        {['All', 'SAFE', 'SUSPICIOUS', 'HIGH_RISK', 'FRAUD_MULE', 'UNKNOWN'].map(c => <option key={c}>{c}</option>)}
                    </select>
                    {selected.length === 2 && (
                        <button onClick={handleCompare} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-purple-500/20 border border-purple-500/40 text-purple-400 rounded hover:bg-purple-500/30 transition-all">
                            Compare ({selected.length})
                        </button>
                    )}
                </div>
            </header>

            {/* 3-column body */}
            <div className="flex flex-1 overflow-hidden gap-0">

                {/* Column 1: Table (50%) */}
                <div className="flex-1 overflow-y-auto border-r border-[var(--color-border)] custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <table className="w-full text-[10px]">
                            <thead className="sticky top-0 bg-[var(--color-bg-card)] z-10 text-[9px] text-[var(--color-text-muted)] uppercase tracking-widest border-b border-[var(--color-border)]">
                                <tr>
                                    <th className="px-3 py-3 text-left w-8">
                                        <span title="Select for comparison">☑</span>
                                    </th>
                                    <th className="px-3 py-3 text-left font-bold">VPA</th>
                                    <th className="px-3 py-3 text-left font-bold">Risk</th>
                                    <SortTh k="riskScore" label="Score" />
                                    <SortTh k="fraudRate" label="Fraud%" />
                                    <SortTh k="totalReceived" label="Txns" />
                                    <SortTh k="avgAmountReceived" label="Avg₹" />
                                    <th className="px-3 py-3 text-left font-bold">Trend</th>
                                    <th className="px-3 py-3 text-right font-bold">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border-subtle)]">
                                {sorted.length === 0 && (
                                    <tr><td colSpan={9} className="py-16 text-center text-[var(--color-text-muted)]">No receivers match filters</td></tr>
                                )}
                                {sorted.map(p => {
                                    const cat = p.riskCategory || 'UNKNOWN';
                                    const color = RISK_COLORS[cat] || '#6b7280';
                                    const isSel = selected.includes(p.receiverVpa);
                                    const isDetailOpen = detail?.vpa === p.receiverVpa;
                                    return (
                                        <tr key={p.receiverVpa} className={`transition-colors hover:bg-white/[0.02] ${isDetailOpen ? 'bg-[var(--color-accent)]/5' : ''}`}>
                                            <td className="px-3 py-2.5">
                                                <div onClick={() => toggleSelect(p.receiverVpa)}
                                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${isSel ? 'border-purple-500 bg-purple-500/20' : 'border-[var(--color-border)]'}`}>
                                                    {isSel && <span className="text-purple-400 font-black" style={{ fontSize: 8 }}>✓</span>}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="font-mono text-[var(--color-text-primary)] truncate max-w-[140px]" title={p.receiverVpa}>{p.receiverVpa}</div>
                                                {p.isNewAccount && <span className="text-[8px] font-bold text-[var(--color-warning)] uppercase tracking-widest">New</span>}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider" style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}>
                                                    {cat.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 font-mono font-bold" style={{ color }}>{(p.riskScore || 0).toFixed(3)}</td>
                                            <td className="px-3 py-2.5 font-mono" style={{ color: p.fraudRate > 0.5 ? 'var(--color-danger)' : p.fraudRate > 0.2 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                                                {((p.fraudRate || 0) * 100).toFixed(1)}%
                                            </td>
                                            <td className="px-3 py-2.5 font-mono text-[var(--color-text-secondary)]">{p.totalReceived || 0}</td>
                                            <td className="px-3 py-2.5 font-mono text-[var(--color-text-secondary)]">
                                                ₹{((p.avgAmountReceived || 0) / 1000).toFixed(0)}k
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[9px] font-bold ${p.fraudRate > 0.3 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                                                    {p.fraudRate > 0.3 ? '↑ Rising' : '↓ Stable'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <button onClick={() => openDetail(p.receiverVpa)}
                                                    className="text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded border border-[var(--color-accent)]/30 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-all">
                                                    View ›
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Column 2: Trending (25%) */}
                <div className="w-56 flex-shrink-0 overflow-y-auto border-r border-[var(--color-border)] p-3 space-y-5 custom-scrollbar">
                    {/* Fastest growing fraud */}
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-danger)] mb-2 flex items-center gap-1.5">
                            <span>🔴</span> Highest Fraud Rate
                        </p>
                        {fastGrowing.map(p => (
                            <div key={p.receiverVpa} className="mb-2 p-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-danger)]/40 transition-all"
                                onClick={() => openDetail(p.receiverVpa)}>
                                <p className="text-[9px] font-mono text-[var(--color-text-primary)] truncate">{p.receiverVpa}</p>
                                <div className="flex justify-between mt-0.5">
                                    <span className="text-[8px] text-[var(--color-text-muted)]">{p.riskCategory}</span>
                                    <span className="text-[8px] font-bold text-[var(--color-danger)]">{((p.fraudRate || 0) * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* New suspicious accounts */}
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-warning)] mb-2 flex items-center gap-1.5">
                            <span>⚠</span> New Accounts
                        </p>
                        {newSuspicious.length === 0 && <p className="text-[9px] text-[var(--color-text-muted)]">None recently</p>}
                        {newSuspicious.map(p => (
                            <div key={p.receiverVpa} className="mb-2 p-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-warning)]/20 cursor-pointer hover:border-[var(--color-warning)]/50 transition-all"
                                onClick={() => openDetail(p.receiverVpa)}>
                                <p className="text-[9px] font-mono text-[var(--color-text-primary)] truncate">{p.receiverVpa}</p>
                                <div className="flex justify-between mt-0.5">
                                    <span className="text-[8px] text-[var(--color-text-muted)]">{p.totalReceived} txns</span>
                                    <span className="text-[8px] font-bold text-[var(--color-warning)]">NEW</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* High-value mules */}
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-accent)] mb-2 flex items-center gap-1.5">
                            <span>💰</span> High Value
                        </p>
                        {highValueMules.length === 0 && <p className="text-[9px] text-[var(--color-text-muted)]">None detected</p>}
                        {highValueMules.map(p => (
                            <div key={p.receiverVpa} className="mb-2 p-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-accent)]/20 cursor-pointer hover:border-[var(--color-accent)]/40 transition-all"
                                onClick={() => openDetail(p.receiverVpa)}>
                                <p className="text-[9px] font-mono text-[var(--color-text-primary)] truncate">{p.receiverVpa}</p>
                                <div className="flex justify-between mt-0.5">
                                    <span className="text-[8px] text-[var(--color-text-muted)]">Avg</span>
                                    <span className="text-[8px] font-bold text-[var(--color-accent)]">₹{(p.avgAmountReceived / 1000).toFixed(0)}k</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Column 3: Receiver Detail Panel (25%) */}
                <div className="w-72 flex-shrink-0 overflow-y-auto bg-[var(--color-bg-card)] custom-scrollbar">
                    {!detail && !detailLoading && (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-muted)] p-6">
                            <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            <p className="text-[9px] uppercase tracking-widest font-bold text-center">Click "View ›" on any receiver to see details</p>
                        </div>
                    )}
                    {detailLoading && (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-7 h-7 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                    {detail && !detailLoading && (
                        <div className="p-4 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-accent)] mb-1">Receiver Detail</p>
                                    <p className="text-[9px] font-mono text-[var(--color-text-primary)] break-all">{detail.vpa}</p>
                                </div>
                                <button onClick={() => setDetail(null)} className="text-[var(--color-text-muted)] hover:text-white text-sm">✕</button>
                            </div>

                            {detail.profile && (
                                <>
                                    {/* Risk Badge */}
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest"
                                            style={{ color: RISK_COLORS[detail.profile.riskCategory] || '#6b7280', backgroundColor: `${RISK_COLORS[detail.profile.riskCategory] || '#6b7280'}15`, border: `1px solid ${RISK_COLORS[detail.profile.riskCategory] || '#6b7280'}40` }}>
                                            {detail.profile.riskCategory}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-[var(--color-text-primary)]">Score: {(detail.profile.riskScore || 0).toFixed(3)}</span>
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { label: 'Total Txns', value: detail.profile.totalReceived || 0 },
                                            { label: 'Fraud Flagged', value: detail.profile.totalFraudFlagged || 0 },
                                            { label: 'Fraud Rate', value: `${((detail.profile.fraudRate || 0) * 100).toFixed(1)}%` },
                                            { label: 'Senders 24h', value: detail.profile.uniqueSendersLast24h || 0 },
                                            { label: 'Avg Amount', value: `₹${Math.round(detail.profile.avgAmountReceived || 0).toLocaleString('en-IN')}` },
                                            { label: 'New Account', value: detail.profile.isNewAccount ? 'Yes' : 'No' },
                                        ].map(r => (
                                            <div key={r.label} className="comparison-metric">
                                                <span className="metric-label">{r.label}</span>
                                                <span className="text-sm font-bold font-mono text-[var(--color-text-primary)]">{r.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Amount trend chart */}
                            <MiniLineChart transactions={detail.transactions} />

                            {/* Activity heatmap */}
                            <HeatmapGrid transactions={detail.transactions} />

                            {/* Recent transactions */}
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Recent Transactions</p>
                                <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                                    {detail.transactions.slice(0, 10).map(tx => (
                                        <div key={tx.id} className="flex justify-between items-center px-2 py-1.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
                                            <div>
                                                <p className="text-[8px] font-mono text-[var(--color-text-muted)] truncate max-w-[100px]">{tx.senderVpa.split('@')[0]}</p>
                                                <p className="text-[8px] font-mono text-[var(--color-text-muted)]">{new Date(tx.timestamp).toLocaleDateString('en-IN')}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-mono font-bold text-[var(--color-text-primary)]">₹{Number(tx.amount).toLocaleString('en-IN')}</p>
                                                <span className={`text-[7px] font-bold uppercase ${tx.status === 'FROZEN' ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>{tx.status}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {detail.transactions.length === 0 && <p className="text-[9px] text-[var(--color-text-muted)] text-center py-3">No transactions found</p>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Comparison Modal */}
            {compareOpen && compareProfiles.length === 2 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-2xl">
                        <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">Receiver Comparison</h2>
                            <button onClick={() => setCompareOpen(false)} className="text-[var(--color-text-muted)] hover:text-white">✕</button>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div />
                                {compareProfiles.map(p => (
                                    <div key={p.receiverVpa} className="text-center">
                                        <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm"
                                            style={{ backgroundColor: RISK_COLORS[p.riskCategory] || '#6b7280' }}>
                                            {p.receiverVpa.charAt(0).toUpperCase()}
                                        </div>
                                        <p className="text-[9px] font-mono text-[var(--color-text-primary)] truncate">{p.receiverVpa}</p>
                                    </div>
                                ))}
                            </div>
                            {[
                                { label: 'Risk Category', key: 'riskCategory', fmt: (v: any) => v },
                                { label: 'Risk Score', key: 'riskScore', fmt: (v: any) => Number(v || 0).toFixed(3) },
                                { label: 'Fraud Rate', key: 'fraudRate', fmt: (v: any) => `${(Number(v || 0) * 100).toFixed(1)}%` },
                                { label: 'Total Received', key: 'totalReceived', fmt: (v: any) => v },
                                { label: 'Fraud Flagged', key: 'totalFraudFlagged', fmt: (v: any) => v },
                                { label: 'Avg Amount', key: 'avgAmountReceived', fmt: (v: any) => `₹${Math.round(Number(v || 0)).toLocaleString('en-IN')}` },
                                { label: 'Senders 24h', key: 'uniqueSendersLast24h', fmt: (v: any) => v },
                            ].map(row => (
                                <div key={row.key} className="grid grid-cols-3 gap-3 mb-2 py-2 border-b border-[var(--color-border-subtle)]">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{row.label}</span>
                                    {compareProfiles.map((p, i) => (
                                        <span key={i} className="comparison-metric">
                                            <span className={`text-sm font-bold font-mono ${i === 0 ? 'text-blue-400' : 'text-purple-400'}`}>
                                                {row.fmt(p[row.key] ?? 0)}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
