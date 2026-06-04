import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getAllTransactions, getTopRiskReceivers, getReceiverProfile } from '../api/client';

interface Transaction {
    id: string; senderVpa: string; receiverVpa: string;
    amount: string; status: string; timestamp?: string; createdAt?: string;
}

interface ReceiverProfile {
    receiverVpa: string; riskCategory: string; riskScore: number;
    totalReceived: number; uniqueSendersLast24h: number; fraudRate?: number;
}

interface GraphNode {
    id: string; vpa: string; isSender: boolean; txCount: number;
    totalAmount: number; riskCategory: string; x: number; y: number; vx: number; vy: number;
}

interface GraphEdge {
    source: string; target: string; amount: number; status: string; timestamp: string;
}

const NODE_COLORS: Record<string, string> = {
    sender: '#3b82f6', SAFE: '#10b981', SUSPICIOUS: '#f59e0b',
    HIGH_RISK: '#f97316', FRAUD_MULE: '#ef4444', UNKNOWN: '#6b7280',
};

const RISK_CATEGORY_ORDER = ['FRAUD_MULE', 'HIGH_RISK', 'SUSPICIOUS', 'SAFE', 'UNKNOWN'];

const REPULSION = 500; const ATTRACTION = 0.05; const DAMPING = 0.8;

function truncateVpa(vpa: string) {
    const [user, domain] = vpa.split('@');
    if (!domain) return vpa.substring(0, 10) + (vpa.length > 10 ? '…' : '');
    const userPart = user.length > 6 ? user.substring(0, 6) + '…' : user;
    const domPart = domain.length > 4 ? domain.substring(0, 4) : domain;
    return `${userPart}@${domPart}`;
}

function buildGraph(txns: Transaction[], profileMap: Map<string, ReceiverProfile>, daysFilter: number) {
    const nodeMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const cutoff = daysFilter === 0 ? 0 : Date.now() - daysFilter * 24 * 60 * 60 * 1000;

    for (const tx of txns) {
        const ts = new Date(tx.createdAt || tx.timestamp || '').getTime();
        if (cutoff > 0 && ts < cutoff) continue;
        const amount = Number(tx.amount);
        const ensure = (vpa: string, isSender: boolean) => {
            if (!nodeMap.has(vpa)) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 80 + Math.random() * 200;
                const rp = profileMap.get(vpa);
                nodeMap.set(vpa, {
                    id: vpa, vpa, isSender, txCount: 0, totalAmount: 0,
                    riskCategory: isSender ? 'sender' : (rp?.riskCategory || 'UNKNOWN'),
                    x: 400 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius, vx: 0, vy: 0,
                });
            }
            const n = nodeMap.get(vpa)!;
            n.txCount += 1; n.totalAmount += amount;
            if (!isSender) { const rp = profileMap.get(vpa); if (rp) n.riskCategory = rp.riskCategory; }
        };
        ensure(tx.senderVpa, true);
        ensure(tx.receiverVpa, false);
        edges.push({ source: tx.senderVpa, target: tx.receiverVpa, amount, status: tx.status, timestamp: tx.createdAt || tx.timestamp || '' });
    }
    return { nodes: Array.from(nodeMap.values()), edges };
}

function runSimulation(nodes: GraphNode[], edges: GraphEdge[], iterations = 80) {
    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x; const dy = nodes[i].y - nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const f = REPULSION / (dist * dist);
                nodes[i].vx += dx / dist * f; nodes[i].vy += dy / dist * f;
                nodes[j].vx -= dx / dist * f; nodes[j].vy -= dy / dist * f;
            }
        }
        for (const edge of edges) {
            const src = nodes.find(n => n.id === edge.source);
            const tgt = nodes.find(n => n.id === edge.target);
            if (!src || !tgt) continue;
            const dx = tgt.x - src.x; const dy = tgt.y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const f = dist * ATTRACTION;
            src.vx += dx / dist * f; src.vy += dy / dist * f;
            tgt.vx -= dx / dist * f; tgt.vy -= dy / dist * f;
        }
        for (const n of nodes) {
            n.vx *= DAMPING; n.vy *= DAMPING;
            n.x = Math.max(40, Math.min(760, n.x + n.vx));
            n.y = Math.max(40, Math.min(560, n.y + n.vy));
        }
    }
    return nodes;
}

function detectFraudRings(_nodes: GraphNode[], edges: GraphEdge[]) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const map = new Map<string, Set<string>>();
    for (const e of edges) {
        const ts = e.timestamp ? new Date(e.timestamp).getTime() : 0;
        if (ts < cutoff) continue;
        if (!map.has(e.target)) map.set(e.target, new Set());
        map.get(e.target)!.add(e.source);
    }
    const rings: { receiverVpa: string; senderCount: number }[] = [];
    map.forEach((senders, vpa) => { if (senders.size >= 3) rings.push({ receiverVpa: vpa, senderCount: senders.size }); });
    return rings;
}

const TIME_RANGES = [{ label: '24h', days: 1 }, { label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: 'All', days: 0 }];

export default function NetworkGraphPage() {
    const svgRef = useRef<SVGSVGElement>(null);
    const [allNodes, setAllNodes] = useState<GraphNode[]>([]);
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [fraudRings, setFraudRings] = useState<{ receiverVpa: string; senderCount: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    // Filters
    const [selectedRisks, setSelectedRisks] = useState<Set<string>>(new Set(['FRAUD_MULE', 'HIGH_RISK', 'SUSPICIOUS', 'SAFE', 'UNKNOWN', 'sender']));
    const [minAmount, setMinAmount] = useState(0);
    const [timeRange, setTimeRange] = useState(0); // days; 0 = all
    const [showFraudRings, setShowFraudRings] = useState(true);
    const [showNodeLabels, setShowNodeLabels] = useState(true);
    const [showEdgeLabels, setShowEdgeLabels] = useState(false);
    const [viewMode, setViewMode] = useState<'risk' | 'density'>('risk');

    // Interaction
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
    const [dragNode, setDragNode] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [detailProfile, setDetailProfile] = useState<any>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [txns, topRisk] = await Promise.all([getAllTransactions(), getTopRiskReceivers()]);
            const profileMap = new Map<string, ReceiverProfile>();
            topRisk.forEach((rp: ReceiverProfile) => profileMap.set(rp.receiverVpa, rp));
            const { nodes: raw, edges: rawEdges } = buildGraph(txns, profileMap, timeRange);
            const simulated = runSimulation(raw, rawEdges, 100);
            const rings = detectFraudRings(simulated, rawEdges);
            setAllNodes([...simulated]); setNodes([...simulated]);
            setEdges(rawEdges); setFraudRings(rings);
            setLastRefresh(new Date());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [timeRange]);

    useEffect(() => { loadData(); const iv = setInterval(loadData, 30000); return () => clearInterval(iv); }, [loadData]);

    // Load receiver detail when node selected
    useEffect(() => {
        if (!selectedNode || selectedNode.isSender) { setDetailProfile(null); return; }
        getReceiverProfile(selectedNode.vpa).then(setDetailProfile).catch(() => setDetailProfile(null));
    }, [selectedNode]);

    const riskCounts = RISK_CATEGORY_ORDER.reduce((acc, cat) => {
        acc[cat] = allNodes.filter(n => n.riskCategory === cat).length;
        return acc;
    }, {} as Record<string, number>);

    const filteredEdges = edges.filter(e => e.amount >= minAmount);
    const visibleNodeIds = new Set<string>();
    filteredEdges.forEach(e => { visibleNodeIds.add(e.source); visibleNodeIds.add(e.target); });
    const visibleNodes = nodes.filter(n => selectedRisks.has(n.riskCategory) && (filteredEdges.length === 0 || visibleNodeIds.has(n.id)));

    const maxTxCount = Math.max(...nodes.map(n => n.txCount), 1);
    const maxAmount = Math.max(...edges.map(e => e.amount), 1);
    const getR = (n: GraphNode) => Math.max(10, Math.min(40, 10 + (n.txCount / maxTxCount) * 30));
    const getEW = (e: GraphEdge) => Math.max(1, Math.min(5, 1 + Math.log(e.amount + 1) / Math.log(maxAmount + 1) * 4));

    const getDensityColor = (n: GraphNode) => {
        if (n.isSender) return '#3b82f6';
        const ratio = n.txCount / maxTxCount;
        const r = Math.round(16 + ratio * (239 - 16));
        const g = Math.round(185 - ratio * (185 - 68));
        const b = Math.round(129 - ratio * (129 - 68));
        return `rgb(${r},${g},${b})`;
    };

    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        setDragNode(nodeId);
        const node = nodes.find(n => n.id === nodeId);
        if (node && svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect();
            setDragOffset({ x: e.clientX * (800 / rect.width) - node.x, y: e.clientY * (600 / rect.height) - node.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragNode || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const nx = Math.max(40, Math.min(760, e.clientX * (800 / rect.width) - dragOffset.x));
        const ny = Math.max(40, Math.min(560, e.clientY * (600 / rect.height) - dragOffset.y));
        setNodes(prev => prev.map(n => n.id === dragNode ? { ...n, x: nx, y: ny, vx: 0, vy: 0 } : n));
    };

    const handleNodeClick = (e: React.MouseEvent, node: GraphNode) => {
        if (dragNode) return;
        e.stopPropagation();
        setSelectedNode(prev => prev?.id === node.id ? null : node);
    };

    return (
        <div className="flex flex-col h-screen bg-[var(--color-bg-primary)] overflow-hidden">
            {/* Header */}
            <header className="bg-[var(--color-bg-card)] border-b border-[var(--color-border)] px-6 py-3 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--color-accent)] to-purple-500 flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">Fraud Network Graph</h1>
                        <p className="text-[10px] text-[var(--color-text-muted)] font-mono">{visibleNodes.length} nodes · {filteredEdges.length} edges · Last: {lastRefresh.toLocaleTimeString([], { hour12: false })}</p>
                    </div>
                </div>
                {/* Risk Distribution Stats */}
                <div className="hidden lg:flex items-center gap-2">
                    {RISK_CATEGORY_ORDER.map(cat => (
                        <div key={cat} className="flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-bold uppercase tracking-widest" style={{ borderColor: `${NODE_COLORS[cat]}40`, color: NODE_COLORS[cat], backgroundColor: `${NODE_COLORS[cat]}10` }}>
                            <span>{cat.replace('_', ' ')}</span>
                            <span className="font-mono">{riskCounts[cat] || 0}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-1 px-2 py-1 rounded border border-[var(--color-success)]/30 bg-[var(--color-success)]/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-ping" />
                        <span className="text-[9px] font-bold text-[var(--color-success)] uppercase tracking-widest">Live</span>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* SVG Graph */}
                <div className="flex-1 relative">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center z-20">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                                <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Loading graph...</p>
                            </div>
                        </div>
                    )}
                    <svg ref={svgRef} viewBox="0 0 800 600" className="w-full h-full cursor-grab active:cursor-grabbing"
                        onMouseMove={handleMouseMove} onMouseUp={() => setDragNode(null)}
                        onMouseLeave={() => setDragNode(null)}
                        onClick={() => { setSelectedNode(null); setHoveredNode(null); }}>
                        <defs>
                            <radialGradient id="bg-grad" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="var(--color-bg-elevated)" />
                                <stop offset="100%" stopColor="var(--color-bg-primary)" />
                            </radialGradient>
                            <filter id="glow"><feGaussianBlur stdDeviation="3" result="cb" /><feMerge><feMergeNode in="cb" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                        </defs>
                        <rect width="800" height="600" fill="url(#bg-grad)" />
                        {/* Grid */}
                        {Array.from({ length: 20 }).map((_, i) => <line key={`h${i}`} x1={0} y1={i * 30} x2={800} y2={i * 30} stroke="var(--color-border)" strokeOpacity="0.15" strokeWidth="0.5" />)}
                        {Array.from({ length: 27 }).map((_, i) => <line key={`v${i}`} x1={i * 30} y1={0} x2={i * 30} y2={600} stroke="var(--color-border)" strokeOpacity="0.15" strokeWidth="0.5" />)}

                        {/* Fraud Rings */}
                        {showFraudRings && fraudRings.map(ring => {
                            const n = nodes.find(nd => nd.id === ring.receiverVpa);
                            if (!n) return null;
                            const r = getR(n) + 22;
                            return (
                                <g key={ring.receiverVpa}>
                                    <circle cx={n.x} cy={n.y} r={r} fill="none" stroke="url(#ring-grad)" strokeWidth="2"
                                        strokeDasharray="6 3" className="fraud-ring-pulse" strokeOpacity="0.8" filter="url(#glow)" />
                                    <defs>
                                        <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#ef4444" /><stop offset="100%" stopColor="#f97316" />
                                        </linearGradient>
                                    </defs>
                                    <text x={n.x} y={n.y - r - 6} textAnchor="middle" fill="#ef4444" fontSize="7" fontWeight="bold">
                                        ⚠ FRAUD RING — {ring.senderCount} senders
                                    </text>
                                </g>
                            );
                        })}

                        {/* Edges */}
                        {filteredEdges.map((edge, i) => {
                            const src = nodes.find(n => n.id === edge.source);
                            const tgt = nodes.find(n => n.id === edge.target);
                            if (!src || !tgt) return null;
                            const isH = hoveredEdge === i || hoveredNode === edge.source || hoveredNode === edge.target;
                            const color = edge.status === 'FROZEN' ? '#ef4444' : '#10b981';
                            const ew = getEW(edge);
                            const mx = (src.x + tgt.x) / 2; const my = (src.y + tgt.y) / 2;
                            return (
                                <g key={i} onMouseEnter={() => setHoveredEdge(i)} onMouseLeave={() => setHoveredEdge(null)}>
                                    <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                                        stroke={color} strokeWidth={isH ? ew + 1.5 : ew}
                                        strokeOpacity={isH ? 0.9 : hoveredNode ? 0.12 : 0.35} strokeLinecap="round" />
                                    {showEdgeLabels && ew > 2 && (
                                        <text x={mx} y={my - 4} textAnchor="middle" fill={color} fontSize="7" fontWeight="bold" fillOpacity="0.7">
                                            ₹{edge.amount >= 1000 ? `${(edge.amount / 1000).toFixed(0)}k` : edge.amount}
                                        </text>
                                    )}
                                </g>
                            );
                        })}

                        {/* Nodes */}
                        {visibleNodes.map(node => {
                            const color = viewMode === 'density' ? getDensityColor(node) : (node.isSender ? NODE_COLORS.sender : (NODE_COLORS[node.riskCategory] || NODE_COLORS.UNKNOWN));
                            const r = getR(node);
                            const isH = hoveredNode === node.id;
                            const isSel = selectedNode?.id === node.id;
                            return (
                                <g key={node.id}
                                    onMouseDown={e => handleNodeMouseDown(e, node.id)}
                                    onClick={e => handleNodeClick(e, node)}
                                    onMouseEnter={() => setHoveredNode(node.id)}
                                    onMouseLeave={() => setHoveredNode(null)}
                                    style={{ cursor: 'pointer' }}>
                                    {(isH || isSel) && <circle cx={node.x} cy={node.y} r={r + 7} fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />}
                                    {isSel && <circle cx={node.x} cy={node.y} r={r + 12} fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 2" strokeOpacity="0.6" />}
                                    <circle cx={node.x} cy={node.y} r={r}
                                        fill={color} fillOpacity={isH ? 0.9 : 0.7}
                                        stroke={color} strokeWidth={isH || isSel ? 2.5 : 1.5}
                                        filter={node.riskCategory === 'FRAUD_MULE' ? 'url(#glow)' : undefined} />
                                    {/* Node label */}
                                    {showNodeLabels && r >= 12 && (
                                        <text x={node.x} y={node.y + r + 11} textAnchor="middle"
                                            fill="var(--color-text-muted)" fontSize={Math.max(6, Math.min(9, r * 0.35))} fontWeight="600">
                                            {truncateVpa(node.vpa)}
                                        </text>
                                    )}
                                    {/* Short label inside */}
                                    <text x={node.x} y={node.y + 3} textAnchor="middle" fill="white"
                                        fontSize={Math.max(5, Math.min(8, r * 0.45))} fontWeight="bold" style={{ pointerEvents: 'none' }}>
                                        {node.vpa.split('@')[0].substring(0, 4)}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>

                    {/* Legend */}
                    <div className="absolute bottom-4 left-4 bg-[var(--color-bg-card)]/90 backdrop-blur-md border border-[var(--color-border)] rounded-xl p-3 text-[9px] font-bold uppercase tracking-widest space-y-1.5">
                        <p className="text-[var(--color-text-muted)] mb-2">Legend</p>
                        {[{ color: '#3b82f6', label: 'Sender' }, { color: '#10b981', label: 'Safe' }, { color: '#f59e0b', label: 'Suspicious' }, { color: '#f97316', label: 'High Risk' }, { color: '#ef4444', label: 'Mule' }].map(item => (
                            <div key={item.label} className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-[var(--color-text-secondary)]">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Controls Panel */}
                <div className="w-64 bg-[var(--color-bg-card)] border-l border-[var(--color-border)] flex flex-col flex-shrink-0 overflow-y-auto">
                    {/* Selected Node Detail Panel */}
                    {selectedNode && (
                        <div className="border-b border-[var(--color-border)] p-4 bg-[var(--color-bg-elevated)]/50">
                            <div className="flex justify-between items-start mb-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-accent)]">Node Inspector</p>
                                <button onClick={() => setSelectedNode(null)} className="text-[var(--color-text-muted)] hover:text-white text-xs">✕</button>
                            </div>
                            <p className="text-[9px] font-mono text-[var(--color-text-primary)] break-all mb-3">{selectedNode.vpa}</p>
                            <div className="space-y-1.5 text-[10px]">
                                {[
                                    { label: 'Role', value: selectedNode.isSender ? 'SENDER' : 'RECEIVER', color: selectedNode.isSender ? '#3b82f6' : undefined },
                                    { label: 'Risk', value: selectedNode.riskCategory, color: NODE_COLORS[selectedNode.riskCategory] },
                                    { label: 'Transactions', value: selectedNode.txCount },
                                    { label: 'Total Amount', value: `₹${selectedNode.totalAmount.toLocaleString('en-IN')}` },
                                ].map(r => (
                                    <div key={r.label} className="flex justify-between">
                                        <span className="text-[var(--color-text-muted)]">{r.label}</span>
                                        <span className="font-bold" style={{ color: r.color || 'var(--color-text-primary)' }}>{r.value}</span>
                                    </div>
                                ))}
                                {detailProfile && (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-[var(--color-text-muted)]">Fraud Rate</span>
                                            <span className={`font-bold ${detailProfile.fraudRate > 0.5 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>{(detailProfile.fraudRate * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[var(--color-text-muted)]">Senders 24h</span>
                                            <span className="font-bold text-[var(--color-text-primary)]">{detailProfile.uniqueSendersLast24h}</span>
                                        </div>
                                    </>
                                )}
                                {!selectedNode.isSender && (
                                    <a href={`/receivers`} className="block mt-2 text-center text-[9px] font-bold uppercase tracking-widest py-1.5 rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-all">
                                        View Full Profile →
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="p-4 space-y-4 flex-1">
                        {/* Risk filter */}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Risk Filter</p>
                            <div className="space-y-1">
                                {[...RISK_CATEGORY_ORDER, 'sender'].map(cat => (
                                    <label key={cat} className="flex items-center gap-2 cursor-pointer">
                                        <div className="w-4 h-4 rounded flex items-center justify-center border transition-colors"
                                            style={{ borderColor: NODE_COLORS[cat] || '#6b7280', backgroundColor: selectedRisks.has(cat) ? `${NODE_COLORS[cat] || '#6b7280'}30` : 'transparent' }}
                                            onClick={() => setSelectedRisks(prev => {
                                                const n = new Set(prev);
                                                n.has(cat) ? n.delete(cat) : n.add(cat);
                                                return n;
                                            })}>
                                            {selectedRisks.has(cat) && <span style={{ color: NODE_COLORS[cat] || '#6b7280', fontSize: 10, fontWeight: 900 }}>✓</span>}
                                        </div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: NODE_COLORS[cat] || '#6b7280' }}>{cat.replace('_', ' ')}</span>
                                        <span className="ml-auto text-[9px] font-mono text-[var(--color-text-muted)]">{riskCounts[cat] || (cat === 'sender' ? nodes.filter(n => n.isSender).length : 0)}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Amount filter */}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Min Amount ₹</p>
                            <input type="range" min={0} max={100000} step={1000} value={minAmount}
                                onChange={e => setMinAmount(Number(e.target.value))}
                                className="w-full accent-[var(--color-accent)]" />
                            <p className="text-[10px] font-mono text-[var(--color-accent)] mt-1">₹{minAmount.toLocaleString('en-IN')}</p>
                        </div>

                        {/* Time range */}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Time Range</p>
                            <div className="flex gap-1 flex-wrap">
                                {TIME_RANGES.map(tr => (
                                    <button key={tr.label}
                                        onClick={() => setTimeRange(tr.days)}
                                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded border transition-all ${timeRange === tr.days ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white'}`}>
                                        {tr.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* View mode */}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">View Mode</p>
                            {['risk', 'density'].map(mode => (
                                <label key={mode} className="flex items-center gap-2 cursor-pointer mb-1">
                                    <div className={`w-3 h-3 rounded-full border-2 transition-colors ${viewMode === mode ? 'border-[var(--color-accent)] bg-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}
                                        onClick={() => setViewMode(mode as 'risk' | 'density')} />
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">{mode === 'risk' ? 'Risk Category' : 'Fraud Density'}</span>
                                </label>
                            ))}
                        </div>

                        {/* Show toggles */}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Show</p>
                            {[
                                { key: 'rings', label: 'Fraud Rings', val: showFraudRings, set: setShowFraudRings },
                                { key: 'labels', label: 'Node Labels', val: showNodeLabels, set: setShowNodeLabels },
                                { key: 'elabels', label: 'Edge Labels', val: showEdgeLabels, set: setShowEdgeLabels },
                            ].map(({ key, label, val, set }) => (
                                <label key={key} className="flex items-center justify-between cursor-pointer mb-2">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</span>
                                    <div onClick={() => set(!val)} className={`w-8 h-4 rounded-full transition-colors cursor-pointer ${val ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-elevated)]'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full m-0.5 transition-transform ${val ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                </label>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                            <button onClick={() => setNodes(prev => runSimulation(prev.map(n => ({ ...n, x: 400 + (Math.random() - 0.5) * 500, y: 300 + (Math.random() - 0.5) * 400, vx: 0, vy: 0 })), edges, 80))}
                                className="w-full text-[10px] font-bold uppercase tracking-widest py-2 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-accent)] transition-all">
                                ↺ Reset Layout
                            </button>
                            <button onClick={loadData}
                                className="w-full text-[10px] font-bold uppercase tracking-widest py-2 rounded bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-all">
                                ⟳ Refresh
                            </button>
                        </div>

                        {/* Fraud ring alerts */}
                        {fraudRings.length > 0 && (
                            <div className="border-t border-[var(--color-danger)]/30 pt-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-danger)] mb-2">⚠ Fraud Rings ({fraudRings.length})</p>
                                {fraudRings.map(ring => (
                                    <div key={ring.receiverVpa} className="p-2 rounded bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 mb-2"
                                        onClick={() => { const n = nodes.find(nd => nd.id === ring.receiverVpa); if (n) setSelectedNode(n); }}>
                                        <p className="text-[9px] font-mono text-[var(--color-danger)] truncate">{ring.receiverVpa}</p>
                                        <p className="text-[8px] text-[var(--color-text-muted)]">{ring.senderCount} senders (24h)</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
