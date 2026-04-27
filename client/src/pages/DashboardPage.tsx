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

export default function DashboardPage() {
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const [simSender, setSimSender] = useState('');
    const [simReceiver, setSimReceiver] = useState('');
    const [simAmount, setSimAmount] = useState('');
    const [simLocation, setSimLocation] = useState('');
    const [simLoading, setSimLoading] = useState(false);
    const [simResult, setSimResult] = useState<{ status: string, reason?: string } | null>(null);

    const [showBanner, setShowBanner] = useState(false);

    // Recovery Modal State
    const [recovTx, setRecovTx] = useState<Transaction | null>(null);
    const [recovName, setRecovName] = useState('');
    const [recovEmail, setRecovEmail] = useState('');
    const [recovNotes, setRecovNotes] = useState('');
    const [recovLoading, setRecovLoading] = useState(false);

    // Stats calculation
    const totalTx = transactions.length;
    const frozenCount = transactions.filter(t => t.status === 'FROZEN').length;
    const successCount = transactions.filter(t => t.status === 'SUCCESS').length;
    const fraudRate = totalTx === 0 ? 0 : ((frozenCount / totalTx) * 100).toFixed(1);

    const fetchTransactions = async () => {
        try {
            const newTransactions = await getAllTransactions();

            setTransactions((prev) => {
                // Evaluate banner triggering if the specific latest transaction arrived frozen
                if (newTransactions.length > 0) {
                    const latestNew = newTransactions[0];
                    const latestOld = prev[0];
                    // Determine if we should show a popup
                    if (latestNew.status === 'FROZEN' && (!latestOld || latestNew.id !== latestOld.id)) {
                        setShowBanner(true);
                        setTimeout(() => setShowBanner(false), 5000);
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
        const interval = setInterval(fetchTransactions, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleSimulate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSimLoading(true);
        setSimResult(null);
        try {
            const res = await processTransaction(simSender, simReceiver, Number(simAmount), simLocation);
            setSimResult({ status: res.status, reason: res.reason });
            if (res.status === 'FROZEN') {
                setShowBanner(true);
                setTimeout(() => setShowBanner(false), 5000);
            }
            fetchTransactions();
        } catch (err: any) {
            alert("Simulation failed: " + (err.response?.data?.error || err.message));
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
        } catch (err: any) {
            alert("Failed to initiate recovery: " + (err.response?.data?.error || err.message));
        } finally {
            setRecovLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('fraudshield_token');
        navigate('/login');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'SUCCESS': return 'bg-green-500/20 text-green-400 border-green-500/50';
            case 'FROZEN': return 'bg-red-500/20 text-red-400 border-red-500/50';
            case 'PENDING': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
            case 'FAILED': return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white selection:bg-[#3b82f6]/30 font-sans">
            {/* Banner */}
            {showBanner && (
                <div className="bg-red-600/90 backdrop-blur-md text-white text-center py-3 font-semibold shadow-2xl animate-in slide-in-from-top fixed top-0 w-full z-50 transition-all border-b border-red-500">
                    <span className="animate-pulse mr-2">🚨</span> URGENT CAPTURE: High-risk fraudulent transaction intercepted & frozen by AI Engine.
                </div>
            )}

            {/* Recovery Modal */}
            {recovTx && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-[#1e293b] border border-gray-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-[#0f172a]/50">
                            <h3 className="font-semibold text-white">Initiate RBI Dispute Recovery</h3>
                            <button onClick={() => setRecovTx(null)} className="text-gray-400 hover:text-white transition">✕</button>
                        </div>
                        <form onSubmit={handleInitiateRecovery} className="p-6 space-y-4">
                            <p className="text-xs text-gray-400 mb-2">Transaction RRN: <span className="font-mono text-gray-200">{recovTx.rrn}</span></p>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-400 mb-1 tracking-wider uppercase">Complainant Name</label>
                                <input type="text" required value={recovName} onChange={e => setRecovName(e.target.value)} className="w-full bg-[#0f172a] text-white border border-gray-700/50 rounded-lg p-2.5 text-sm focus:border-[#3b82f6] focus:outline-none" placeholder="John Doe" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-400 mb-1 tracking-wider uppercase">Complainant Email</label>
                                <input type="email" required value={recovEmail} onChange={e => setRecovEmail(e.target.value)} className="w-full bg-[#0f172a] text-white border border-gray-700/50 rounded-lg p-2.5 text-sm focus:border-[#3b82f6] focus:outline-none" placeholder="john@example.com" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 mb-1 tracking-wider uppercase">Affected VPA</label>
                                    <input type="text" disabled value={recovTx.senderVpa} className="w-full bg-[#0f172a]/50 text-gray-500 border border-gray-800 rounded-lg p-2.5 text-sm truncate" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 mb-1 tracking-wider uppercase">Disputed Value</label>
                                    <input type="text" disabled value={`₹${recovTx.amount}`} className="w-full bg-[#0f172a]/50 text-gray-500 border border-gray-800 rounded-lg p-2.5 text-sm font-mono truncate" />
                                </div>
                            </div>
                            <div className="pt-3 flex justify-end gap-3 border-t border-gray-800 mt-2">
                                <button type="button" onClick={() => setRecovTx(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition">Cancel</button>
                                <button type="submit" disabled={recovLoading} className="px-4 py-2 rounded-lg bg-[#3b82f6] hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium transition shadow-lg shadow-blue-500/20">{recovLoading ? 'Submitting...' : 'Initiate Recovery Case'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="bg-[#1e293b] border-b border-gray-800 px-6 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gradient-to-tr from-[#3b82f6] to-[#60a5fa] flex items-center justify-center font-black shadow-lg shadow-blue-500/20">F</div>
                    <h1 className="text-xl font-bold tracking-tight text-gray-100">FraudShield</h1>
                </div>
                <button onClick={handleLogout} className="text-gray-400 hover:text-white transition-colors text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800">
                    Logout Session
                </button>
            </header>

            <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
                {/* Stats Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#1e293b] border border-gray-800/60 p-5 rounded-2xl shadow-sm">
                        <p className="text-gray-400 text-xs tracking-wider uppercase font-semibold mb-1">Total Network Volume</p>
                        <p className="text-3xl font-bold text-gray-100">{totalTx.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#1e293b] border border-gray-800/60 p-5 rounded-2xl shadow-sm">
                        <p className="text-green-400 text-xs tracking-wider uppercase font-semibold mb-1">Verified (Allowed)</p>
                        <p className="text-3xl font-bold text-gray-100">{successCount.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#1e293b] border border-red-500/20 p-5 rounded-2xl shadow-sm relative overflow-hidden bg-gradient-to-r from-[#1e293b] to-[#1e293b]/80">
                        <div className="absolute right-0 top-0 w-1 h-full bg-red-500"></div>
                        <p className="text-red-400 text-xs tracking-wider uppercase font-semibold mb-1">Frozen (Intercepted)</p>
                        <p className="text-3xl font-bold text-gray-100">{frozenCount.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#1e293b] border border-gray-800/60 p-5 rounded-2xl shadow-sm">
                        <p className="text-gray-400 text-xs tracking-wider uppercase font-semibold mb-1">Network Fraud Rate</p>
                        <p className="text-3xl font-bold text-[#3b82f6]">{fraudRate}%</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Simulator Form */}
                    <div className="lg:col-span-1 bg-[#1e293b] border border-gray-800 rounded-2xl p-6 h-fit sticky top-24 shadow-sm">
                        <h2 className="text-lg font-semibold mb-5 border-b border-gray-800 pb-3 text-gray-100">Live Simulation Interface</h2>
                        <form onSubmit={handleSimulate} className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 tracking-wider uppercase">Sender VPA Address</label>
                                <input type="text" required value={simSender} onChange={e => setSimSender(e.target.value)} className="w-full bg-[#0f172a] text-white border border-gray-700/50 rounded-lg p-2.5 text-sm focus:border-[#3b82f6] focus:outline-none transition shadow-inner" placeholder="suspect@upi" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 tracking-wider uppercase">Receiver VPA Address</label>
                                <input type="text" required value={simReceiver} onChange={e => setSimReceiver(e.target.value)} className="w-full bg-[#0f172a] text-white border border-gray-700/50 rounded-lg p-2.5 text-sm focus:border-[#3b82f6] focus:outline-none transition shadow-inner" placeholder="victim@bank" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 tracking-wider uppercase">Transfer Amount</label>
                                    <input type="number" required value={simAmount} onChange={e => setSimAmount(e.target.value)} className="w-full bg-[#0f172a] text-white border border-gray-700/50 rounded-lg p-2.5 text-sm focus:border-[#3b82f6] focus:outline-none transition shadow-inner" placeholder="50000" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 tracking-wider uppercase">Location Signature</label>
                                    <input type="text" required value={simLocation} onChange={e => setSimLocation(e.target.value)} className="w-full bg-[#0f172a] text-white border border-gray-700/50 rounded-lg p-2.5 text-sm focus:border-[#3b82f6] focus:outline-none transition shadow-inner" placeholder="Unknown" />
                                </div>
                            </div>
                            <button disabled={simLoading} className="w-full bg-[#3b82f6] hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition mt-6 shadow-lg shadow-blue-500/20 active:scale-[0.98]">
                                {simLoading ? 'Routing via AI Engine...' : 'Execute Transaction Pipeline'}
                            </button>
                        </form>

                        {simResult && (
                            <div className={`mt-6 p-4 rounded-xl border animate-in fade-in zoom-in-95 duration-200 ${simResult.status === 'FROZEN' ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                                <p className={`font-bold tracking-tight mb-1 ${simResult.status === 'FROZEN' ? 'text-red-400' : 'text-green-400'}`}>STATUS: {simResult.status}</p>
                                {simResult.reason && <p className="text-xs text-gray-400 leading-relaxed"><span className="text-gray-300 font-medium">Engine Trace:</span> {simResult.reason}</p>}
                            </div>
                        )}
                    </div>

                    {/* Live Feed Table */}
                    <div className="lg:col-span-2 bg-[#1e293b] border border-gray-800 rounded-2xl max-h-[800px] overflow-hidden flex flex-col shadow-sm">
                        <div className="px-6 py-5 border-b border-gray-800 flex justify-between items-center bg-[#1e293b] z-10">
                            <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-3">
                                Live Node Pipeline
                                <span className="flex items-center gap-1.5 text-[10px] bg-[#0f172a] px-2 py-1 rounded-full border border-gray-800 font-medium tracking-widest text-green-400 uppercase">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                                    </span>
                                    Online
                                </span>
                            </h2>
                        </div>
                        <div className="overflow-x-auto overflow-y-auto flex-1">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] text-gray-400 uppercase tracking-widest sticky top-0 bg-[#0f172a]/50 backdrop-blur-md z-10 border-b border-gray-800">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold">Security Action</th>
                                        <th className="px-6 py-3 font-semibold">Volume (INR)</th>
                                        <th className="px-6 py-3 font-semibold">Topology Vector</th>
                                        <th className="px-6 py-3 font-semibold">GNN Output Score</th>
                                        <th className="px-6 py-3 font-semibold text-right">Network Time</th>
                                        <th className="px-6 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/50">
                                    {transactions.slice(0, 20).map((tx) => (
                                        <tr key={tx.id} className="hover:bg-white/[0.02] transition duration-150">
                                            <td className="px-6 py-4 flex items-center gap-2">
                                                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded shadow-sm border ${getStatusColor(tx.status)}`}>
                                                    {tx.status}
                                                </span>
                                                {tx.status === 'FROZEN' && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <span title={`WhatsApp Alert: ${tx.whatsappAlertSent ? 'Sent ' + (tx.alertSentAt ? new Date(tx.alertSentAt).toLocaleTimeString() : '') : 'Pending'}`} className={`text-base cursor-help transition-opacity ${tx.whatsappAlertSent ? 'opacity-100 grayscale-0' : 'opacity-30 grayscale'}`}>💬</span>
                                                        <span title={`Voice Alert: ${tx.voiceAlertSent ? 'Sent ' + (tx.alertSentAt ? new Date(tx.alertSentAt).toLocaleTimeString() : '') : 'Pending'}`} className={`text-base cursor-help transition-opacity ${tx.voiceAlertSent ? 'opacity-100 grayscale-0' : 'opacity-30 grayscale'}`}>📞</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-mono font-medium text-gray-100 whitespace-nowrap">₹ {Number(tx.amount).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 hidden sm:table-cell max-w-[200px]">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-gray-300 truncate text-xs font-medium">{tx.senderVpa}</span>
                                                    <span className="text-gray-500 text-[10px] truncate">→ {tx.receiverVpa}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`font-mono text-xs font-semibold ${Number(tx.riskScore) >= 0.65 ? 'text-red-400' : 'text-gray-300'}`}>{Number(tx.riskScore).toFixed(4)}</span>
                                                    {tx.reason && <span className="text-[10px] text-gray-500 truncate max-w-[180px] hover:text-gray-300 transition-colors cursor-default" title={tx.reason}>{tx.reason}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-500 text-xs whitespace-nowrap font-mono">
                                                {tx.createdAt || tx.timestamp
                                                    ? new Date(tx.createdAt || tx.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                                    : 'N/A'
                                                }
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {tx.status === 'FROZEN' && (
                                                    <button
                                                        onClick={() => {
                                                            setRecovTx(tx);
                                                            setRecovName('');
                                                            setRecovEmail('');
                                                            setRecovNotes('');
                                                        }}
                                                        className="text-[10px] font-bold uppercase tracking-wider text-[#3b82f6] border border-[#3b82f6]/30 bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 px-3 py-1.5 rounded transition whitespace-nowrap"
                                                    >
                                                        Initiate Recovery
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {transactions.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center">
                                                <p className="text-gray-500 italic">Network waiting on first transaction intercept...</p>
                                            </td>
                                        </tr>
                                    )}
                                    {loading && transactions.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">Synchronizing pipeline data...</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <RecoveryPanel />
            </main>
        </div>
    );
}
