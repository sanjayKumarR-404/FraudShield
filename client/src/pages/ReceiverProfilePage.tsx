import { useEffect, useState } from 'react';
import { getAllReceiverProfiles, getFraudMules } from '../api/client';

interface ReceiverProfile {
    id: string;
    receiverVpa: string;
    totalReceived: number;
    totalFraudFlagged: number;
    fraudRate: number;
    uniqueSendersLast24h: number;
    totalAmountLast24h: number;
    avgAmountReceived: number;
    isNewAccount: boolean;
    firstSeenAt: string;
    lastSeenAt: string;
    riskScore: number;
    riskCategory: string;
    createdAt: string;
}

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
    SAFE: { color: '#10b981', bg: 'bg-[#10b981]/10', border: 'border-[#10b981]/30', label: 'SAFE' },
    SUSPICIOUS: { color: '#f59e0b', bg: 'bg-[#f59e0b]/10', border: 'border-[#f59e0b]/30', label: 'SUSP' },
    HIGH_RISK: { color: '#f97316', bg: 'bg-[#f97316]/10', border: 'border-[#f97316]/30', label: 'HIGH' },
    FRAUD_MULE: { color: '#ef4444', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/30', label: 'MULE' },
    UNKNOWN: { color: '#6b7280', bg: 'bg-gray-500/10', border: 'border-gray-500/30', label: 'UNK' },
};

function CategoryBadge({ category }: { category: string }) {
    const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.UNKNOWN;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${cfg.bg} ${cfg.border} ${category === 'FRAUD_MULE' ? 'badge-mule' : ''}`}
            style={{ color: cfg.color }}>
            {cfg.label}
        </span>
    );
}

// SVG Donut Chart
function DonutChart({ data }: { data: Record<string, number> }) {
    const COLORS: Record<string, string> = {
        SAFE: '#10b981',
        SUSPICIOUS: '#f59e0b',
        HIGH_RISK: '#f97316',
        FRAUD_MULE: '#ef4444',
        UNKNOWN: '#6b7280',
    };
    const total = Object.values(data).reduce((s, v) => s + v, 0);
    if (total === 0) return <div className="text-[var(--color-text-muted)] text-xs text-center py-8">No data yet</div>;

    let cumAngle = -Math.PI / 2;
    const slices = Object.entries(data).map(([key, value]) => {
        const angle = (value / total) * 2 * Math.PI;
        const x1 = 100 + 70 * Math.cos(cumAngle);
        const y1 = 100 + 70 * Math.sin(cumAngle);
        cumAngle += angle;
        const x2 = 100 + 70 * Math.cos(cumAngle);
        const y2 = 100 + 70 * Math.sin(cumAngle);
        const largeArc = angle > Math.PI ? 1 : 0;
        return { key, value, color: COLORS[key] || '#6b7280', x1, y1, x2, y2, largeArc, angle };
    }).filter(s => s.angle > 0);

    return (
        <div className="flex items-center gap-6">
            <svg viewBox="0 0 200 200" className="w-32 h-32 flex-shrink-0">
                {slices.map((s) => (
                    <path key={s.key}
                        d={`M 100 100 L ${s.x1} ${s.y1} A 70 70 0 ${s.largeArc} 1 ${s.x2} ${s.y2} Z`}
                        fill={s.color} fillOpacity="0.85"
                        stroke="var(--color-bg-card)" strokeWidth="2"
                    />
                ))}
                {/* Center hole */}
                <circle cx={100} cy={100} r={45} fill="var(--color-bg-card)" />
                <text x={100} y={97} textAnchor="middle" fill="var(--color-text-primary)" fontSize="14" fontWeight="bold">{total}</text>
                <text x={100} y={112} textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="bold">RECEIVERS</text>
            </svg>
            <div className="flex flex-col gap-1.5">
                {slices.map(s => (
                    <div key={s.key} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.key}</span>
                        <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{s.value} ({((s.value / total) * 100).toFixed(0)}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ReceiverProfilePage() {
    const [profiles, setProfiles] = useState<ReceiverProfile[]>([]);
    const [mules, setMules] = useState<ReceiverProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<keyof ReceiverProfile>('riskScore');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        const load = async () => {
            try {
                const [allProfiles, mulesData] = await Promise.all([
                    getAllReceiverProfiles(),
                    getFraudMules(),
                ]);
                setProfiles(allProfiles);
                setMules(mulesData);
            } catch (err) {
                console.error('Failed to load receiver profiles:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const toggleSort = (key: keyof ReceiverProfile) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const filtered = profiles
        .filter(p => !search || p.receiverVpa.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            const av = a[sortKey] as number | string;
            const bv = b[sortKey] as number | string;
            if (typeof av === 'number' && typeof bv === 'number') {
                return sortDir === 'desc' ? bv - av : av - bv;
            }
            return sortDir === 'desc' ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
        });

    // Distribution for donut chart
    const distribution = profiles.reduce((acc, p) => {
        acc[p.riskCategory] = (acc[p.riskCategory] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const SortHeader = ({ label, col }: { label: string; col: keyof ReceiverProfile }) => (
        <th
            className="px-4 py-3 font-bold cursor-pointer hover:text-white transition-colors select-none"
            onClick={() => toggleSort(col)}
        >
            <span className="flex items-center gap-1">
                {label}
                {sortKey === col && <span>{sortDir === 'desc' ? '↓' : '↑'}</span>}
            </span>
        </th>
    );

    return (
        <div className="font-sans">
            {/* Header */}
            <header className="bg-[var(--color-bg-card)] border-b border-[var(--color-border)] px-6 py-3.5 flex items-center gap-4 sticky top-0 z-30">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#f97316] to-[#ef4444] flex items-center justify-center shadow-lg">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">Receiver Intelligence</h1>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{profiles.length} receiver profiles · {mules.length} fraud mules identified</p>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6">

                {/* Distribution Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-lg">
                        <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Risk Distribution</h2>
                        <DonutChart data={distribution} />
                    </div>

                    {/* Stats Cards */}
                    <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Profiles', value: profiles.length, color: '#3b82f6' },
                            { label: 'Fraud Mules', value: mules.length, color: '#ef4444' },
                            { label: 'High Risk', value: profiles.filter(p => p.riskCategory === 'HIGH_RISK').length, color: '#f97316' },
                            { label: 'Suspicious', value: profiles.filter(p => p.riskCategory === 'SUSPICIOUS').length, color: '#f59e0b' },
                        ].map(card => (
                            <div key={card.label} className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-5 shadow-lg">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">{card.label}</p>
                                <p className="text-3xl font-black font-mono" style={{ color: card.color }}>{card.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Fraud Mules Alert Section */}
                {mules.length > 0 && (
                    <div className="bg-[#ef4444]/5 border border-[#ef4444]/30 rounded-2xl p-5 shadow-lg">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-[#ef4444]/20 border border-[#ef4444]/30 flex items-center justify-center">
                                <svg className="w-4 h-4 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-widest text-[#ef4444]">⚠ Identified Fraud Mules</h2>
                                <p className="text-[10px] text-[var(--color-text-muted)]">{mules.length} accounts classified as money mule accounts</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {mules.map(mule => (
                                <div key={mule.id} className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl p-3">
                                    <p className="text-xs font-mono text-[#ef4444] font-bold truncate mb-1">{mule.receiverVpa}</p>
                                    <div className="flex gap-3 text-[9px] text-[var(--color-text-muted)]">
                                        <span>Fraud Rate: <strong className="text-[#ef4444]">{(mule.fraudRate * 100).toFixed(0)}%</strong></span>
                                        <span>Senders: <strong className="text-white">{mule.uniqueSendersLast24h}</strong></span>
                                    </div>
                                    <div className="mt-2 h-1 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
                                        <div className="h-full bg-[#ef4444] rounded-full" style={{ width: `${Math.min(100, mule.riskScore * 100)}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Top Risk Receivers Table */}
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl shadow-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">Receiver Risk Table</h2>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search VPA..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] w-48 transition-colors placeholder:text-[var(--color-text-muted)]"
                            />
                            <svg className="w-3.5 h-3.5 absolute right-3 top-[7px] text-[var(--color-text-muted)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest sticky top-0 bg-[var(--color-bg-card)] border-b border-[var(--color-border)]">
                                <tr>
                                    <th className="px-4 py-3 font-bold text-left">VPA</th>
                                    <SortHeader label="Risk" col="riskScore" />
                                    <SortHeader label="Fraud Rate" col="fraudRate" />
                                    <SortHeader label="Total Txns" col="totalReceived" />
                                    <SortHeader label="Senders (24h)" col="uniqueSendersLast24h" />
                                    <SortHeader label="Avg Amount" col="avgAmountReceived" />
                                    <th className="px-4 py-3 font-bold text-left">First Seen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border-subtle)]">
                                {loading && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                                                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">Loading profiles...</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {!loading && filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-16 text-center">
                                            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">
                                                {search ? 'No receivers match your search' : 'No receiver profiles yet — submit some transactions!'}
                                            </p>
                                        </td>
                                    </tr>
                                )}
                                {filtered.map((profile) => {
                                    const rowColors: Record<string, string> = {
                                        FRAUD_MULE: 'bg-[#ef4444]/5 hover:bg-[#ef4444]/10',
                                        HIGH_RISK: 'bg-[#f97316]/5 hover:bg-[#f97316]/10',
                                        SUSPICIOUS: 'bg-[#f59e0b]/5 hover:bg-[#f59e0b]/10',
                                        SAFE: 'hover:bg-white/[0.03]',
                                        UNKNOWN: 'hover:bg-white/[0.03]',
                                    };
                                    return (
                                        <tr key={profile.id} className={`transition-colors ${rowColors[profile.riskCategory] || 'hover:bg-white/[0.03]'}`}>
                                            <td className="px-4 py-3">
                                                <p className="text-xs font-mono text-[var(--color-text-primary)] truncate max-w-[200px]" title={profile.receiverVpa}>
                                                    {profile.receiverVpa}
                                                </p>
                                                <CategoryBadge category={profile.riskCategory} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">{profile.riskScore.toFixed(3)}</span>
                                                    <div className="w-16 h-1.5 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full"
                                                            style={{
                                                                width: `${Math.min(100, profile.riskScore * 100)}%`,
                                                                backgroundColor: CATEGORY_CONFIG[profile.riskCategory]?.color || '#6b7280'
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-mono text-[var(--color-text-secondary)]">
                                                {(profile.fraudRate * 100).toFixed(1)}%
                                            </td>
                                            <td className="px-4 py-3 text-xs font-mono text-[var(--color-text-secondary)]">
                                                {profile.totalReceived}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-mono">
                                                <span className={profile.uniqueSendersLast24h >= 10 ? 'text-[#ef4444] font-bold' : 'text-[var(--color-text-secondary)]'}>
                                                    {profile.uniqueSendersLast24h}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-mono text-[var(--color-text-secondary)]">
                                                ₹{profile.avgAmountReceived.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="px-4 py-3 text-[10px] font-mono text-[var(--color-text-muted)]">
                                                {new Date(profile.firstSeenAt).toLocaleDateString('en-IN')}
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
