import { useEffect, useState } from 'react';
import { getRecoveryByTransaction, initiateRecovery } from '../api/client';

export default function TransactionDetailModal({ tx, onClose }: { tx: any, onClose: () => void }) {
    const [recoveryInfo, setRecoveryInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [initLoading, setInitLoading] = useState(false);

    useEffect(() => {
        if (!tx) return;
        const fetchInfo = async () => {
            try {
                const data = await getRecoveryByTransaction(tx.id);
                setRecoveryInfo(data);
            } catch (e) {
                // If 404 or fails, it means no case exists
            } finally {
                setLoading(false);
            }
        };
        fetchInfo();
    }, [tx]);

    if (!tx) return null;

    const riskScore = Number(tx.riskScore || 0);
    const rotation = -90 + (riskScore * 180); // maps 0 to -90deg, 1 to 90deg

    const handleInitiate = async () => {
        setInitLoading(true);
        try {
            await initiateRecovery(tx.id, "Internal Alert Agent", "agent@fraudshield", tx.senderVpa, Number(tx.amount));
            const data = await getRecoveryByTransaction(tx.id);
            setRecoveryInfo(data);
        } catch (e) {
            console.error(e);
            alert("Failed to fast-track recovery.");
        } finally {
            setInitLoading(false);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'SUCCESS': return 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/30';
            case 'FROZEN': return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/30';
            case 'PENDING': return 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/30';
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
        }
    };

    const styles = getStatusStyle(tx.status);

    return (
        <div className="fixed inset-0 z-[100] flex justify-center items-center p-4 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in" onClick={onClose}>
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

                {/* Left Side: Detail Matrix */}
                <div className="flex-1 border-r border-[var(--color-border)] flex flex-col">
                    <div className="px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1">RRN Primary Key</p>
                            <h2 className="text-xl font-mono tracking-wider text-white font-semibold">{tx.rrn}</h2>
                        </div>
                        <span className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest rounded-md border ${styles}`}>
                            {tx.status}
                        </span>
                    </div>

                    <div className="p-6 bg-[var(--color-bg-card)] grid grid-cols-2 gap-y-6 gap-x-4 flex-1">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] mb-1.5">Sender VPA Address</p>
                            <p className="text-sm font-mono text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] p-2 rounded border border-[var(--color-border-subtle)] truncate" title={tx.senderVpa}>{tx.senderVpa}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] mb-1.5">Target Receiver VPA</p>
                            <p className="text-sm font-mono text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] p-2 rounded border border-[var(--color-border-subtle)] truncate" title={tx.receiverVpa}>{tx.receiverVpa}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] mb-1.5">Network Volume</p>
                            <p className="text-sm font-mono font-bold text-white bg-[var(--color-bg-elevated)] p-2 rounded border border-[var(--color-border-subtle)]">₹ {Number(tx.amount).toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] mb-1.5">Traced Location</p>
                            <p className="text-sm font-mono text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] p-2 rounded border border-[var(--color-border-subtle)] truncate">{tx.location || "Unknown"}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] mb-1.5">Temporal Origin</p>
                            <p className="text-sm font-mono text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] p-2 rounded border border-[var(--color-border-subtle)]">{new Date(tx.createdAt || tx.timestamp).toUTCString()}</p>
                        </div>
                    </div>
                </div>

                {/* Right Side: AI Analytics */}
                <div className="w-full md:w-80 flex flex-col bg-[#05080c]">
                    <div className="p-6 border-b border-[var(--color-border)] flex flex-col items-center justify-center bg-gradient-to-b from-[#080d14] to-transparent">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-6">AI Inference Score</p>
                        {/* Perfect Half-Circle Gauge */}
                        <div className="relative w-40 h-20 overflow-hidden mb-2">
                            <svg viewBox="0 0 100 50" className="absolute top-0 left-0 w-full h-full">
                                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeDasharray="30 100" />
                                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" strokeDasharray="30 100" strokeDashoffset="-32" />
                                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeDasharray="50 100" strokeDashoffset="-64" />
                            </svg>
                            <div className="absolute bottom-[-10px] left-[50%] w-0 h-0 transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-top z-10" style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}>
                                <div className="w-1.5 h-16 bg-white rounded-full absolute bottom-2 -left-[3px] shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
                                <div className="w-3 h-3 bg-[var(--color-bg-card)] border-2 border-white rounded-full absolute bottom-[-4px] -left-[6px] z-20"></div>
                            </div>
                        </div>
                        <p className={`text-4xl font-black font-mono tracking-tighter ${riskScore >= 0.65 ? 'text-[var(--color-danger)]' : 'text-white'} drop-shadow-md`}>{riskScore.toFixed(4)}</p>
                    </div>

                    <div className="p-5 border-b border-[var(--color-border)] space-y-3">
                        <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Reason Flag</p>
                            <p className="text-[11px] font-mono leading-relaxed text-[var(--color-text-secondary)] bg-[var(--color-bg-card)] p-2 rounded border border-[var(--color-border-subtle)] h-[60px] overflow-y-auto">{tx.reason || "Algorithm approved automatically."}</p>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Matrix Check</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[var(--color-text-muted)]/10 text-white">GNN Activated</span>
                        </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                        <div className="space-y-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-border-subtle)] pb-2">Pipeline Subroutines</p>

                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-gray-300">WhatsApp Alert</span>
                                {tx.whatsappAlertSent ? <span className="text-[var(--color-success)] font-bold">✓ PUSHED</span> : <span className="text-[var(--color-text-muted)] font-mono">PENDING</span>}
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-gray-300">Voice Network</span>
                                {tx.voiceAlertSent ? <span className="text-[var(--color-success)] font-bold">✓ OUTBOUND</span> : <span className="text-[var(--color-text-muted)] font-mono">PENDING</span>}
                            </div>

                            <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)]">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">RBI Legal Dispute</p>
                                {loading ? (
                                    <div className="h-2 w-full bg-[var(--color-border)] rounded animate-pulse"></div>
                                ) : recoveryInfo ? (
                                    <div className="flex flex-col gap-2 relative">
                                        <div className="h-1 bg-[var(--color-border)] w-full rounded-full absolute top-[5px] -z-10"></div>
                                        <div className="flex justify-between text-[8px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                            <div className="flex flex-col items-center">
                                                <div className={`w-3 h-3 rounded-full mb-1 border-2 ${recoveryInfo.status === 'INITIATED' ? 'bg-[var(--color-accent)] border-[var(--color-accent)]' : 'bg-[var(--color-success)] border-[var(--color-success)]'}`}></div>
                                                <span>INIT</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className={`w-3 h-3 rounded-full mb-1 border-2 ${['BANK_NOTIFIED', 'RBI_ESCALATED', 'RESOLVED'].includes(recoveryInfo.status) ? 'bg-[var(--color-accent)] border-[var(--color-accent)]' : 'bg-[var(--color-bg-card)] border-[var(--color-border)]'}`}></div>
                                                <span>BANK</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className={`w-3 h-3 rounded-full mb-1 border-2 ${['RBI_ESCALATED', 'RESOLVED'].includes(recoveryInfo.status) ? 'bg-[var(--color-accent)] border-[var(--color-accent)]' : 'bg-[var(--color-bg-card)] border-[var(--color-border)]'}`}></div>
                                                <span>RBI</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : tx.status === 'FROZEN' ? (
                                    <button
                                        onClick={handleInitiate}
                                        disabled={initLoading}
                                        className="w-full text-[10px] font-bold uppercase tracking-widest py-2 rounded-md bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-50"
                                    >
                                        {initLoading ? 'Binding...' : 'Initiate Standard Recovery'}
                                    </button>
                                ) : (
                                    <p className="text-[10px] text-[var(--color-text-secondary)] italic">Not eligible for recovery map.</p>
                                )}
                            </div>
                        </div>

                        <button onClick={onClose} className="mt-6 w-full text-center text-[10px] font-bold uppercase tracking-widest text-[#ef4444] hover:text-white hover:bg-[#ef4444] border border-[#ef4444]/30 py-2 rounded shadow-sm transition-all focus:outline-none">Close Inspector</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
