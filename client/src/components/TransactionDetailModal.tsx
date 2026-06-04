import { useEffect, useState } from 'react';
import client, { getRecoveryByTransaction, getReceiverProfile } from '../api/client';
import FeatureAttributionChart from './FeatureAttributionChart';

interface ReceiverProfileData {
    receiverVpa: string;
    riskScore: number;
    riskCategory: string;
    fraudRate: number;
    totalReceived: number;
    uniqueSendersLast24h: number;
    totalAmountLast24h: number;
    avgAmountReceived: number;
    firstSeenAt: string;
    signals?: string[];
}

const RISK_CATEGORY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    SAFE: { color: '#10b981', bg: 'bg-[#10b981]/10', label: 'SAFE' },
    SUSPICIOUS: { color: '#f59e0b', bg: 'bg-[#f59e0b]/10', label: 'SUSPICIOUS' },
    HIGH_RISK: { color: '#f97316', bg: 'bg-[#f97316]/10', label: 'HIGH RISK' },
    FRAUD_MULE: { color: '#ef4444', bg: 'bg-[#ef4444]/10', label: 'FRAUD MULE' },
    UNKNOWN: { color: '#6b7280', bg: 'bg-gray-500/10', label: 'UNKNOWN' },
};

export default function TransactionDetailModal({ tx, onClose }: { tx: any, onClose: () => void }) {
    const [recoveryInfo, setRecoveryInfo] = useState<any>(null);
    const [behavior, setBehavior] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [initLoading, setInitLoading] = useState(false);
    const [receiverProfile, setReceiverProfile] = useState<ReceiverProfileData | null>(null);
    const [showRecoveryForm, setShowRecoveryForm] = useState(false);
    const [recoveryForm, setRecoveryForm] = useState({
        name: '', email: '', phone: '', vpa: '', bankName: '', accountNumber: '', description: ''
    });

    useEffect(() => {
        if (!tx) return;
        const fetchInfo = async () => {
            try {
                const data = await getRecoveryByTransaction(tx.id);
                setRecoveryInfo(data);
            } catch (e) {
                // If 404 or fails, it means no case exists
            }

            try {
                if (tx.sender?.id) {
                    const profileCheckRes = await client.post(`/api/users/${tx.sender.id}/profile-check`, { transaction: tx });
                    setBehavior(profileCheckRes.data);
                }
            } catch (e) {
                console.error("Behavior check failed", e);
            }

            try {
                if (tx.receiverVpa) {
                    const rpData = await getReceiverProfile(tx.receiverVpa);
                    setReceiverProfile(rpData);
                }
            } catch (e) {
                console.error("Receiver profile fetch failed", e);
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
        if (!recoveryForm.name || !recoveryForm.email) {
            alert('Name and email are required.');
            return;
        }
        setInitLoading(true);
        try {
            const response = await fetch('/api/recovery/initiate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('fraudshield_token')}`
                },
                body: JSON.stringify({
                    transactionId: tx.id,
                    complainantName: recoveryForm.name,
                    complainantEmail: recoveryForm.email,
                    complainantPhone: recoveryForm.phone,
                    bankName: recoveryForm.bankName,
                    accountNumber: recoveryForm.accountNumber,
                    description: recoveryForm.description || ''
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.details || error.error || 'Failed to initiate recovery');
            }

            const data = await response.json();
            alert(`Recovery case created: ${data.caseId}`);
            
            // Refetch to show timeline
            const rData = await getRecoveryByTransaction(tx.id);
            setRecoveryInfo(rData);
            setShowRecoveryForm(false);
        } catch (e: any) {
            console.error('Recovery error:', e);
            alert(e.message || 'Failed to initiate recovery.');
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
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col md:flex-row relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                
                {/* Sticky Close Button */}
                <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 bg-black/60 hover:bg-black/90 rounded-full text-white transition-colors border border-[var(--color-border)] backdrop-blur-md">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

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
                        <div className="mt-4 border-t border-[var(--color-border-subtle)] pt-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#f59e0b] mb-3">Feature Attribution Analysis</p>
                            <FeatureAttributionChart
                                attribution={tx.attributionData ? (typeof tx.attributionData === 'string' ? JSON.parse(tx.attributionData) : tx.attributionData) : null}
                                finalScore={riskScore}
                            />
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
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#f59e0b] mb-3">Behavioral Anomaly Logs</p>
                                {behavior ? (
                                    behavior.isAnomalous ? (
                                        <div className="flex flex-col gap-2 mb-4">
                                            {behavior.anomalousFactors.map((factor: string, i: number) => (
                                                <div key={i} className="text-[8px] font-bold leading-normal uppercase tracking-widest px-2 py-1.5 rounded border border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#f59e0b]">⚠ {factor}</div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-[9px] text-[var(--color-success)] tracking-wide font-bold mb-4 font-mono">✓ Profile bounds aligned.</div>
                                    )
                                ) : (
                                    <div className="text-[9px] text-[var(--color-text-muted)] mb-4 uppercase tracking-widest">Calibrating Vector...</div>
                                )}
                            </div>

                            {/* Receiver Intelligence Section */}
                            <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)]">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#3b82f6] mb-3">Receiver Intelligence</p>
                                {receiverProfile ? (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Risk Category</span>
                                            {(() => {
                                                const cfg = RISK_CATEGORY_CONFIG[receiverProfile.riskCategory] || RISK_CATEGORY_CONFIG.UNKNOWN;
                                                return (
                                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${cfg.bg} ${receiverProfile.riskCategory === 'FRAUD_MULE' ? 'badge-mule' : ''}`}
                                                        style={{ color: cfg.color, borderColor: `${cfg.color}40` }}>
                                                        {cfg.label}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Fraud Rate</span>
                                            <span className={`text-[9px] font-mono font-bold ${receiverProfile.fraudRate > 0.5 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`}>
                                                {(receiverProfile.fraudRate * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Senders (24h)</span>
                                            <span className={`text-[9px] font-mono font-bold ${receiverProfile.uniqueSendersLast24h >= 10 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-secondary)]'}`}>
                                                {receiverProfile.uniqueSendersLast24h}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Total Received</span>
                                            <span className="text-[9px] font-mono text-[var(--color-text-secondary)]">{receiverProfile.totalReceived} txns</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">First Seen</span>
                                            <span className="text-[9px] font-mono text-[var(--color-text-muted)]">
                                                {new Date(receiverProfile.firstSeenAt).toLocaleDateString('en-IN')}
                                            </span>
                                        </div>
                                        {receiverProfile.signals && receiverProfile.signals.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                {receiverProfile.signals.map((sig, i) => (
                                                    <div key={i} className="text-[8px] font-bold leading-normal uppercase tracking-widest px-2 py-1.5 rounded border border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]">⚡ {sig}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-widest">Loading receiver data...</div>
                                )}
                            </div>

                            <div className="mt-2 pt-4 border-t border-[var(--color-border-subtle)]">
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
                                    <div className="space-y-2">
                                        {!showRecoveryForm ? (
                                            <button onClick={() => setShowRecoveryForm(true)}
                                                className="w-full text-[10px] font-bold uppercase tracking-widest py-2 rounded-md bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/20 transition-all">
                                                Initiate Recovery →
                                            </button>
                                        ) : (
                                            <div className="space-y-2 p-3 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)]">
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-accent)] mb-2">Recovery Details</p>
                                                {[['Name *', 'name', 'Full Name', 'text'], ['Email *', 'email', 'email@example.com', 'email'], ['Phone', 'phone', '+91 XXXXXXXXXX', 'tel'], ['UPI VPA', 'vpa', 'your@upi', 'text'], ['Bank Name', 'bankName', 'SBI / HDFC...', 'text'], ['Account No.', 'accountNumber', 'XXXX XXXX', 'text']].map(([label, key, ph, type]) => (
                                                    <div key={key}>
                                                        <label className="text-[8px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</label>
                                                        <input type={type} placeholder={ph} value={recoveryForm[key as keyof typeof recoveryForm]}
                                                            onChange={e => setRecoveryForm(f => ({ ...f, [key]: e.target.value }))}
                                                            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded px-2 py-1 text-[10px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] mt-0.5" />
                                                    </div>
                                                ))}
                                                <div className="flex gap-2 mt-3">
                                                    <button onClick={handleInitiate} disabled={initLoading}
                                                        className="flex-1 text-[9px] font-bold uppercase tracking-widest py-1.5 rounded bg-[var(--color-accent)] text-white disabled:opacity-50 hover:bg-blue-500 transition-all">
                                                        {initLoading ? 'Submitting…' : 'Submit'}
                                                    </button>
                                                    <button onClick={() => setShowRecoveryForm(false)}
                                                        className="px-3 text-[9px] font-bold uppercase tracking-widest rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white transition-all">
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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
