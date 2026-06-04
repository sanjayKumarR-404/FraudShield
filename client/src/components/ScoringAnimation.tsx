import { useEffect, useState, useRef } from 'react';

interface AttributionComponent {
    weight: number;
    value: number;
    contribution: number;
    reason: string;
}

interface Attribution {
    gnn?: AttributionComponent;
    location?: AttributionComponent;
    amount?: AttributionComponent;
    velocity?: AttributionComponent;
    behavioral?: AttributionComponent;
    receiver?: AttributionComponent;
}

interface ScoringAnimationProps {
    attribution: Attribution | null;
    finalScore: number;
    status: 'FROZEN' | 'SUCCESS';
    onComplete: () => void;
    onSkip: () => void;
}

const STEPS = [
    { id: 1, label: 'Extracting Features', duration: 500 },
    { id: 2, label: 'Building Transaction Graph', duration: 700 },
    { id: 3, label: 'Running GNN Inference', duration: 800 },
    { id: 4, label: 'Applying Scoring Formula', duration: 800 },
    { id: 5, label: 'Decision', duration: 200 },
];

const FEATURE_LABELS = [
    { key: 'amount', label: 'Amount Risk', color: '#f59e0b' },
    { key: 'location', label: 'Location Risk', color: '#ef4444' },
    { key: 'velocity', label: 'Velocity Score', color: '#8b5cf6' },
    { key: 'gnn', label: 'GNN Score', color: '#3b82f6' },
    { key: 'behavioral', label: 'Behavioral', color: '#10b981' },
    { key: 'receiver', label: 'Receiver Risk', color: '#f97316' },
];

const SCORING_ROWS = [
    { key: 'gnn', label: 'GNN', color: '#3b82f6', weight: 0.30 },
    { key: 'location', label: 'Location', color: '#ef4444', weight: 0.20 },
    { key: 'amount', label: 'Amount', color: '#f59e0b', weight: 0.15 },
    { key: 'velocity', label: 'Velocity', color: '#8b5cf6', weight: 0.15 },
    { key: 'receiver', label: 'Receiver', color: '#f97316', weight: 0.10 },
    { key: 'behavioral', label: 'Behavioral', color: '#10b981', weight: 0.10 },
];

export default function ScoringAnimation({ attribution, finalScore, status, onComplete, onSkip }: ScoringAnimationProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [visibleFeatures, setVisibleFeatures] = useState<number[]>([]);
    const [graphNodes, setGraphNodes] = useState<number[]>([]);
    const [gnnLayer, setGnnLayer] = useState(-1);
    const [visibleBars, setVisibleBars] = useState<number[]>([]);
    const [runningTotal, setRunningTotal] = useState(0);
    const [showDecision, setShowDecision] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let elapsed = 0;
        void elapsed; // suppress unused warning

        // Step 1: Feature extraction (0-500ms)
        const step1 = setTimeout(() => {
            setCurrentStep(1);
            FEATURE_LABELS.forEach((_, i) => {
                setTimeout(() => setVisibleFeatures(prev => [...prev, i]), i * 80);
            });
        }, 0);

        // Step 2: Graph building (500-1200ms)
        const step2 = setTimeout(() => {
            setCurrentStep(2);
            setVisibleFeatures(FEATURE_LABELS.map((_, i) => i));
            [0, 1, 2, 3, 4, 5].forEach((_, i) => {
                setTimeout(() => setGraphNodes(prev => [...prev, i]), i * 110);
            });
        }, 500);

        // Step 3: GNN Inference (1200-2000ms)
        const step3 = setTimeout(() => {
            setCurrentStep(3);
            [0, 1, 2, 3].forEach((i) => {
                setTimeout(() => setGnnLayer(i), i * 190);
            });
        }, 1200);

        // Step 4: Scoring formula (2000-2800ms)
        const step4 = setTimeout(() => {
            setCurrentStep(4);
            setGnnLayer(3);
            let total = 0;
            SCORING_ROWS.forEach((row, i) => {
                setTimeout(() => {
                    setVisibleBars(prev => [...prev, i]);
                    const comp = attribution?.[row.key as keyof Attribution];
                    const contribution = comp ? comp.contribution : row.weight * 0;
                    total += contribution;
                    setRunningTotal(total);
                }, i * 120);
            });
        }, 2000);

        // Step 5: Decision (2800ms)
        const step5 = setTimeout(() => {
            setCurrentStep(5);
            setShowDecision(true);
        }, 2800);

        // Complete (3200ms)
        const complete = setTimeout(() => {
            onComplete();
        }, 3200);

        timerRef.current = complete;

        return () => {
            clearTimeout(step1); clearTimeout(step2); clearTimeout(step3);
            clearTimeout(step4); clearTimeout(step5); clearTimeout(complete);
        };
    }, []);

    const getStepStatus = (stepId: number) => {
        if (currentStep > stepId) return 'done';
        if (currentStep === stepId) return 'active';
        return 'pending';
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
            <div className="w-full max-w-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-2xl relative">

                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
                        <span className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">
                            AI Fraud Analysis Pipeline
                        </span>
                    </div>
                    <button
                        onClick={onSkip}
                        className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-accent)] transition-all"
                    >
                        Skip →
                    </button>
                </div>

                {/* Step Progress */}
                <div className="px-6 py-3 border-b border-[var(--color-border)] flex gap-2 overflow-x-auto">
                    {STEPS.map((step) => {
                        const st = getStepStatus(step.id);
                        return (
                            <div key={step.id} className="flex items-center gap-1.5 flex-shrink-0">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black transition-all duration-300 ${
                                    st === 'done' ? 'bg-[var(--color-success)] text-white' :
                                    st === 'active' ? 'bg-[var(--color-accent)] text-white animate-pulse' :
                                    'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
                                }`}>
                                    {st === 'done' ? '✓' : step.id}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors duration-300 ${
                                    st === 'active' ? 'text-[var(--color-accent)]' :
                                    st === 'done' ? 'text-[var(--color-success)]' :
                                    'text-[var(--color-text-muted)]'
                                }`}>{step.label}</span>
                                {step.id < STEPS.length && <span className="text-[var(--color-border)] mx-1">›</span>}
                            </div>
                        );
                    })}
                </div>

                {/* Main Content Area */}
                <div className="p-6 min-h-[300px]">

                    {/* Step 1 & 2: Feature Cards */}
                    {currentStep <= 2 && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
                                {currentStep === 1 ? '▶ Extracting 6 Feature Vectors...' : '▶ Building Transaction Graph...'}
                            </p>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {FEATURE_LABELS.map((feat, i) => {
                                    const comp = attribution?.[feat.key as keyof Attribution];
                                    const value = comp ? comp.value : 0;
                                    return (
                                        <div
                                            key={feat.key}
                                            className={`p-2.5 rounded-lg border transition-all duration-300 ${
                                                visibleFeatures.includes(i)
                                                    ? 'opacity-100 translate-x-0'
                                                    : 'opacity-0 -translate-x-4'
                                            }`}
                                            style={{ borderColor: `${feat.color}40`, backgroundColor: `${feat.color}10` }}
                                        >
                                            <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: feat.color }}>{feat.label}</p>
                                            <p className="text-sm font-mono font-bold text-[var(--color-text-primary)]">{value.toFixed(3)}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Mini SVG Graph (Step 2) */}
                            {currentStep === 2 && (
                                <div className="mt-2">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Transaction Graph — Last 5 Historical Nodes</p>
                                    <svg viewBox="0 0 400 120" className="w-full h-24 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
                                        {/* Edges */}
                                        {graphNodes.slice(1).map((_, i) => (
                                            <line key={i}
                                                x1={60} y1={60}
                                                x2={100 + i * 60} y2={i % 2 === 0 ? 30 : 90}
                                                stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.4"
                                                strokeDasharray="4 2"
                                                className="animate-in fade-in duration-300"
                                            />
                                        ))}
                                        {/* Center node (current tx) */}
                                        {graphNodes.length > 0 && (
                                            <circle cx={60} cy={60} r={16} fill="#3b82f6" fillOpacity="0.3" stroke="#3b82f6" strokeWidth="2" className="animate-in zoom-in-50 duration-200" />
                                        )}
                                        {graphNodes.length > 0 && (
                                            <text x={60} y={64} textAnchor="middle" fill="#93c5fd" fontSize="7" fontWeight="bold">CURRENT</text>
                                        )}
                                        {/* Historical nodes */}
                                        {graphNodes.slice(1).map((_, i) => (
                                            <g key={i} className="animate-in zoom-in-50 duration-200">
                                                <circle cx={100 + i * 60} cy={i % 2 === 0 ? 30 : 90} r={10} fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.6" />
                                                <text x={100 + i * 60} y={(i % 2 === 0 ? 30 : 90) + 3} textAnchor="middle" fill="#64748b" fontSize="6">T-{i + 1}</text>
                                            </g>
                                        ))}
                                    </svg>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: GNN Inference */}
                    {currentStep === 3 && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">▶ Running GNN Inference Through Layers...</p>
                            <div className="flex items-center justify-between gap-2 relative">
                                {['Input\n(8 feat)', 'Hidden 1\n(64)', 'Hidden 2\n(32)', 'Output'].map((layer, i) => (
                                    <div key={i} className="flex-1 relative">
                                        <div className={`p-3 rounded-lg border text-center transition-all duration-400 ${
                                            gnnLayer >= i
                                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                                                : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)]'
                                        }`}>
                                            {layer.split('\n').map((line, j) => (
                                                <p key={j} className={`text-[9px] font-bold uppercase tracking-wider leading-tight ${gnnLayer >= i ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>{line}</p>
                                            ))}
                                            {/* Stacked bars inside layer */}
                                            <div className="flex justify-center gap-0.5 mt-2">
                                                {Array.from({ length: Math.min(i === 0 ? 8 : i === 1 ? 12 : i === 2 ? 8 : 1, 12) }).map((_, j) => (
                                                    <div key={j} className={`w-1 rounded-full transition-all duration-300 ${gnnLayer >= i ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}
                                                        style={{ height: `${8 + Math.sin(j * 0.8) * 6}px` }} />
                                                ))}
                                            </div>
                                        </div>
                                        {i < 3 && (
                                            <div className={`absolute top-1/2 -right-3 w-6 h-0.5 -translate-y-1/2 transition-colors duration-300 ${gnnLayer > i ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}>
                                                <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-colors duration-300 ${gnnLayer > i ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 text-center">
                                <span className="text-[9px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest">
                                    {gnnLayer >= 3 ? `GNN Output: ${(attribution?.gnn?.value || 0).toFixed(4)}` : 'Processing...'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Scoring Formula */}
                    {currentStep === 4 && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">▶ Applying Weighted Scoring Formula...</p>
                            <div className="space-y-2">
                                {SCORING_ROWS.map((row, i) => {
                                    const comp = attribution?.[row.key as keyof Attribution];
                                    const value = comp ? comp.value : 0;
                                    const contribution = comp ? comp.contribution : 0;
                                    const barWidth = Math.min(100, value * 100);
                                    return (
                                        <div key={row.key} className={`transition-all duration-300 ${visibleBars.includes(i) ? 'opacity-100' : 'opacity-0'}`}>
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-[10px] font-bold uppercase tracking-wider w-20" style={{ color: row.color }}>{row.label}</span>
                                                <span className="text-[9px] font-mono text-[var(--color-text-muted)]">
                                                    {row.weight.toFixed(2)} × {value.toFixed(3)} = <span className="font-bold" style={{ color: row.color }}>{contribution.toFixed(4)}</span>
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{
                                                        width: visibleBars.includes(i) ? `${barWidth}%` : '0%',
                                                        backgroundColor: row.color,
                                                        boxShadow: `0 0 6px ${row.color}80`
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Running Total</span>
                                <span className="text-2xl font-black font-mono text-[var(--color-accent)]">{runningTotal.toFixed(4)}</span>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Decision */}
                    {currentStep === 5 && showDecision && (
                        <div className={`flex flex-col items-center justify-center gap-4 py-8 animate-in zoom-in-95 duration-300 ${status === 'FROZEN' ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                            <div className={`text-6xl font-black font-mono tracking-tighter text-center ${status === 'FROZEN' ? 'drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]' : 'drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]'}`}>
                                {status === 'FROZEN' ? '🔒 FROZEN' : '✅ APPROVED'}
                            </div>
                            <div className={`text-xl font-mono font-bold`}>{finalScore.toFixed(4)}</div>
                            <div className={`text-sm font-bold uppercase tracking-widest px-6 py-2 rounded-lg border ${
                                status === 'FROZEN'
                                    ? 'bg-[var(--color-danger)]/10 border-[var(--color-danger)]/30'
                                    : 'bg-[var(--color-success)]/10 border-[var(--color-success)]/30'
                            }`}>
                                {status === 'FROZEN' ? 'Transaction Intercepted by AI Engine' : 'Transaction Cleared for Processing'}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
