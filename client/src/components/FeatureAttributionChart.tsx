import React, { useState } from 'react';

export interface AttributionComponent {
    weight: number;
    value: number;
    contribution: number;
    reason: string;
}

export interface FeatureAttribution {
    gnn?: AttributionComponent;
    location?: AttributionComponent;
    amount?: AttributionComponent;
    velocity?: AttributionComponent;
    behavioral?: AttributionComponent;
}

interface FeatureAttributionChartProps {
    attribution: FeatureAttribution | null | undefined;
    finalScore: number;
}

const COLORS: Record<string, string> = {
    gnn: 'var(--color-accent)', // Blue
    location: 'var(--color-danger)', // Red
    amount: 'var(--color-warning)', // Orange/Yellow
    velocity: '#facc15', // Yellow
    behavioral: '#c084fc', // Purple
};

const LABELS: Record<string, string> = {
    gnn: 'Graph Neural Network',
    location: 'Location Risk',
    amount: 'Amount Spike',
    velocity: 'Velocity / Volume',
    behavioral: 'Behavioral Pattern'
};

export default function FeatureAttributionChart({ attribution }: FeatureAttributionChartProps) {
    const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
    const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

    if (!attribution || typeof attribution !== 'object' || Object.keys(attribution).length === 0) {
        return (
            <div className="bg-[var(--color-bg-elevated)] p-4 rounded-lg flex items-center justify-center border border-[var(--color-border)] mt-4">
                <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-widest font-bold">Attribution data not available for legacy transaction</p>
            </div>
        );
    }

    const components = Object.entries(attribution).map(([key, data]) => ({
        key,
        ...data as AttributionComponent
    })).sort((a, b) => b.contribution - a.contribution);

    const totalContribution = components.reduce((sum, c) => sum + c.contribution, 0);

    return (
        <div className="flex flex-col gap-5 animate-in fade-in mt-4">
            {/* Pure SVG Bar Chart Representing Mathematical SHAP-Like Array */}
            <div className="relative w-full h-10 rounded-md overflow-hidden bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-inner">
                <svg width="100%" height="100%" viewBox="0 0 100 10" preserveAspectRatio="none">
                    {/* Entire width 0-100 correlates to score 0.0 - 1.0 */}
                    {components.reduce((acc, c) => {
                        const start = acc.currentOffset;
                        const width = c.contribution * 100;
                        const nextOffset = start + width;
                        acc.elements.push(
                            <rect
                                key={c.key}
                                x={start}
                                y="0"
                                width={width}
                                height="10"
                                fill={COLORS[c.key]}
                                onMouseEnter={(e) => {
                                    setHoveredComponent(c.key);
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const wrapperRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                                    if (wrapperRect) {
                                        setHoverPos({ x: e.clientX - wrapperRect.left, y: rect.bottom - wrapperRect.top });
                                    }
                                }}
                                onMouseMove={(e) => {
                                    const wrapperRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                                    if (wrapperRect) {
                                        setHoverPos({ x: e.clientX - wrapperRect.left, y: e.clientY - wrapperRect.top + 15 });
                                    }
                                }}
                                onMouseLeave={() => setHoveredComponent(null)}
                                className="transition-all duration-300 hover:brightness-125 cursor-crosshair"
                            />
                        );
                        acc.currentOffset = nextOffset;
                        return acc;
                    }, { elements: [] as React.ReactNode[], currentOffset: 0 }).elements}

                    {/* Static Freeze Threshold Line matching backend limit */}
                    <line x1="65" y1="0" x2="65" y2="10" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="1,1" />
                </svg>

                <div
                    className="absolute top-0 bottom-0 border-l border-dashed border-[#ef4444] z-10 pointer-events-none"
                    style={{ left: `65%` }}
                >
                    <div className="absolute top-1 -left-1 text-[7px] uppercase tracking-widest font-black text-[#ef4444] whitespace-nowrap bg-[var(--color-bg-card)]/80 px-1 backdrop-blur-sm rounded">
                        THRESHOLD: 0.65
                    </div>
                </div>

                {/* Floating tooltip overlay to avoid layout shift */}
                <div 
                    className={`absolute z-50 pointer-events-none transition-opacity duration-200 whitespace-nowrap bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] p-3 rounded-md text-xs font-mono text-white shadow-xl ${hoveredComponent ? 'opacity-100' : 'opacity-0'}`}
                    style={{ 
                        left: hoverPos.x > 200 ? hoverPos.x - 220 + 'px' : hoverPos.x + 15 + 'px', 
                        top: Math.max(0, hoverPos.y - 50) + 'px' 
                    }}
                >
                    {hoveredComponent && (
                        <>
                            <span style={{ color: COLORS[hoveredComponent] }} className="font-bold uppercase mr-2">{LABELS[hoveredComponent]}:</span>
                            <span className="text-[var(--color-text-secondary)]">{components.find(c => c.key === hoveredComponent)?.reason}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto rounded border border-[var(--color-border-subtle)]">
                <table className="w-full text-left text-xs font-mono text-[var(--color-text-secondary)]">
                    <thead className="bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)] uppercase tracking-widest text-[9px]">
                        <tr>
                            <th className="px-3 py-2 text-white">Component</th>
                            <th className="px-3 py-2 min-w-[70px]">Weight</th>
                            <th className="px-3 py-2 min-w-[70px]">Raw Val</th>
                            <th className="px-3 py-2 min-w-[70px]">Contrib</th>
                            <th className="px-3 py-2 text-white font-bold min-w-[70px]">% Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-subtle)] bg-[var(--color-bg-card)]">
                        {components.map(c => {
                            const pct = totalContribution > 0 ? (c.contribution / totalContribution) * 100 : 0;
                            return (
                                <tr key={c.key} className="hover:bg-[var(--color-bg-primary)] transition-colors">
                                    <td className="px-3 py-2 font-bold text-white flex items-center gap-2 whitespace-nowrap">
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[c.key] }}></div>
                                        {LABELS[c.key]}
                                    </td>
                                    <td className="px-3 py-2">{(c.weight * 100).toFixed(0)}%</td>
                                    <td className="px-3 py-2 text-white">{c.value.toFixed(3)}</td>
                                    <td className="px-3 py-2 font-bold" style={{ color: COLORS[c.key] }}>{c.contribution.toFixed(4)}</td>
                                    <td className="px-3 py-2 text-white">{pct.toFixed(1)}%</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
