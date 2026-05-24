import { useState, useEffect } from 'react';
import { uploadBatchFile, getBatchStatus, getAllBatches, downloadBatchReportCsv, downloadBatchReportPdf } from '../api/client';

const DocumentIcon = () => (<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>);

export default function BatchUploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [currentBatch, setCurrentBatch] = useState<any>(null);
    const [batches, setBatches] = useState<any[]>([]);
    const [downloadingCsv, setDownloadingCsv] = useState<string | null>(null);
    const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

    useEffect(() => {
        fetchBatches();
    }, []);

    useEffect(() => {
        if (!currentBatch || currentBatch.status === 'COMPLETED' || currentBatch.status === 'FAILED') return;
        const interval = setInterval(async () => {
            const data = await getBatchStatus(currentBatch.id);
            setCurrentBatch(data);
            if (data.status === 'COMPLETED' || data.status === 'FAILED') {
                clearInterval(interval);
                fetchBatches();
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [currentBatch]);

    const fetchBatches = async () => {
        try {
            const data = await getAllBatches();
            setBatches(data);
        } catch(e) {}
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        try {
            const { batchId } = await uploadBatchFile(file);
            const status = await getBatchStatus(batchId);
            setCurrentBatch(status);
            setFile(null);
            fetchBatches();
        } catch(e: any) {
            alert(e.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDownloadPdf = async (id: string) => {
        setDownloadingPdf(id);
        try {
            await downloadBatchReportPdf(id);
            alert('PDF downloaded successfully');
        } catch (e) {
            alert('Failed to download PDF report');
        } finally {
            setDownloadingPdf(null);
        }
    };

    const handleDownloadCsv = async (id: string) => {
        setDownloadingCsv(id);
        try {
            await downloadBatchReportCsv(id);
            alert('CSV downloaded successfully');
        } catch (e) {
            alert('Failed to download CSV report');
        } finally {
            setDownloadingCsv(null);
        }
    };

    return (
        <div className="font-sans relative flex flex-col min-h-screen">
            <header className="bg-[var(--color-bg-card)] border-b border-[var(--color-border)] px-4 md:px-6 py-4 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-opacity-95 flex justify-between items-center">
                <h1 className="text-sm font-bold tracking-widest text-white uppercase">Batch Matrix Upload</h1>
            </header>

            <main className="max-w-[1200px] w-full mx-auto p-4 md:p-8 space-y-8 animate-in fade-in">
                {/* Upload Section */}
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-8 shadow-xl">
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex-1 border-2 border-dashed border-[var(--color-border)] rounded-lg p-8 flex flex-col items-center justify-center bg-[var(--color-bg-primary)] hover:border-[var(--color-accent)] transition-colors relative group">
                            <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors mb-4"><DocumentIcon /></div>
                            <h3 className="text-white font-bold mb-2 text-center">{file ? file.name : 'Drop CSV file or click to browse'}</h3>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)] text-center">Max 5000 rows. Required headers: senderVpa, receiverVpa, amount, location</p>
                        </div>
                        
                        <div className="w-full md:w-72 flex flex-col justify-between space-y-4">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-2">Upload Queue</h3>
                                {file ? (
                                    <div className="bg-[var(--color-bg-elevated)] p-3 border border-[var(--color-border)] rounded font-mono text-xs text-[var(--color-text-secondary)]">
                                        <p className="text-white mb-1 truncate">{file.name}</p>
                                        <p>{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                ) : (
                                    <div className="bg-[var(--color-bg-primary)] p-3 border border-dashed border-[var(--color-border-subtle)] rounded text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)] text-center">
                                        No payload selected
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={handleUpload} 
                                    disabled={!file || uploading}
                                    className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-glow)] text-white font-bold uppercase tracking-widest text-xs py-3 rounded transition-colors shadow-[0_0_15px_var(--color-accent)]/20 disabled:opacity-50 disabled:shadow-none"
                                >
                                    {uploading ? 'UPLOADING...' : 'PROCESS BATCH PAYLOAD'}
                                </button>
                                <a href="/example_batch.csv" download className="w-full text-center py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-border-subtle)] rounded transition-colors">
                                    Download Template
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Live Processing Tracker */}
                {currentBatch && currentBatch.status === 'PROCESSING' && (
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 shadow-xl animate-in slide-in-from-bottom">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse"></div> Active Matrix Tracker
                            </h3>
                            <span className="text-xs font-mono text-[var(--color-accent)]">{currentBatch.processedCount} / {currentBatch.totalCount} TX</span>
                        </div>
                        <div className="w-full bg-[var(--color-bg-primary)] h-3 rounded-full overflow-hidden border border-[var(--color-border-subtle)]">
                            <div className="h-full bg-[var(--color-accent)] transition-all duration-500 ease-out" style={{ width: `${(currentBatch.processedCount / currentBatch.totalCount) * 100}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center mt-3 text-[10px] font-bold tracking-widest uppercase">
                            <span className="text-[var(--color-danger)]">{currentBatch.frozenCount} Frozen</span>
                            <span className="text-[var(--color-success)]">{currentBatch.allowedCount} Allowed</span>
                        </div>
                    </div>
                )}

                {/* Batch History Array */}
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white">Processed Batches History</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono text-[var(--color-text-secondary)]">
                            <thead className="bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] uppercase tracking-widest text-[9px]">
                                <tr>
                                    <th className="px-6 py-3 text-white">Batch ID</th>
                                    <th className="px-6 py-3">File Target</th>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Volume</th>
                                    <th className="px-6 py-3">Frozen Rate</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Export Vectors</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border-subtle)]">
                                {batches.length === 0 ? (
                                    <tr><td colSpan={7} className="px-6 py-8 text-center text-[var(--color-text-muted)] text-[10px] uppercase font-bold tracking-widest">No historical matrices mapped</td></tr>
                                ) : batches.map(batch => {
                                    const rate = batch.totalCount > 0 ? ((batch.frozenCount / batch.totalCount) * 100).toFixed(1) : '0.0';
                                    return (
                                        <tr key={batch.id} className="hover:bg-[var(--color-bg-elevated)] transition-colors">
                                            <td className="px-6 py-3 text-white font-bold">{batch.id.split('-')[0]}</td>
                                            <td className="px-6 py-3">{batch.fileName}</td>
                                            <td className="px-6 py-3">{new Date(batch.createdAt).toLocaleString()}</td>
                                            <td className="px-6 py-3">{batch.totalCount}</td>
                                            <td className="px-6 py-3 text-[var(--color-danger)] font-bold">{rate}%</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider ${batch.status === 'COMPLETED' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : batch.status === 'PROCESSING' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'}`}>
                                                    {batch.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                {batch.status === 'COMPLETED' && (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button disabled={downloadingCsv === batch.id} onClick={() => handleDownloadCsv(batch.id)} className="px-2 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-[9px] font-bold uppercase tracking-widest hover:text-white hover:border-[var(--color-border-subtle)] transition-colors disabled:opacity-50">{downloadingCsv === batch.id ? 'DL...' : 'CSV'}</button>
                                                        <button disabled={downloadingPdf === batch.id} onClick={() => handleDownloadPdf(batch.id)} className="px-2 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30 rounded text-[9px] font-bold uppercase tracking-widest hover:bg-[var(--color-accent)] hover:text-white transition-colors disabled:opacity-50">{downloadingPdf === batch.id ? 'DL...' : 'PDF'}</button>
                                                    </div>
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
