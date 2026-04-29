import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllTransactions, processTransaction, initiateRecovery } from '../api/client';
import RecoveryPanel from '../components/RecoveryPanel';

interface Transaction {
    id: string;
    rrn: string;
    senderVpa: string;
    receiverVpa: string;
    amount: string;
    status: 'SUCCESS' | 'FROZEN' | 'PENDING' | 'FAILED';
    action?: string;
    reason?: string;
    riskScore?: string;
    timestamp?: string;
    createdAt?: string;
    whatsappAlertSent?: boolean;
    voiceAlertSent?: boolean;
    alertSentAt?: string;
}

const AnimatedCounter = ({ end, duration = 1000 }: { end: number, duration?: number }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let start = 0;
        const frames = 60;
        const totalFrames = (duration / 1000) * frames;
        const increment = end / totalFrames;
        const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
                setCount(end);
                clearInterval(timer);
            } else {
                setCount(Math.floor(start));
            }
        }, 1000 / frames);
        return () => clearInterval(timer);
    }, [end, duration]);
    return <span>{count.toLocaleString()}</span>;
};

const Sparkline = ({ type }: { type: 'success' | 'danger' | 'neutral' }) => {
    const colors = {
        success: 'stroke-[var(--color-success)]',
        danger: 'stroke-[var(--color-danger)]',
        neutral: 'stroke-[var(--color-accent)]'
    };
    const fillColors = {
        success: 'fill-[var(--color-success)]/10',
        danger: 'fill-[var(--color-danger)]/10',
        neutral: 'fill-[var(--color-accent)]/10'
    };

    return (
        <svg className={`w-16 h-8 ${colors[type]}`} viewBox="0 0 100 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 25C10 25 15 10 25 10C35 10 40 20 50 15C60 10 70 25 80 15C90 5 95 5 100 5V30H0V25Z" className={`stroke-none ${fillColors[type]}`} />
            <path d="M0 25C10 25 15 10 25 10C35 10 40 20 50 15C60 10 70 25 80 15C90 5 95 5 100 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

export default function DashboardPage() {
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const [simSender, setSimSender] = useState('');
    const [simReceiver, setSimReceiver] = useState('');
    const [simAmount, setSimAmount] = useState('');
    const [simLocation, setSimLocation] = useState('');
    const [simLoading, setSimLoading] = useState(false);
    const [simResult, setSimResult] = useState<{ status: string, reason?: string, riskScore?: string } | null>(null);

    const [showBanner, setShowBanner] = useState(false);
    const [toast, setToast] = useState<{ message: string, type: 'error' | 'success' } | null>(null);
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const [nowTime, setNowTime] = useState(new Date());

    const [recovTx, setRecovTx] = useState<Transaction | null>(null);
    const [recovName, setRecovName] = useState('');
    const [recovEmail, setRecovEmail] = useState('');
    const [_recovNotes, setRecovNotes] = useState('');
    const [recovLoading, setRecovLoading] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setNowTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const showToast = (message: string, type: 'error' | 'success' = 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchTransactions = async () => {
        try {
            const newTransactions = await getAllTransactions();
            setTransactions((prev) => {
                if (newTransactions.length > 0) {
                    const latestNew = newTransactions[0];
                    const latestOld = prev[0];
                    if (latestNew.status === 'FROZEN' && (!latestOld || latestNew.id !== latestOld.id)) {
                        setShowBanner(true);
                        setTimeout(() => setShowBanner(false), 6000);
                    }
                }
                return newTransactions;
            });
            setLoading(false);
        } catch (err) {
            console.error("Pipeline failure:", err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
        const interval = setInterval(fetchTransactions, 5000);
        return () => clearInterval(interval);
    }, []);

    const applyPreset = (type: 'safe' | 'suspicious' | 'high') => {
        if (type === 'safe') {
            setSimSender('sanjaykumarr@okicici'); setSimReceiver('merchat@upi'); setSimAmount('499'); setSimLocation('Mumbai');
        } else if (type === 'suspicious') {
            setSimSender('sanjaykumarr@okicici'); setSimReceiver('merchat@upi'); setSimAmount('45000'); setSimLocation('Rajasthan');
        } else {
            setSimSender('sanjaykumarr@okicici'); setSimReceiver('merchat@upi'); setSimAmount('250000'); setSimLocation('Unknown');
        }
    };

    const handleSimulate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSimLoading(true);
        setSimResult(null);
        try {
            const res = await processTransaction(simSender, simReceiver, Number(simAmount), simLocation);
            setSimResult({ status: res.status, reason: res.reason, riskScore: res.riskScore });
            if (res.status === 'FROZEN') {
                setShowBanner(true);
                setTimeout(() => setShowBanner(false), 6000);
            }
            fetchTransactions();
        } catch (err: any) {
            showToast("Simulation failed: " + (err.response?.data?.error || err.message));
        } finally {
            setSimLoading(false);
        }
    };

    const handleInitiateRecovery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recovTx) return;
        setRecovLoading(true);
        try {
            await initiateRecovery(recovTx.id, recovName, recovEmail, recovTx.senderVpa, Number(recovTx.amount));
            setRecovTx(null);
            fetchTransactions();
            showToast("Recovery initiated successfully.", 'success');
        } catch (err: any) {
            showToast("Failed to initiate: " + (err.response?.data?.error || err.message));
        } finally {
            setRecovLoading(false);
        }
    };

    const handleLogout = () => {
        if (!logoutConfirm) {
            setLogoutConfirm(true);
            setTimeout(() => setLogoutConfirm(false), 2000);
            return;
        }
        localStorage.removeItem('fraudshield_token');
        navigate('/login');
    };

    const totalTx = transactions.length;
    const frozenCount = transactions.filter(t => t.status === 'FROZEN').length;
    const successCount = transactions.filter(t => t.status === 'SUCCESS').length;
    const fraudRate = totalTx === 0 ? 0 : ((frozenCount / totalTx) * 100).toFixed(1);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'SUCCESS': return { bg: 'bg-[var(--color-success)]/10', text: 'text-[var(--color-success)]', dot: 'bg-[var(--color-success)]' };
            case 'FROZEN': return { bg: 'bg-[var(--color-danger)]/10', text: 'text-[var(--color-danger)]', dot: 'bg-[var(--color-danger)]' };
            case 'PENDING': return { bg: 'bg-[var(--color-warning)]/10', text: 'text-[var(--color-warning)]', dot: 'bg-[var(--color-warning)]' };
            default: return { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-400' };
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-sans relative overflow-x-hidden">
            {/* Top Loading Indicator Pulse */}
            <div className="fixed top-0 left-0 w-full h-[2px] bg-[var(--color-bg-elevated)] z-50">
                <div className="h-full bg-[var(--color-accent)] animate-[pulse_2s_ease-in-out_infinite]" style={{ width: '100%', filter: 'drop-shadow(0 0 4px var(--color-accent))' }}></div>
            </div>

            {/* Banner Overlay */}
            {showBanner && (
                <div className="fixed top-0 w-full z-40 animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="bg-[var(--color-danger)] text-white w-full py-2.5 px-4 font-semibold shadow-2xl flex items-center justify-center gap-3 overflow-hidden relative">
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 20px)' }}></div>
                        <span className="animate-pulse relative z-10">🚨</span>
                        <span className="relative z-10 tracking-wide text-sm uppercase">URGENT CAPTURE: High-risk fraudulent transaction intercepted & frozen by AI Engine.</span>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-20 right-6 z-50 animate-in slide-in-from-right fade-in duration-300 px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 min-w-[300px] ${toast.type === 'error' ? 'bg-[var(--color-danger)]/10 border-[var(--color-danger)]/50 text-[var(--color-danger)]' : 'bg-[var(--color-success)]/10 border-[var(--color-success)]/50 text-[var(--color-success)]'}`}>
                    {toast.type === 'error' ? (
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    ) : (
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    )}
                    <span className="text-sm font-medium">{toast.message}</span>
                </div>
            )}

            {/* Recovery Modal */}
            {recovTx && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg-elevated)]">
                            <h3 className="font-semibold text-white">Initiate RBI Dispute Recovery</h3>
                            <button onClick={() => setRecovTx(null)} className="text-[var(--color-text-muted)] hover:text-white transition">✕</button>
                        </div>
                        <form onSubmit={handleInitiateRecovery} className="p-6 space-y-4">
                            <p className="text-xs text-[var(--color-text-secondary)] mb-2">Transaction RRN: <span className="font-mono text-white tracking-wider">{recovTx.rrn}</span></p>
                            <div>
                                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">Complainant Name</label>
                                <input type="text" required value={recovName} onChange={e => setRecovName(e.target.value)} className="w-full bg-[var(--color-bg-primary)] text-white border border-[var(--color-border)] rounded-xl p-2.5 text-sm focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all" placeholder="John Doe" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">Complainant Email</label>
                                <input type="email" required value={recovEmail} onChange={e => setRecovEmail(e.target.value)} className="w-full bg-[var(--color-bg-primary)] text-white border border-[var(--color-border)] rounded-xl p-2.5 text-sm focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all" placeholder="john@example.com" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">Affected VPA</label>
                                    <input type="text" disabled value={recovTx.senderVpa} className="w-full bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs truncate" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">Disputed Value</label>
                                    <input type="text" disabled value={`₹${recovTx.amount}`} className="w-full bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs font-mono truncate" />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3 border-t border-[var(--color-border)] mt-4">
                                <button type="button" onClick={() => setRecovTx(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition">Cancel</button>
                                <button type="submit" disabled={recovLoading} className="px-4 py-2 rounded-xl bg-[var(--color-accent)] hover:bg-[#2563eb] disabled:opacity-50 text-white text-sm font-semibold transition-all shadow-lg active:scale-[0.97]">{recovLoading ? 'Submitting...' : 'Initiate Recovery Case'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="bg-[var(--color-bg-card)] border-b border-[var(--color-border)] px-4 md:px-6 py-3.5 flex justify-between items-center sticky top-[2px] z-30 shadow-sm backdrop-blur-md bg-opacity-95">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <svg className="w-7 h-7 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">FraudShield</h1>
                    </div>
                    <div className="h-4 w-px bg-[var(--color-border)] hidden md:block"></div>
                    <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] shadow-[0_0_8px_var(--color-success)]"></span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-success)]">All Systems Operational</span>
                    </div>
                </div>

                <div className="hidden lg:flex flex-col items-center justify-center">
                    <span className="text-sm font-mono text-[var(--color-text-secondary)] tracking-wider">{nowTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}</span>
                    <span className="text-xs font-mono text-[var(--color-text-muted)]">{nowTime.toLocaleTimeString('en-US', { hour12: false })}</span>
                </div>

                <div className="flex items-center gap-5">
                    <div className="hidden sm:flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center border border-[var(--color-border)]">
                            <svg className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        </div>
                        <span className="text-xs font-medium text-[var(--color-text-secondary)] max-w-[120px] truncate">agent@fraudshield.internal</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded transition shadow-sm ${logoutConfirm ? 'bg-[var(--color-danger)] text-white' : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-subtle)]'}`}
                    >
                        {logoutConfirm ? 'Confirm' : 'Logout'}
                    </button>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6">
                {/* Advanced Stats Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 rounded-2xl shadow-lg hover:border-[var(--color-border-subtle)] transition-all duration-300 relative group overflow-hidden">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-text-muted)] mb-1">Total Volume</p>
                                <p className="text-3xl font-bold text-white font-mono"><AnimatedCounter end={totalTx} duration={1000} /></p>
                            </div>
                            <Sparkline type="neutral" />
                        </div>
                        <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[var(--color-success)]">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                            <span>12.5%</span>
                        </div>
                    </div>

                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 rounded-2xl shadow-lg hover:border-[var(--color-border-subtle)] transition-all duration-300 relative group">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-text-muted)] mb-1">Verified Base</p>
                                <p className="text-3xl font-bold text-white font-mono"><AnimatedCounter end={successCount} duration={1200} /></p>
                            </div>
                            <Sparkline type="success" />
                        </div>
                        <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
                            <span>Stable Trend</span>
                        </div>
                    </div>

                    <div className={`bg-[var(--color-bg-card)] border p-5 rounded-2xl shadow-lg transition-all duration-300 relative group overflow-hidden ${frozenCount > 0 ? 'border-[var(--color-danger)]/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-subtle)]'}`}>
                        {frozenCount > 0 && <div className="absolute inset-0 bg-[var(--color-danger)]/5 animate-pulse rounded-2xl pointer-events-none"></div>}
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-text-muted)] mb-1">Frozen (Intercepted)</p>
                                <p className={`text-3xl font-bold font-mono ${frozenCount > 0 ? 'text-[var(--color-danger)]' : 'text-white'}`}><AnimatedCounter end={frozenCount} duration={1500} /></p>
                            </div>
                            <Sparkline type="danger" />
                        </div>
                        <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[var(--color-danger)] relative z-10">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                            <span>Action Req</span>
                        </div>
                    </div>

                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 rounded-2xl shadow-lg hover:border-[var(--color-border-subtle)] transition-all duration-300 relative group">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-text-muted)] mb-1">Network Fraud Rate</p>
                                <p className="text-3xl font-bold text-[var(--color-accent)] font-mono">{fraudRate}%</p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
                            Real-time threshold active
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Simulator Form Redesigned */}
                    <div className="xl:col-span-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg hover:border-[var(--color-border-subtle)] transition-all duration-300 flex flex-col">
                        <div className="px-5 py-4 border-b border-[var(--color-border)] bg-[#111927]">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-[#e2e8f0] flex items-center gap-2">
                                <svg className="w-4 h-4 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Injection Console <span className="animate-pulse w-1.5 h-4 bg-[#3b82f6] ml-1 inline-block"></span>
                            </h2>
                        </div>

                        <div className="p-5 flex-1 flex flex-col space-y-5 bg-[#080d14]">
                            <div className="flex gap-2">
                                <button type="button" onClick={() => applyPreset('safe')} className="flex-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-white hover:border-[var(--color-accent)] rounded shadow transition-all active:scale-[0.98]">Safe Payload</button>
                                <button type="button" onClick={() => applyPreset('suspicious')} className="flex-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-warning)] hover:border-[var(--color-warning)] rounded shadow transition-all active:scale-[0.98]">Suspicious</button>
                                <button type="button" onClick={() => applyPreset('high')} className="flex-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-danger)] hover:border-[var(--color-danger)] rounded shadow transition-all active:scale-[0.98]">High Risk</button>
                            </div>

                            <form onSubmit={handleSimulate} className="space-y-4 flex-1 flex flex-col">
                                <div className="space-y-3">
                                    <div>
                                        <input type="text" required value={simSender} onChange={e => setSimSender(e.target.value)} className="w-full bg-[var(--color-bg-card)] text-[#10b981] border border-[var(--color-border)] rounded p-3 text-sm focus:outline-none focus:border-[var(--color-accent)] font-mono tracking-wider transition placeholder-[#10b981]/40" placeholder="> SENDER_VPA" />
                                    </div>
                                    <div>
                                        <input type="text" required value={simReceiver} onChange={e => setSimReceiver(e.target.value)} className="w-full bg-[var(--color-bg-card)] text-[#10b981] border border-[var(--color-border)] rounded p-3 text-sm focus:outline-none focus:border-[var(--color-accent)] font-mono tracking-wider transition placeholder-[#10b981]/40" placeholder="> RECEIVER_VPA" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="number" required value={simAmount} onChange={e => setSimAmount(e.target.value)} className="w-full bg-[var(--color-bg-card)] text-[#10b981] border border-[var(--color-border)] rounded p-3 text-sm focus:outline-none focus:border-[var(--color-accent)] font-mono tracking-wider transition placeholder-[#10b981]/40" placeholder="> AMOUNT_INR" />
                                        <input type="text" required value={simLocation} onChange={e => setSimLocation(e.target.value)} className="w-full bg-[var(--color-bg-card)] text-[#10b981] border border-[var(--color-border)] rounded p-3 text-sm focus:outline-none focus:border-[var(--color-accent)] font-mono tracking-wider transition placeholder-[#10b981]/40" placeholder="> LOCATION_SIG" />
                                    </div>
                                </div>
                                <div className="mt-auto pt-6">
                                    <button disabled={simLoading} className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] hover:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold tracking-widest uppercase text-xs py-3.5 rounded shadow-lg transition-all active:scale-[0.98]">
                                        {simLoading ? <span className="animate-pulse">Analyzing...</span> : 'Execute Pipeline'}
                                    </button>
                                </div>
                            </form>

                            {simResult && (
                                <div className={`mt-0 w-full p-4 rounded border animate-in fade-in zoom-in-95 duration-200 shadow-xl ${simResult.status === 'FROZEN' ? 'bg-[var(--color-danger)]/10 border-[var(--color-danger)]/40' : 'bg-[var(--color-success)]/10 border-[var(--color-success)]/40'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${simResult.status === 'FROZEN' ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>Verdict: {simResult.status}</span>
                                        {simResult.riskScore && <span className="text-[10px] font-mono text-[var(--color-text-muted)]">SCORE: {Number(simResult.riskScore).toFixed(4)}</span>}
                                    </div>
                                    {simResult.reason && <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed font-mono mt-1">&gt; {simResult.reason}</p>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Live Feed Table Redesigned */}
                    <div className="xl:col-span-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl max-h-[700px] overflow-hidden flex flex-col shadow-lg hover:border-[var(--color-border-subtle)] transition-all duration-300 relative">
                        <div className="px-5 py-4 border-b border-[var(--color-border)] flex justify-between items-center z-10 bg-[var(--color-bg-elevated)]/50 backdrop-blur-sm">
                            <h2 className="text-sm font-bold tracking-widest text-[#e2e8f0] uppercase flex items-center gap-3">
                                Live Pipeline Engine
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--color-success)]/30 bg-[var(--color-success)]/10">
                                    <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-success)] opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-success)]"></span>
                                    </div>
                                    <span className="text-[9px] font-black tracking-widest text-[var(--color-success)] uppercase">Online</span>
                                </div>
                            </h2>
                        </div>

                        <div className="overflow-x-auto overflow-y-auto flex-1 relative custom-scrollbar">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest sticky top-0 bg-[var(--color-bg-card)] z-20 border-b border-[var(--color-border)] shadow-sm">
                                    <tr>
                                        <th className="px-5 py-3 font-bold">Vector Policy</th>
                                        <th className="px-5 py-3 font-bold">Amt (INR)</th>
                                        <th className="px-5 py-3 font-bold hidden md:table-cell">Topology Flow</th>
                                        <th className="px-5 py-3 font-bold">GNN Matrix</th>
                                        <th className="px-5 py-3 font-bold text-right hidden sm:table-cell">Timestamp</th>
                                        <th className="px-5 py-3 font-bold text-right">Overrides</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                                    {transactions.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center justify-center text-[var(--color-text-muted)] space-y-3">
                                                    <svg className="w-12 h-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                                    <p className="text-xs uppercase tracking-widest font-bold">Pipeline listening for initial payload...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {loading && transactions.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-10">
                                                <div className="space-y-4">
                                                    {[...Array(5)].map((_, i) => (
                                                        <div key={i} className="h-10 bg-[var(--color-border)]/30 rounded animate-pulse w-full"></div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {transactions.slice(0, 50).map((tx) => {
                                        const styles = getStatusStyle(tx.status);
                                        const rawScore = Number(tx.riskScore) || 0;
                                        const barColor = rawScore >= 0.65 ? 'bg-[var(--color-danger)]' : rawScore > 0.3 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]';

                                        return (
                                            <tr key={tx.id} className={`hover:bg-white/[0.02] transition-colors duration-200 group animate-in slide-in-from-top-2 fade-in relative ${tx.status === 'FROZEN' ? 'border-l-2 border-l-[var(--color-danger)]' : ''}`}>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-full shadow-sm border border-transparent ${styles.bg} ${styles.text}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}></span>
                                                            {tx.status}
                                                        </span>
                                                        {tx.status === 'FROZEN' && (
                                                            <span className="inline-flex items-center gap-1 ml-1">
                                                                <span title={`WhatsApp Alert: ${tx.whatsappAlertSent ? 'Dispatched' : 'Pending'}`} className={`text-[11px] cursor-help transition-opacity ${tx.whatsappAlertSent ? 'opacity-100 grayscale-0' : 'opacity-20 grayscale'}`}>💬</span>
                                                                <span title={`Voice Alert: ${tx.voiceAlertSent ? 'Dispatched' : 'Pending'}`} className={`text-[11px] cursor-help transition-opacity ${tx.voiceAlertSent ? 'opacity-100 grayscale-0' : 'opacity-20 grayscale'}`}>📞</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 font-mono font-medium text-white whitespace-nowrap">₹ {Number(tx.amount).toLocaleString('en-IN')}</td>
                                                <td className="px-5 py-4 hidden md:table-cell max-w-[200px]">
                                                    <div className="flex items-center gap-2 text-xs font-mono font-medium">
                                                        <span className="text-gray-300 truncate font-semibold" title={tx.senderVpa}>{tx.senderVpa.split('@')[0]}</span>
                                                        <span className="text-[var(--color-text-muted)] text-[10px]">→</span>
                                                        <span className="text-gray-400 truncate" title={tx.receiverVpa}>{tx.receiverVpa.split('@')[0]}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 min-w-[120px]">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className={`font-mono text-xs font-bold ${rawScore >= 0.65 ? 'text-[var(--color-danger)]' : 'text-gray-300'}`}>{rawScore.toFixed(4)}</span>
                                                        <div className="w-16 h-[2px] bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
                                                            <div className={`h-full ${barColor} shadow-[0_0_5px_currentColor] opacity-80`} style={{ width: `${Math.min(100, rawScore * 100)}%` }}></div>
                                                        </div>
                                                        {tx.reason && <span className="text-[9px] font-mono text-[var(--color-text-muted)] truncate max-w-[150px] mt-0.5 pointer-events-none">{tx.reason.split('.')[0]}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-right text-[var(--color-text-secondary)] text-xs hidden sm:table-cell whitespace-nowrap font-mono">
                                                    {tx.createdAt || tx.timestamp
                                                        ? new Date((tx.createdAt || tx.timestamp) as string).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                                        : 'N/A'
                                                    }
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    {tx.status === 'FROZEN' ? (
                                                        <button
                                                            onClick={() => {
                                                                setRecovTx(tx);
                                                                setRecovName('');
                                                                setRecovEmail('');
                                                                setRecovNotes('');
                                                            }}
                                                            className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-accent)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20 px-3 py-1.5 rounded transition whitespace-nowrap active:scale-[0.97]"
                                                        >
                                                            Force Recovery
                                                        </button>
                                                    ) : (
                                                        <span className="text-[var(--color-text-muted)] text-[10px] uppercase font-bold tracking-widest">Locked</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {/* Scroll fade gradient for mobile horizontal wrap mapping */}
                            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--color-bg-card)] pointer-events-none md:hidden"></div>
                        </div>
                    </div>
                </div>
                <div className="mt-8">
                    <RecoveryPanel />
                </div>
            </main>
        </div>
    );
}
