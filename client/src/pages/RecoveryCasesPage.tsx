import { useEffect, useState, useCallback } from 'react';
import {
    getAllRecoveryCases, advanceRecovery, downloadRecoveryPdf,
    getRecoveryCase, uploadEvidenceFile, downloadFIR,
    updateFIRStatus, resolveCase
} from '../api/client';

type RecoveryStep = 'list' | 'initiate' | 'evidence' | 'documents' | 'track' | 'resolution';

const CASE_STAGES = ['INITIATED', 'BANK_NOTIFIED', 'RBI_ESCALATED', 'RESOLVED'];
const FIR_STAGES = ['INITIATED', 'REGISTERED', 'INVESTIGATION', 'CLOSED'];

const STATUS_COLORS: Record<string, string> = {
    INITIATED: '#f59e0b', BANK_NOTIFIED: '#3b82f6', RBI_ESCALATED: '#8b5cf6', RESOLVED: '#10b981', EXPIRED: '#6b7280', FAILED: '#ef4444',
};

type FileType = 'SCREENSHOT' | 'BANK_STATEMENT' | 'CHAT_HISTORY';

export default function RecoveryCasesPage() {
    // List view state
    const [cases, setCases] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('All');
    const [advancingId, setAdvancingId] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    // Workflow state
    const [step, setStep] = useState<RecoveryStep>('list');
    const [activeCase, setActiveCase] = useState<any | null>(null);

    // Initiate form
    const [form, setForm] = useState({
        complainantName: '', complainantEmail: '', complainantPhone: '',
        complainantVpa: '', bankName: '', accountNumber: '',
        amountDisputed: '', notes: '',
    });
    const [initiating, setInitiating] = useState(false);

    // Evidence
    const [evidenceUploading, setEvidenceUploading] = useState(false);
    const [evidenceType, setEvidenceType] = useState<FileType>('SCREENSHOT');
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);

    // Documents
    const [firGenerating, setFirGenerating] = useState(false);
    const [firPreviewOpen, setFirPreviewOpen] = useState(false);

    // Track
    const [firNumber, setFirNumber] = useState('');
    const [policeStation, setPoliceStation] = useState('');
    const [firStatusValue, setFirStatusValue] = useState('REGISTERED');
    const [firStatusSaving, setFirStatusSaving] = useState(false);

    // Resolution
    const [resolveAmount, setResolveAmount] = useState('');
    const [resolveDate, setResolveDate] = useState('');
    const [resolving, setResolving] = useState(false);

    const [nowTime, setNowTime] = useState(new Date());
    useEffect(() => { const t = setInterval(() => setNowTime(new Date()), 1000); return () => clearInterval(t); }, []);

    const fetchCases = useCallback(async () => {
        try {
            const data = await getAllRecoveryCases();
            setCases(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    const refreshActiveCase = useCallback(async () => {
        if (!activeCase?.id) return;
        try {
            const updated = await getRecoveryCase(activeCase.id);
            if (updated) setActiveCase(updated);
        } catch (e) { console.error(e); }
    }, [activeCase?.id]);

    useEffect(() => { fetchCases(); }, [fetchCases]);

    const handleAdvance = async (id: string) => {
        setAdvancingId(id);
        try { await advanceRecovery(id); await fetchCases(); }
        catch { alert('Failed to advance state.'); }
        finally { setAdvancingId(null); }
    };

    const handleDownloadPdf = async (id: string) => {
        setDownloadingId(id);
        try { await downloadRecoveryPdf(id); }
        catch { alert('Failed to download PDF.'); }
        finally { setDownloadingId(null); }
    };

    const getDaysRemaining = (expiresAt: string) => {
        return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    };

    // Initiate
    const handleInitiate = async () => {
        if (!form.complainantName || !form.complainantEmail || !form.amountDisputed) {
            alert('Please fill all required fields.'); return;
        }
        setInitiating(true);
        try {
            // Use existing initiateRecovery endpoint
            const { initiateRecovery } = await import('../api/client');
            const result = await initiateRecovery(
                activeCase?.transactionId || '',
                form.complainantName, form.complainantEmail,
                form.complainantVpa, Number(form.amountDisputed)
            );
            const fresh = await getRecoveryCase(result.id);
            setActiveCase(fresh || result);
            setStep('evidence');
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Failed to initiate recovery');
        } finally { setInitiating(false); }
    };

    // Evidence upload
    const handleEvidenceUpload = async () => {
        if (!evidenceFile || !activeCase?.id) return;
        setEvidenceUploading(true);
        try {
            await uploadEvidenceFile(activeCase.id, evidenceFile, evidenceType);
            setEvidenceFile(null);
            await refreshActiveCase();
        } catch (e: any) {
            alert(e?.message || 'Upload failed');
        } finally { setEvidenceUploading(false); }
    };

    // FIR generation
    const handleGenerateFIR = async () => {
        if (!activeCase?.id) return;
        setFirGenerating(true);
        try {
            await downloadFIR(activeCase.id);
            await refreshActiveCase();
        } catch (e: any) {
            alert(e?.message || 'Failed to generate FIR');
        } finally { setFirGenerating(false); }
    };

    // FIR Status Update
    const handleSaveFIRStatus = async () => {
        if (!activeCase?.id) return;
        setFirStatusSaving(true);
        try {
            await updateFIRStatus(activeCase.id, firStatusValue, firNumber, policeStation);
            await refreshActiveCase();
        } catch (e: any) {
            alert(e?.message || 'Failed to update status');
        } finally { setFirStatusSaving(false); }
    };

    // Resolve
    const handleResolve = async () => {
        if (!activeCase?.id || !resolveAmount || !resolveDate) { alert('Fill all resolution fields'); return; }
        setResolving(true);
        try {
            await resolveCase(activeCase.id, Number(resolveAmount), resolveDate);
            await refreshActiveCase();
            await fetchCases();
        } catch (e: any) {
            alert(e?.message || 'Failed to resolve case');
        } finally { setResolving(false); }
    };

    const filteredCases = cases.filter(c => filterStatus === 'All' || c.status === filterStatus);

    // ──────────────────────────────────────────────────────────────────────────
    const STEP_NAV = [
        { id: 'list', label: 'All Cases', icon: '📋' },
        { id: 'initiate', label: 'Initiate', icon: '1' },
        { id: 'evidence', label: 'Evidence', icon: '2' },
        { id: 'documents', label: 'Documents', icon: '3' },
        { id: 'track', label: 'Track', icon: '4' },
        { id: 'resolution', label: 'Resolve', icon: '5' },
    ];

    const InputField = ({ label, value, onChange, type = 'text', required = false, placeholder = '' }: any) => (
        <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
                {label}{required && <span className="text-[var(--color-danger)] ml-0.5">*</span>}
            </label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors placeholder-[var(--color-text-muted)]" />
        </div>
    );

    return (
        <div className="flex flex-col min-h-screen bg-[var(--color-bg-primary)]">
            {/* Header */}
            <header className="bg-[var(--color-bg-card)] border-b border-[var(--color-border)] px-6 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--color-success)] to-teal-400 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">Recovery & FIR System</h1>
                        <p className="text-[10px] text-[var(--color-text-muted)] font-mono">{nowTime.toLocaleTimeString('en-IN', { hour12: false })}</p>
                    </div>
                </div>
                {/* Step Nav */}
                <div className="flex items-center gap-1">
                    {STEP_NAV.map((s) => (
                        <button key={s.id} onClick={() => setStep(s.id as RecoveryStep)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${step === s.id ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'}`}>
                            <span>{s.icon}</span>
                            <span className="hidden md:inline">{s.label}</span>
                        </button>
                    ))}
                </div>
            </header>

            <main className="max-w-5xl mx-auto w-full p-6 flex-1">

                {/* ── STEP: List ──────────────────────────────────────────── */}
                {step === 'list' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-base font-bold uppercase tracking-widest text-[var(--color-text-primary)]">All Recovery Cases</h2>
                            <div className="flex items-center gap-3">
                                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                                    className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded px-3 py-1.5 text-[10px] font-bold uppercase text-[var(--color-text-secondary)] focus:outline-none">
                                    {['All', 'INITIATED', 'BANK_NOTIFIED', 'RBI_ESCALATED', 'RESOLVED', 'EXPIRED'].map(s => <option key={s}>{s}</option>)}
                                </select>
                                <button onClick={() => setStep('initiate')}
                                    className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-[var(--color-accent)] text-white rounded-lg hover:bg-blue-500 transition-all">
                                    + New Case
                                </button>
                            </div>
                        </div>
                        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)]">
                                    <tr>
                                        <th className="px-5 py-3 text-left font-bold">Case ID</th>
                                        <th className="px-5 py-3 text-left font-bold hidden md:table-cell">Complainant</th>
                                        <th className="px-5 py-3 text-left font-bold">State</th>
                                        <th className="px-5 py-3 text-right font-bold hidden lg:table-cell">Days Left</th>
                                        <th className="px-5 py-3 text-right font-bold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                                    {loading && <tr><td colSpan={5} className="py-12 text-center">
                                        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto" />
                                    </td></tr>}
                                    {!loading && filteredCases.length === 0 && (
                                        <tr><td colSpan={5} className="py-16 text-center text-[var(--color-text-muted)] text-xs uppercase tracking-widest">No cases found</td></tr>
                                    )}
                                    {filteredCases.map(c => {
                                        const cIdx = CASE_STAGES.indexOf(c.status);
                                        const days = getDaysRemaining(c.expiresAt);
                                        const statusColor = STATUS_COLORS[c.status] || '#6b7280';
                                        return (
                                            <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-5 py-3">
                                                    <div className="font-mono text-xs text-[var(--color-text-secondary)] truncate w-28" title={c.id}>{c.id.substring(0, 12)}…</div>
                                                    <div className="text-[10px] font-mono text-[var(--color-text-muted)] mt-0.5">RRN: <span className="text-white font-semibold">{c.transactionRrn || c.transaction?.rrn}</span></div>
                                                </td>
                                                <td className="px-5 py-3 hidden md:table-cell">
                                                    <div className="text-xs text-white font-medium">{c.complainantName}</div>
                                                    <div className="text-[10px] font-mono text-[var(--color-text-muted)]">₹{Number(c.amountDisputed).toLocaleString('en-IN')}</div>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: statusColor }}>{c.status.replace('_', ' ')}</span>
                                                    </div>
                                                    {c.firStatus && c.firStatus !== 'INITIATED' && (
                                                        <div className="text-[8px] font-mono text-[var(--color-text-muted)] mt-0.5">FIR: {c.firStatus}</div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-right hidden lg:table-cell">
                                                    <span className={`font-mono text-lg font-black ${days <= 10 ? 'text-[var(--color-danger)]' : days <= 30 ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}`}>
                                                        {days}d
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-right space-y-1">
                                                    <button onClick={() => { setActiveCase(c); setStep('evidence'); }}
                                                        className="block w-full text-center text-[9px] font-bold uppercase tracking-widest text-[var(--color-accent)] bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 py-1.5 px-2 rounded hover:bg-[var(--color-accent)]/20 transition-all">
                                                        Manage
                                                    </button>
                                                    {cIdx >= 0 && cIdx < CASE_STAGES.length - 1 && (
                                                        <button onClick={() => handleAdvance(c.id)} disabled={advancingId === c.id}
                                                            className="block w-full text-center text-[9px] font-bold uppercase tracking-widest text-white bg-[var(--color-accent)]/80 border border-[var(--color-accent)] py-1.5 px-2 rounded disabled:opacity-50 transition-all">
                                                            {advancingId === c.id ? '…' : 'Advance'}
                                                        </button>
                                                    )}
                                                    {c.pdfPath && (
                                                        <button onClick={() => handleDownloadPdf(c.id)} disabled={downloadingId === c.id}
                                                            className="block w-full text-center text-[9px] font-bold uppercase tracking-widest text-[var(--color-success)] bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 py-1.5 px-2 rounded disabled:opacity-50 transition-all">
                                                            {downloadingId === c.id ? 'DL…' : 'PDF'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── STEP: Initiate ─────────────────────────────────────── */}
                {step === 'initiate' && (
                    <div className="max-w-xl mx-auto">
                        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">Step 1 — Initiate Recovery Case</h2>
                                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Provide complainant details to begin the recovery process</p>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="Full Name" required value={form.complainantName} onChange={(v: string) => setForm(f => ({ ...f, complainantName: v }))} placeholder="John Doe" />
                                    <InputField label="Email" required type="email" value={form.complainantEmail} onChange={(v: string) => setForm(f => ({ ...f, complainantEmail: v }))} placeholder="john@email.com" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="Phone" value={form.complainantPhone} onChange={(v: string) => setForm(f => ({ ...f, complainantPhone: v }))} placeholder="+91 9876543210" />
                                    <InputField label="UPI VPA" value={form.complainantVpa} onChange={(v: string) => setForm(f => ({ ...f, complainantVpa: v }))} placeholder="john@upi" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="Bank Name" value={form.bankName} onChange={(v: string) => setForm(f => ({ ...f, bankName: v }))} placeholder="SBI / HDFC..." />
                                    <InputField label="Account Number" value={form.accountNumber} onChange={(v: string) => setForm(f => ({ ...f, accountNumber: v }))} placeholder="XXXX XXXX XXXX" />
                                </div>
                                <InputField label="Disputed Amount (₹)" required type="number" value={form.amountDisputed} onChange={(v: string) => setForm(f => ({ ...f, amountDisputed: v }))} placeholder="Amount in INR" />
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Notes</label>
                                    <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Brief description of the incident..."
                                        className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] resize-none placeholder-[var(--color-text-muted)]" />
                                </div>

                                {!activeCase && (
                                    <div className="p-3 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30">
                                        <p className="text-[10px] text-[var(--color-warning)] font-bold">⚠ This form requires a transaction. Open from the Transaction Detail Modal instead, or open an existing case to manage it.</p>
                                    </div>
                                )}

                                <button onClick={handleInitiate} disabled={initiating || !activeCase?.transactionId}
                                    className="w-full py-3 bg-[var(--color-accent)] text-white text-sm font-bold uppercase tracking-widest rounded-xl hover:bg-blue-500 transition-all disabled:opacity-50 shadow-lg">
                                    {initiating ? 'Initiating…' : 'Initiate Recovery Case →'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STEP: Evidence ─────────────────────────────────────── */}
                {step === 'evidence' && (
                    <div className="max-w-2xl mx-auto space-y-6">
                        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">Step 2 — Upload Evidence</h2>
                                {activeCase && <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-1">Case: {activeCase.id}</p>}
                            </div>
                            <div className="p-6 space-y-5">
                                {/* Progress checklist */}
                                {activeCase && (
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { type: 'SCREENSHOT', label: 'Screenshots', count: activeCase.screenshotsCount || 0, color: '#3b82f6', icon: '📸' },
                                            { type: 'BANK_STATEMENT', label: 'Bank Statements', count: activeCase.bankStatementsCount || 0, color: '#10b981', icon: '🏦' },
                                            { type: 'CHAT_HISTORY', label: 'Chat Records', count: activeCase.chatHistoriesCount || 0, color: '#8b5cf6', icon: '💬' },
                                        ].map(cat => (
                                            <div key={cat.type} className="p-3 rounded-xl border text-center cursor-pointer transition-all"
                                                style={{ borderColor: evidenceType === cat.type ? cat.color : 'var(--color-border)', backgroundColor: evidenceType === cat.type ? `${cat.color}10` : 'var(--color-bg-elevated)' }}
                                                onClick={() => setEvidenceType(cat.type as FileType)}>
                                                <div className="text-xl mb-1">{cat.icon}</div>
                                                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: cat.color }}>{cat.label}</p>
                                                <p className="text-xl font-black font-mono mt-1" style={{ color: cat.count > 0 ? cat.color : 'var(--color-text-muted)' }}>{cat.count}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Drop zone */}
                                <div className={`evidence-drop-zone ${dragOver ? 'drag-over' : ''}`}
                                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setEvidenceFile(f); }}
                                    onClick={() => document.getElementById('evidence-file-input')?.click()}>
                                    <input id="evidence-file-input" type="file" className="hidden"
                                        onChange={e => { if (e.target.files?.[0]) setEvidenceFile(e.target.files[0]); }} />
                                    <div className="text-3xl mb-3">📂</div>
                                    <p className="text-sm font-bold text-[var(--color-text-primary)]">
                                        {evidenceFile ? evidenceFile.name : 'Drop file here or click to browse'}
                                    </p>
                                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1 uppercase tracking-widest">
                                        Type: {evidenceType.replace('_', ' ')} · Max 10MB
                                    </p>
                                </div>

                                <button onClick={handleEvidenceUpload} disabled={!evidenceFile || evidenceUploading || !activeCase?.id}
                                    className="w-full py-2.5 bg-[var(--color-accent)] text-white text-sm font-bold uppercase tracking-widest rounded-xl hover:bg-blue-500 transition-all disabled:opacity-40">
                                    {evidenceUploading ? 'Uploading…' : `Upload ${evidenceType.replace('_', ' ')}`}
                                </button>

                                <div className="flex gap-3">
                                    <button onClick={() => setStep('documents')}
                                        className="flex-1 py-2.5 text-sm font-bold uppercase tracking-widest rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white transition-all">
                                        Continue → Documents
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STEP: Documents ────────────────────────────────────── */}
                {step === 'documents' && (
                    <div className="max-w-2xl mx-auto space-y-5">
                        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">Step 3 — Generate Documents</h2>
                                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Generate FIR and complaint letters for filing</p>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* FIR Document Card */}
                                <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-accent)]/40 transition-all">
                                    <div className="flex items-start gap-3">
                                        <div className="text-2xl">📄</div>
                                        <div>
                                            <p className="text-sm font-bold text-[var(--color-text-primary)]">First Information Report (FIR)</p>
                                            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Government of India format · Ministry of Home Affairs · IPC Sections 379, 420, 506</p>
                                            {activeCase?.firPdfPath && <p className="text-[9px] font-bold text-[var(--color-success)] mt-1 uppercase tracking-widest">✓ Generated</p>}
                                        </div>
                                    </div>
                                    <button onClick={handleGenerateFIR} disabled={firGenerating || !activeCase?.id}
                                        className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white bg-[var(--color-accent)] rounded-lg hover:bg-blue-500 transition-all disabled:opacity-40 whitespace-nowrap">
                                        {firGenerating ? 'Generating…' : 'Generate & Download'}
                                    </button>
                                </div>

                                {/* FIR Preview Button */}
                                <button onClick={() => setFirPreviewOpen(true)}
                                    className="w-full py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all">
                                    Preview FIR Format →
                                </button>

                                <button onClick={() => setStep('track')}
                                    className="w-full py-2.5 text-sm font-bold uppercase tracking-widest rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white transition-all">
                                    Continue → Track Status
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STEP: Track ────────────────────────────────────────── */}
                {step === 'track' && (
                    <div className="max-w-2xl mx-auto space-y-5">
                        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">Step 4 — Track FIR Status</h2>
                                {activeCase && <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Case expires: {new Date(activeCase.expiresAt).toLocaleDateString('en-IN')} ({getDaysRemaining(activeCase.expiresAt)} days left)</p>}
                            </div>
                            <div className="p-6 space-y-6">
                                {/* FIR Timeline */}
                                <div className="recovery-timeline">
                                    {FIR_STAGES.map((stg, i) => {
                                        const current = FIR_STAGES.indexOf(activeCase?.firStatus || 'INITIATED');
                                        const cls = i < current ? 'done' : i === current ? 'active' : '';
                                        return (
                                            <div key={stg} className={`recovery-timeline-item ${cls}`}>
                                                <p className={`text-[10px] font-bold uppercase tracking-widest ${i <= current ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>{stg.replace('_', ' ')}</p>
                                                <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5">
                                                    {i === 0 && 'Case initiated with complainant details'}
                                                    {i === 1 && 'FIR registered at police station'}
                                                    {i === 2 && 'Under active investigation'}
                                                    {i === 3 && 'Investigation concluded'}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Update FIR Details */}
                                <div className="space-y-4 p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Update FIR Status</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <InputField label="FIR Number" value={firNumber} onChange={setFirNumber} placeholder="FIR/2024/XXXX" />
                                        <InputField label="Police Station" value={policeStation} onChange={setPoliceStation} placeholder="City Cyber Crime" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">New Status</label>
                                        <select value={firStatusValue} onChange={e => setFirStatusValue(e.target.value)}
                                            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]">
                                            {['REGISTERED', 'INVESTIGATION', 'CLOSED'].map(s => <option key={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <button onClick={handleSaveFIRStatus} disabled={firStatusSaving}
                                        className="w-full py-2.5 bg-[var(--color-accent)] text-white text-[10px] font-bold uppercase tracking-widest rounded-xl disabled:opacity-50 hover:bg-blue-500 transition-all">
                                        {firStatusSaving ? 'Saving…' : 'Update FIR Status'}
                                    </button>
                                </div>

                                <button onClick={() => setStep('resolution')}
                                    className="w-full py-2.5 text-sm font-bold uppercase tracking-widest rounded-xl border border-[var(--color-success)]/40 text-[var(--color-success)] hover:bg-[var(--color-success)]/10 transition-all">
                                    Mark as Resolved →
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STEP: Resolution ───────────────────────────────────── */}
                {step === 'resolution' && (
                    <div className="max-w-xl mx-auto space-y-5">
                        {activeCase?.status === 'RESOLVED' ? (
                            <div className="bg-[var(--color-bg-card)] border border-[var(--color-success)]/30 rounded-2xl p-8 text-center">
                                <div className="text-5xl mb-3">✅</div>
                                <h2 className="text-xl font-black uppercase tracking-widest text-[var(--color-success)] mb-2">Case Resolved</h2>
                                {activeCase.recoveryAmount && (
                                    <>
                                        <p className="text-[var(--color-text-muted)] text-sm mb-1">Amount Recovered</p>
                                        <p className="text-3xl font-black font-mono text-[var(--color-success)]">₹{Number(activeCase.recoveryAmount).toLocaleString('en-IN')}</p>
                                        <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-2">on {new Date(activeCase.recoveryDate || activeCase.resolvedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    </>
                                )}
                                <button onClick={() => setStep('list')} className="mt-6 px-6 py-2 rounded-xl border border-[var(--color-border)] text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)] hover:text-white transition-all">
                                    ← Back to Cases
                                </button>
                            </div>
                        ) : (
                            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                                <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                                    <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">Step 5 — Record Resolution</h2>
                                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Record the outcome of the recovery case</p>
                                </div>
                                <div className="p-6 space-y-4">
                                    <InputField label="Amount Recovered (₹)" required type="number" value={resolveAmount} onChange={setResolveAmount} placeholder="Amount in INR" />
                                    <InputField label="Recovery Date" required type="date" value={resolveDate} onChange={setResolveDate} />
                                    <button onClick={handleResolve} disabled={resolving}
                                        className="w-full py-3 bg-[var(--color-success)] text-white text-sm font-bold uppercase tracking-widest rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg">
                                        {resolving ? 'Recording…' : '✓ Mark as Resolved'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* FIR Preview Modal */}
            {firPreviewOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="w-full max-w-2xl">
                        <div className="flex justify-end mb-2">
                            <button onClick={() => setFirPreviewOpen(false)} className="px-4 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)] hover:text-white transition-all">
                                ✕ Close
                            </button>
                        </div>
                        <div className="fir-document">
                            <h1>FIRST INFORMATION REPORT (FIR)</h1>
                            <div className="text-center mb-4" style={{ fontSize: 11, color: '#333' }}>Ministry of Home Affairs · Government of India</div>
                            <div className="section-title">COMPLAINANT DETAILS</div>
                            <p>Name: {activeCase?.complainantName || '________________________'}</p>
                            <p>Email: {activeCase?.complainantEmail || '________________________'}</p>
                            <p>Phone: {activeCase?.complainantPhone || '________________________'}</p>
                            <div className="section-title">TRANSACTION DETAILS</div>
                            <p>RRN: {activeCase?.transaction?.rrn || '________________________'}</p>
                            <p>Amount: ₹{activeCase?.amountDisputed ? Number(activeCase.amountDisputed).toLocaleString('en-IN') : '________________________'}</p>
                            <div className="section-title">IPC SECTIONS</div>
                            <p>• Section 420 — Cheating</p><p>• Section 379 — Theft</p><p>• Section 120B — Criminal Conspiracy</p>
                            <div className="section-title">EVIDENCE STATUS</div>
                            <p>Screenshots: {activeCase?.screenshotsCount ? `✓ (${activeCase.screenshotsCount})` : '✗'}</p>
                            <p>Bank Statements: {activeCase?.bankStatementsCount ? `✓ (${activeCase.bankStatementsCount})` : '✗'}</p>
                            <p>Chat Records: {activeCase?.chatHistoriesCount ? `✓ (${activeCase.chatHistoriesCount})` : '✗'}</p>
                            <div className="section-title">OFFICER DETAILS (To be filled)</div>
                            <p>FIR Number: {activeCase?.firNumber || '____________________'}</p>
                            <p>Police Station: {activeCase?.policeStationName || '____________________'}</p>
                            <p>Registration Date: ____________________</p>
                            <div className="section-title">COMPLAINANT SIGNATURE</div>
                            <p>Signature: ____________________&nbsp;&nbsp;&nbsp;&nbsp;Date: {new Date().toLocaleDateString('en-IN')}</p>
                            <div style={{ textAlign: 'center', fontSize: 9, color: '#888', marginTop: 20, borderTop: '1px solid #ccc', paddingTop: 8 }}>
                                Generated by FraudShield · Case Ref: {activeCase?.id || 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
