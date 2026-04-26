import React, { useState, useEffect } from 'react';
import { getAllRecoveryCases, advanceRecovery } from '../api/client';

interface RecoveryCase {
    id: string;
    transactionId: string;
    status: string;
    initiatedAt: string;
    expiresAt: string;
    complainantName: string;
    amountDisputed: string;
    pdfPath?: string;
    transaction?: {
        rrn: string;
    };
}

export default function RecoveryPanel() {
    const [cases, setCases] = useState<RecoveryCase[]>([]);
    const [loading, setLoading] = useState(true);

    // Poll cases locally since disputes change sporadically
    const fetchCases = async () => {
        try {
            const data = await getAllRecoveryCases();
            setCases(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCases();
        const intv = setInterval(fetchCases, 10000);
        return () => clearInterval(intv);
    }, []);

    const handleAdvance = async (caseId: string) => {
        try {
            await advanceRecovery(caseId);
            fetchCases();
        } catch (err: any) {
            alert("Failed to advance state: " + (err.response?.data?.error || err.message));
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'INITIATED': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
            case 'BANK_NOTIFIED': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
            case 'RBI_ESCALATED': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
            case 'RESOLVED': return 'bg-green-500/20 text-green-400 border-green-500/50';
            case 'FAILED': return 'bg-red-500/20 text-red-400 border-red-500/50';
            case 'EXPIRED': return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
        }
    };

    return (
        <div className="bg-[#1e293b] border border-gray-800 rounded-2xl p-6 mt-6 shadow-sm overflow-hidden flex flex-col">
            <div className="mb-4 border-b border-gray-800 pb-4">
                <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-3">
                    RBI Dispute Resolution & Recovery Pipeline
                    <span className="flex items-center gap-1.5 text-[10px] bg-[#0f172a] px-2 py-1 rounded-full border border-gray-800 font-medium tracking-widest text-[#3b82f6] uppercase">
                        Active Legal Machine
                    </span>
                </h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-gray-400 uppercase tracking-widest bg-[#0f172a]/50">
                        <tr>
                            <th className="px-4 py-3 font-semibold">Case ID (Truncated)</th>
                            <th className="px-4 py-3 font-semibold">Tx RRN</th>
                            <th className="px-4 py-3 font-semibold">Complainant</th>
                            <th className="px-4 py-3 font-semibold">Amount (INR)</th>
                            <th className="px-4 py-3 font-semibold">Status Stage</th>
                            <th className="px-4 py-3 font-semibold">Action Deadlines</th>
                            <th className="px-4 py-3 font-semibold text-right">Overrides</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {cases.map((c) => (
                            <tr key={c.id} className="hover:bg-white/[0.02] transition">
                                <td className="px-4 py-3 font-mono text-xs text-gray-300">{c.id.split('-')[0]}...</td>
                                <td className="px-4 py-3 font-mono text-gray-300 text-xs">{c.transaction?.rrn || 'N/A'}</td>
                                <td className="px-4 py-3 text-gray-300 font-medium">{c.complainantName}</td>
                                <td className="px-4 py-3 text-white font-mono">₹ {Number(c.amountDisputed).toLocaleString('en-IN')}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded border ${getStatusColor(c.status)}`}>
                                        {c.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-400">
                                    Initiated: {new Date(c.initiatedAt).toLocaleDateString()}<br />
                                    Expiry 90d: {new Date(c.expiresAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-right flex flex-col gap-2 items-end">
                                    {c.pdfPath && (
                                        <span title={`Found at ${c.pdfPath}`} className="text-[#3b82f6] text-[10px] font-medium tracking-wide uppercase cursor-pointer hover:underline">
                                            [PDF Download]
                                        </span>
                                    )}
                                    <button
                                        onClick={() => handleAdvance(c.id)}
                                        disabled={c.status === 'RESOLVED' || c.status === 'FAILED' || c.status === 'EXPIRED'}
                                        className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-xs px-3 py-1 rounded transition uppercase tracking-wider font-semibold border border-gray-700 w-fit"
                                    >
                                        Advance State →
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {cases.length === 0 && !loading && (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-gray-500 italic">No formal recovery cases initiated against fraudulent vectors yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
