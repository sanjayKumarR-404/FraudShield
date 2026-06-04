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
    autoPlay?: boolean;
    onSkip?: () => void;
}

const BASE_TIMINGS = [600, 900, 1000, 1000, 400];

const STEPS = [
    { id: 1, label: 'Feature Extraction' },
    { id: 2, label: 'Graph Building' },
    { id: 3, label: 'GNN Inference' },
    { id: 4, label: 'Scoring Formula' },
    { id: 5, label: 'Decision' },
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

const SPEEDS = [0.5, 1, 1.5, 2] as const;
type Speed = typeof SPEEDS[number];

export default function ScoringAnimation({ attribution, finalScore, status, onComplete, onSkip }: ScoringAnimationProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [visibleFeatures, setVisibleFeatures] = useState<number[]>([]);
    const [graphNodes, setGraphNodes] = useState<number[]>([]);
    const [gnnLayer, setGnnLayer] = useState(-1);
    const [visibleBars, setVisibleBars] = useState<number[]>([]);
    const [runningTotal, setRunningTotal] = useState(0);
    const [showDecision, setShowDecision] = useState(false);

    // Controls
    const [speedMultiplier, setSpeedMultiplier] = useState<Speed>(1);
    const [isPaused, setIsPaused] = useState(false);
    const [isManualMode, setIsManualMode] = useState(false);
    const [completed, setCompleted] = useState(false);

    // Refs for timer management
    const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const replayKeyRef = useRef(0);

    const clearScheduledSteps = () => {
        timeoutsRef.current.forEach(clearTimeout);
        timeoutsRef.current = [];
    };

    const scheduleStep = (stepNumber: number, delayMs: number) => {
        const timeout = setTimeout(() => {
            if (!isPaused) {
                setCurrentStep(stepNumber);
            }
        }, delayMs / speedMultiplier);
        timeoutsRef.current.push(timeout);
    };

    const handlePlayPause = () => {
        if (isPaused) {
            setIsPaused(false);
            // Resume animation from current step
            scheduleStep(currentStep + 1, BASE_TIMINGS[Math.min(currentStep, 4)]);
        } else {
            setIsPaused(true);
            clearScheduledSteps();
        }
    };

    const handleNextStep = () => {
        clearScheduledSteps();
        switch(currentStep) {
            case 0: setCurrentStep(1); break;
            case 1: setCurrentStep(2); break;
            case 2: setCurrentStep(3); break;
            case 3: setCurrentStep(4); break;
            case 4: setCurrentStep(5); break;
            case 5: setCompleted(true); break;
        }
    };

    // Main animation effect for scheduling steps
    useEffect(() => {
        if (isManualMode || isPaused || completed) return;
        clearScheduledSteps();

        let cumulativeDelay = 0;
        const stepTimings = [
            { step: 1, delay: 600 },
            { step: 2, delay: 900 },
            { step: 3, delay: 1000 },
            { step: 4, delay: 1000 },
            { step: 5, delay: 400 },
            { step: 6, delay: 600 } // done
        ];

        // Start from current step
        stepTimings.filter(t => t.step > currentStep).forEach(({ step, delay }) => {
            scheduleStep(step === 6 ? 5 : step, cumulativeDelay + delay);
            if (step === 6) {
                 const doneTimeout = setTimeout(() => {
                     if (!isPaused) setCompleted(true);
                 }, (cumulativeDelay + delay) / speedMultiplier);
                 timeoutsRef.current.push(doneTimeout);
            }
            cumulativeDelay += delay;
        });

        return () => clearScheduledSteps();
    }, [isPaused, isManualMode, speedMultiplier, currentStep, completed]);

    // Side-effect for visual rendering based on currentStep
    useEffect(() => {
        if (currentStep === 1) {
            FEATURE_LABELS.forEach((_, i) => setTimeout(() => setVisibleFeatures(prev => [...prev, i]), (i * 80) / speedMultiplier));
        } else if (currentStep === 2) {
            setVisibleFeatures(FEATURE_LABELS.map((_, i) => i));
            [0,1,2,3,4,5].forEach((_, i) => setTimeout(() => setGraphNodes(prev => [...prev, i]), (i * 110) / speedMultiplier));
        } else if (currentStep === 3) {
            [0,1,2,3].forEach((i) => setTimeout(() => setGnnLayer(i), (i * 190) / speedMultiplier));
        } else if (currentStep === 4) {
            setGnnLayer(3);
            let total = 0;
            SCORING_ROWS.forEach((row, i) => {
                setTimeout(() => {
                    setVisibleBars(prev => [...prev, i]);
                    const comp = attribution?.[row.key as keyof Attribution];
                    total += comp ? comp.contribution : 0;
                    setRunningTotal(total);
                }, (i * 120) / speedMultiplier);
            });
        } else if (currentStep === 5) {
            setShowDecision(true);
        }
    }, [currentStep, attribution, speedMultiplier]);

    const handleReplay = () => {
        replayKeyRef.current += 1;
        setVisibleFeatures([]);
        setGraphNodes([]);
        setGnnLayer(-1);
        setVisibleBars([]);
        setRunningTotal(0);
        setShowDecision(false);
        setCompleted(false);
        setIsPaused(false);
        setCurrentStep(0);
    };

    const handleSkip = () => {
        clearScheduledSteps();
        setCurrentStep(5);
        setVisibleFeatures(FEATURE_LABELS.map((_, i) => i));
        setGraphNodes([0,1,2,3,4,5]);
        setGnnLayer(3);
        const newBars: number[] = [];
        let total = 0;
        SCORING_ROWS.forEach((row, i) => {
            newBars.push(i);
            const comp = attribution?.[row.key as keyof Attribution];
            total += comp ? comp.contribution : 0;
        });
        setVisibleBars(newBars);
        setRunningTotal(total);
        setShowDecision(true);
        setCompleted(true);
        onSkip?.();
    };

    const getStepStatus = (stepId: number) => {
        if (currentStep > stepId) return 'done';
        if (currentStep === stepId) return 'active';
        return 'pending';
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
            <div className="w-full max-w-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-2xl relative">

                {/* Header */}
                <div className="px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
                        <span className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">
                            AI Fraud Analysis Pipeline
                        </span>
                    </div>
                    
                    <div className="flex gap-2 items-center">
                        {/* Speed Slider */}
                        <select 
                            value={speedMultiplier} 
                            onChange={(e) => setSpeedMultiplier(Number(e.target.value) as Speed)}
                            className="bg-transparent border border-[var(--color-border)] text-xs text-white rounded px-2 py-1 outline-none mr-2"
                        >
                            <option value={0.5}>0.5x</option>
                            <option value={1}>1x</option>
                            <option value={1.5}>1.5x</option>
                            <option value={2}>2x</option>
                        </select>
                        
                        {/* Play/Pause */}
                        {!completed && !isManualMode && (
                            <button 
                                onClick={handlePlayPause}
                                className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-accent)] transition-all"
                            >
                                {isPaused ? '▶ Play' : '⏸ Pause'}
                            </button>
                        )}
                        
                        {/* Step-by-Step Mode Toggle */}
                        {!completed && (
                            <button 
                                onClick={() => {
                                    const next = !isManualMode;
                                    setIsManualMode(next);
                                    if (!next) {
                                        clearScheduledSteps();
                                        setIsPaused(false);
                                    }
                                }}
                                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border transition-all ${isManualMode ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white'}`}
                            >
                                {isManualMode ? '🎬 Auto' : '⏭ Step'}
                            </button>
                        )}
                        
                        {/* Skip */}
                        {!completed && (
                            <button 
                                onClick={handleSkip}
                                className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-accent)] transition-all"
                            >
                                Skip →
                            </button>
                        )}
                    </div>
                </div>

                {/* Step Progress */}
                <div className="px-6 py-2.5 border-b border-[var(--color-border)] flex gap-2 overflow-x-auto">
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
                                {step.id < STEPS.length && <span className="text-[var(--color-border)] mx-0.5">›</span>}
                            </div>
                        );
                    })}
                </div>

                {/* Pause overlay */}
                {isPaused && !completed && (
                    <div className="absolute inset-x-0 top-[88px] bottom-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-b-2xl">
                        <div className="text-center">
                            <div className="text-4xl mb-2">⏸</div>
                            <p className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Paused</p>
                            <button
                                onClick={() => {
                                    setIsPaused(false);
                                    // Resume animation from current step
                                    const nextStepDelay = currentStep >= 5 ? 600 : BASE_TIMINGS[currentStep];
                                    scheduleStep(currentStep + 1, nextStepDelay);
                                }}
                                className="mt-4 px-6 py-2 bg-[var(--color-accent)] text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-blue-500 transition-colors"
                            >
                                ▶ Resume
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Content Area */}
                <div className="p-6 min-h-[280px]">

                    {/* Steps 1 & 2: Feature Cards */}
                    {currentStep >= 1 && currentStep <= 2 && (
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
                                            className={`p-2.5 rounded-lg border transition-all duration-300 ${visibleFeatures.includes(i) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                                            style={{ borderColor: `${feat.color}40`, backgroundColor: `${feat.color}10` }}
                                        >
                                            <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: feat.color }}>{feat.label}</p>
                                            <p className="text-sm font-mono font-bold text-[var(--color-text-primary)]">{value.toFixed(3)}</p>
                                        </div>
                                    );
                                })}
                            </div>
                            {currentStep === 2 && (
                                <div className="mt-2">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Transaction Graph — Historical Context Nodes</p>
                                    <svg viewBox="0 0 400 120" className="w-full h-24 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
                                        {graphNodes.slice(1).map((_, i) => (
                                            <line key={i} x1={60} y1={60} x2={100 + i * 60} y2={i % 2 === 0 ? 30 : 90}
                                                stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="4 2" />
                                        ))}
                                        {graphNodes.length > 0 && <circle cx={60} cy={60} r={16} fill="#3b82f6" fillOpacity="0.3" stroke="#3b82f6" strokeWidth="2" />}
                                        {graphNodes.length > 0 && <text x={60} y={64} textAnchor="middle" fill="#93c5fd" fontSize="7" fontWeight="bold">CURRENT</text>}
                                        {graphNodes.slice(1).map((_, i) => (
                                            <g key={i}>
                                                <circle cx={100 + i * 60} cy={i % 2 === 0 ? 30 : 90} r={10} fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.6" />
                                                <text x={100 + i * 60} y={(i % 2 === 0 ? 30 : 90) + 3} textAnchor="middle" fill="#64748b" fontSize="6">T-{i + 1}</text>
                                            </g>
                                        ))}
                                    </svg>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: GNN */}
                    {currentStep === 3 && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">▶ Running GNN Inference Through Layers...</p>
                            <div className="flex items-center justify-between gap-2 relative">
                                {['Input\n(8 feat)', 'Hidden 1\n(64)', 'Hidden 2\n(32)', 'Output'].map((layer, i) => (
                                    <div key={i} className="flex-1 relative">
                                        <div className={`p-3 rounded-lg border text-center transition-all duration-500 ${
                                            gnnLayer >= i
                                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                                                : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)]'
                                        }`}>
                                            {layer.split('\n').map((line, j) => (
                                                <p key={j} className={`text-[9px] font-bold uppercase tracking-wider leading-tight ${gnnLayer >= i ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>{line}</p>
                                            ))}
                                            <div className="flex justify-center gap-0.5 mt-2">
                                                {Array.from({ length: Math.min(i === 0 ? 8 : i === 1 ? 12 : i === 2 ? 8 : 1, 12) }).map((_, j) => (
                                                    <div key={j} className={`w-1 rounded-full transition-all duration-300 ${gnnLayer >= i ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}
                                                        style={{ height: `${8 + Math.sin(j * 0.8) * 6}px` }} />
                                                ))}
                                            </div>
                                        </div>
                                        {i < 3 && (
                                            <div className={`absolute top-1/2 -right-3 w-6 h-0.5 -translate-y-1/2 transition-colors duration-300 ${gnnLayer > i ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}>
                                                <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${gnnLayer > i ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`} />
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

                    {/* Step 4: Scoring */}
                    {currentStep === 4 && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">▶ Applying Weighted Scoring Formula...</p>
                            <div className="space-y-2">
                                {SCORING_ROWS.map((row, i) => {
                                    const comp = attribution?.[row.key as keyof Attribution];
                                    const value = comp ? comp.value : 0;
                                    const contribution = comp ? comp.contribution : 0;
                                    return (
                                        <div key={row.key} className={`transition-all duration-300 ${visibleBars.includes(i) ? 'opacity-100' : 'opacity-0'}`}>
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-[10px] font-bold uppercase tracking-wider w-20" style={{ color: row.color }}>{row.label}</span>
                                                <span className="text-[9px] font-mono text-[var(--color-text-muted)]">
                                                    {row.weight.toFixed(2)} × {value.toFixed(3)} = <span className="font-bold" style={{ color: row.color }}>{contribution.toFixed(4)}</span>
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-500"
                                                    style={{ width: visibleBars.includes(i) ? `${Math.min(100, value * 100)}%` : '0%', backgroundColor: row.color, boxShadow: `0 0 6px ${row.color}80` }} />
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
                            <div className={`text-5xl font-black font-mono tracking-tighter text-center ${status === 'FROZEN' ? 'drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]' : 'drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]'}`}>
                                {status === 'FROZEN' ? '🔒 FROZEN' : '✅ APPROVED'}
                            </div>
                            <div className="text-xl font-mono font-bold">{finalScore.toFixed(4)}</div>
                            <div className={`text-sm font-bold uppercase tracking-widest px-6 py-2 rounded-lg border ${
                                status === 'FROZEN'
                                    ? 'bg-[var(--color-danger)]/10 border-[var(--color-danger)]/30'
                                    : 'bg-[var(--color-success)]/10 border-[var(--color-success)]/30'
                            }`}>
                                {status === 'FROZEN' ? 'Transaction Intercepted by AI Engine' : 'Transaction Cleared for Processing'}
                            </div>
                        </div>
                    )}

                    {/* Placeholder when at step 0 */}
                    {currentStep === 0 && (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                </div>

                {/* Footer controls */}
                <div className="px-6 pb-5 flex items-center justify-between">
                    {/* Manual step advance */}
                    {isManualMode && !completed && (
                        <button
                            onClick={handleNextStep}
                            disabled={currentStep >= 5}
                            className="px-6 py-2 bg-[var(--color-accent)] text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-blue-500 transition-all disabled:opacity-40"
                        >
                            Next ›
                        </button>
                    )}
                    {!isManualMode && !completed && <div />}

                    {/* Post-completion buttons */}
                    {completed && (
                        <div className="flex items-center gap-3 w-full justify-center">
                            <button
                                onClick={handleReplay}
                                className="px-5 py-2 text-xs font-bold uppercase tracking-widest rounded-lg border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-all"
                            >
                                ↺ Replay
                            </button>
                            <button
                                onClick={onComplete}
                                className="px-5 py-2 bg-[var(--color-bg-elevated)] text-xs font-bold uppercase tracking-widest rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white transition-all"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
