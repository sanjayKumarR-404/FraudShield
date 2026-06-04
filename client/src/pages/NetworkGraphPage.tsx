import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getAllTransactions, getTopRiskReceivers } from '../api/client';

interface Transaction {
    id: string;
    senderVpa: string;
    receiverVpa: string;
    amount: string;
    status: string;
    timestamp?: string;
    createdAt?: string;
}

interface ReceiverProfile {
    receiverVpa: string;
    riskCategory: string;
    riskScore: number;
    totalReceived: number;
    uniqueSendersLast24h: number;
}

interface GraphNode {
    id: string;
    vpa: string;
    isSender: boolean;
    txCount: number;
    totalAmount: number;
    riskCategory: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
}

interface GraphEdge {
    source: string;
    target: string;
    amount: number;
    status: string;
    timestamp: string;
}

interface PopupInfo {
    node: GraphNode;
    x: number;
    y: number;
}

const NODE_COLORS: Record<string, string> = {
    sender: '#3b82f6',
    SAFE: '#10b981',
    SUSPICIOUS: '#f59e0b',
    HIGH_RISK: '#f97316',
    FRAUD_MULE: '#ef4444',
    UNKNOWN: '#6b7280',
};

const REPULSION = 500;
const ATTRACTION = 0.05;
const DAMPING = 0.8;

function buildGraph(transactions: Transaction[], receiverProfiles: Map<string, ReceiverProfile>) {
    const nodeMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    const addOrUpdateNode = (vpa: string, isSender: boolean, amount: number) => {
        if (!nodeMap.has(vpa)) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 100 + Math.random() * 200;
            const rp = receiverProfiles.get(vpa);
            nodeMap.set(vpa, {
                id: vpa,
                vpa,
                isSender,
                txCount: 0,
                totalAmount: 0,
                riskCategory: isSender ? 'sender' : (rp?.riskCategory || 'UNKNOWN'),
                x: 400 + Math.cos(angle) * radius,
                y: 300 + Math.sin(angle) * radius,
                vx: 0,
                vy: 0,
            });
        }
        const node = nodeMap.get(vpa)!;
        node.txCount += 1;
        node.totalAmount += amount;
        if (!isSender) {
            const rp = receiverProfiles.get(vpa);
            if (rp) node.riskCategory = rp.riskCategory;
        }
    };

    for (const tx of transactions) {
        const amount = Number(tx.amount);
        addOrUpdateNode(tx.senderVpa, true, amount);
        addOrUpdateNode(tx.receiverVpa, false, amount);
        edges.push({
            source: tx.senderVpa,
            target: tx.receiverVpa,
            amount,
            status: tx.status,
            timestamp: (tx.createdAt || tx.timestamp || ''),
        });
    }

    return { nodes: Array.from(nodeMap.values()), edges };
}

function runSimulation(nodes: GraphNode[], edges: GraphEdge[], iterations = 100) {
    for (let iter = 0; iter < iterations; iter++) {
        // Repulsion between all pairs
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = REPULSION / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                nodes[i].vx += fx;
                nodes[i].vy += fy;
                nodes[j].vx -= fx;
                nodes[j].vy -= fy;
            }
        }

        // Attraction along edges
        for (const edge of edges) {
            const src = nodes.find(n => n.id === edge.source);
            const tgt = nodes.find(n => n.id === edge.target);
            if (!src || !tgt) continue;
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = dist * ATTRACTION;
            src.vx += (dx / dist) * force;
            src.vy += (dy / dist) * force;
            tgt.vx -= (dx / dist) * force;
            tgt.vy -= (dy / dist) * force;
        }

        // Apply velocity + damping
        for (const node of nodes) {
            node.vx *= DAMPING;
            node.vy *= DAMPING;
            node.x += node.vx;
            node.y += node.vy;
            // Bounds
            node.x = Math.max(40, Math.min(760, node.x));
            node.y = Math.max(40, Math.min(560, node.y));
        }
    }

    return nodes;
}

function detectFraudRings(_nodes: GraphNode[], edges: GraphEdge[]) {
    const now = Date.now();
    const since24h = now - 24 * 60 * 60 * 1000;
    const receiverSenders = new Map<string, Set<string>>();

    for (const edge of edges) {
        const ts = edge.timestamp ? new Date(edge.timestamp).getTime() : 0;
        if (ts < since24h) continue;
        if (!receiverSenders.has(edge.target)) receiverSenders.set(edge.target, new Set());
        receiverSenders.get(edge.target)!.add(edge.source);
    }

    const rings: Array<{ receiverVpa: string; senderCount: number }> = [];
    receiverSenders.forEach((senders, receiverVpa) => {
        if (senders.size >= 3) {
            rings.push({ receiverVpa, senderCount: senders.size });
        }
    });
    return rings;
}

export default function NetworkGraphPage() {
    const svgRef = useRef<SVGSVGElement>(null);
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [fraudRings, setFraudRings] = useState<Array<{ receiverVpa: string; senderCount: number }>>([]);
    const [popup, setPopup] = useState<PopupInfo | null>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [dragNode, setDragNode] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Filters
    const [showFrozenOnly, setShowFrozenOnly] = useState(false);
    const [showHighRiskOnly, setShowHighRiskOnly] = useState(false);
    const [minAmount, setMinAmount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const loadData = useCallback(async () => {
        try {
            const [txns, topRisk] = await Promise.all([
                getAllTransactions(),
                getTopRiskReceivers(),
            ]);

            const profileMap = new Map<string, ReceiverProfile>();
            topRisk.forEach((rp: ReceiverProfile) => profileMap.set(rp.receiverVpa, rp));

            const { nodes: rawNodes, edges: rawEdges } = buildGraph(txns, profileMap);
            const simulatedNodes = runSimulation(rawNodes, rawEdges, 100);
            const rings = detectFraudRings(simulatedNodes, rawEdges);

            setNodes([...simulatedNodes]);
            setEdges(rawEdges);
            setFraudRings(rings);
            setLastRefresh(new Date());
            setLoading(false);
        } catch (err) {
            console.error('Network graph load failed:', err);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, [loadData]);

    // Drag handlers
    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        setDragNode(nodeId);
        const node = nodes.find(n => n.id === nodeId);
        if (node && svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect();
            const scaleX = 800 / rect.width;
            const scaleY = 600 / rect.height;
            setDragOffset({
                x: e.clientX * scaleX - node.x,
                y: e.clientY * scaleY - node.y,
            });
        }
        setPopup(null);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragNode || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = 800 / rect.width;
        const scaleY = 600 / rect.height;
        const newX = Math.max(40, Math.min(760, e.clientX * scaleX - dragOffset.x));
        const newY = Math.max(40, Math.min(560, e.clientY * scaleY - dragOffset.y));
        setNodes(prev => prev.map(n => n.id === dragNode ? { ...n, x: newX, y: newY, vx: 0, vy: 0 } : n));
    };

    const handleMouseUp = () => setDragNode(null);

    const handleNodeClick = (e: React.MouseEvent, node: GraphNode) => {
        if (dragNode) return;
        e.stopPropagation();
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = rect.width / 800;
        const scaleY = rect.height / 600;
        setPopup({ node, x: node.x * scaleX + rect.left, y: node.y * scaleY + rect.top });
    };

    const resetLayout = () => {
        setNodes(prev => {
            const reset = prev.map(n => ({
                ...n,
                x: 400 + (Math.random() - 0.5) * 400,
                y: 300 + (Math.random() - 0.5) * 300,
                vx: 0, vy: 0,
            }));
            return runSimulation(reset, edges, 80);
        });
    };

    // Filter edges
    const visibleEdges = edges.filter(e => {
        if (showFrozenOnly && e.status !== 'FROZEN') return false;
        if (e.amount < minAmount) return false;
        return true;
    });

    const visibleNodeIds = new Set<string>();
    visibleEdges.forEach(e => { visibleNodeIds.add(e.source); visibleNodeIds.add(e.target); });

    const visibleNodes = showHighRiskOnly
        ? nodes.filter(n => ['HIGH_RISK', 'FRAUD_MULE'].includes(n.riskCategory) || n.isSender)
        : nodes.filter(n => !showFrozenOnly || visibleNodeIds.has(n.id));

    const maxTxCount = Math.max(...nodes.map(n => n.txCount), 1);
    const maxAmount = Math.max(...edges.map(e => e.amount), 1);

    const getNodeRadius = (n: GraphNode) => 10 + (n.txCount / maxTxCount) * 20;
    const getEdgeWidth = (e: GraphEdge) => 1 + (e.amount / maxAmount) * 4;

    return (
        <div className="flex flex-col h-screen bg-[var(--color-bg-primary)] overflow-hidden">
            {/* Header */}
            <header className="bg-[var(--color-bg-card)] border-b border-[var(--color-border)] px-6 py-3.5 flex justify-between items-center z-10 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--color-accent)] to-purple-500 flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">Fraud Network Graph</h1>
                        <p className="text-[10px] text-[var(--color-text-muted)] font-mono">Live transaction topology — {nodes.length} nodes, {edges.length} edges</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                        Last: {lastRefresh.toLocaleTimeString([], { hour12: false })}
                    </span>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--color-success)]/30 bg-[var(--color-success)]/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-ping" />
                        <span className="text-[9px] font-bold text-[var(--color-success)] uppercase tracking-widest">Live</span>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
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

                    <svg
                        ref={svgRef}
                        viewBox="0 0 800 600"
                        className="w-full h-full cursor-grab active:cursor-grabbing"
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onClick={() => { setPopup(null); setHoveredNode(null); }}
                    >
                        <defs>
                            <radialGradient id="bg-grad" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="var(--color-bg-elevated)" stopOpacity="1" />
                                <stop offset="100%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
                            </radialGradient>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                        </defs>

                        <rect width="800" height="600" fill="url(#bg-grad)" />

                        {/* Grid */}
                        {Array.from({ length: 20 }).map((_, i) => (
                            <line key={`h${i}`} x1={0} y1={i * 30} x2={800} y2={i * 30} stroke="var(--color-border)" strokeOpacity="0.2" strokeWidth="0.5" />
                        ))}
                        {Array.from({ length: 27 }).map((_, i) => (
                            <line key={`v${i}`} x1={i * 30} y1={0} x2={i * 30} y2={600} stroke="var(--color-border)" strokeOpacity="0.2" strokeWidth="0.5" />
                        ))}

                        {/* Fraud Ring Circles */}
                        {fraudRings.map((ring) => {
                            const node = nodes.find(n => n.id === ring.receiverVpa);
                            if (!node) return null;
                            return (
                                <g key={ring.receiverVpa}>
                                    <circle
                                        cx={node.x} cy={node.y} r={getNodeRadius(node) + 22}
                                        fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="6 3"
                                        className="fraud-ring-pulse" strokeOpacity="0.7"
                                        filter="url(#glow)"
                                    />
                                    <text x={node.x} y={node.y - getNodeRadius(node) - 28} textAnchor="middle" fill="#ef4444" fontSize="7" fontWeight="bold">
                                        ⚠ SUSPECTED FRAUD RING — {ring.senderCount} SOURCES
                                    </text>
                                </g>
                            );
                        })}

                        {/* Edges */}
                        {visibleEdges.map((edge, i) => {
                            const src = nodes.find(n => n.id === edge.source);
                            const tgt = nodes.find(n => n.id === edge.target);
                            if (!src || !tgt) return null;
                            const isHighlighted = hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode);
                            const color = edge.status === 'FROZEN' ? '#ef4444' : '#10b981';
                            return (
                                <line key={i}
                                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                                    stroke={color}
                                    strokeWidth={isHighlighted ? getEdgeWidth(edge) + 1 : getEdgeWidth(edge)}
                                    strokeOpacity={isHighlighted ? 0.9 : hoveredNode ? 0.15 : 0.4}
                                    strokeLinecap="round"
                                />
                            );
                        })}

                        {/* Nodes */}
                        {visibleNodes.map((node) => {
                            const color = node.isSender ? NODE_COLORS.sender : (NODE_COLORS[node.riskCategory] || NODE_COLORS.UNKNOWN);
                            const r = getNodeRadius(node);
                            const isHovered = hoveredNode === node.id;
                            return (
                                <g
                                    key={node.id}
                                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                                    onClick={(e) => handleNodeClick(e, node)}
                                    onMouseEnter={() => setHoveredNode(node.id)}
                                    onMouseLeave={() => setHoveredNode(null)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {/* Glow ring on hover */}
                                    {isHovered && (
                                        <circle cx={node.x} cy={node.y} r={r + 6} fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
                                    )}
                                    <circle
                                        cx={node.x} cy={node.y} r={r}
                                        fill={color} fillOpacity={isHovered ? 0.9 : 0.7}
                                        stroke={color} strokeWidth={isHovered ? 2.5 : 1.5}
                                        filter={node.riskCategory === 'FRAUD_MULE' ? "url(#glow)" : undefined}
                                    />
                                    <text
                                        x={node.x} y={node.y + 3}
                                        textAnchor="middle"
                                        fill="white"
                                        fontSize={Math.max(5, Math.min(8, r * 0.5))}
                                        fontWeight="bold"
                                        style={{ pointerEvents: 'none' }}
                                    >
                                        {node.vpa.split('@')[0].substring(0, 6)}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>

                    {/* Legend */}
                    <div className="absolute bottom-4 left-4 bg-[var(--color-bg-card)]/90 backdrop-blur-md border border-[var(--color-border)] rounded-xl p-3 text-[9px] font-bold uppercase tracking-widest space-y-1.5">
                        <p className="text-[var(--color-text-muted)] mb-2">Legend</p>
                        {[
                            { color: '#3b82f6', label: 'Sender (User)' },
                            { color: '#10b981', label: 'Safe Receiver' },
                            { color: '#f59e0b', label: 'Suspicious' },
                            { color: '#f97316', label: 'High Risk' },
                            { color: '#ef4444', label: 'Fraud Mule' },
                        ].map(item => (
                            <div key={item.label} className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-[var(--color-text-secondary)]">{item.label}</span>
                            </div>
                        ))}
                        <div className="border-t border-[var(--color-border)] pt-1.5 mt-1.5 space-y-1">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-0.5 bg-[#10b981] rounded" />
                                <span className="text-[var(--color-text-muted)]">Success Edge</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-0.5 bg-[#ef4444] rounded" />
                                <span className="text-[var(--color-text-muted)]">Frozen Edge</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls Panel */}
                <div className="w-60 bg-[var(--color-bg-card)] border-l border-[var(--color-border)] p-4 flex flex-col gap-4 flex-shrink-0 overflow-y-auto">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Graph Controls</p>
                        <div className="space-y-3">
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Frozen only</span>
                                <div
                                    onClick={() => setShowFrozenOnly(!showFrozenOnly)}
                                    className={`w-9 h-5 rounded-full transition-colors cursor-pointer ${showFrozenOnly ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-bg-elevated)]'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full m-0.5 transition-transform ${showFrozenOnly ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </label>
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">High risk only</span>
                                <div
                                    onClick={() => setShowHighRiskOnly(!showHighRiskOnly)}
                                    className={`w-9 h-5 rounded-full transition-colors cursor-pointer ${showHighRiskOnly ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-bg-elevated)]'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full m-0.5 transition-transform ${showHighRiskOnly ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </label>
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Min Amount ₹</p>
                        <input
                            type="range" min={0} max={100000} step={1000}
                            value={minAmount}
                            onChange={e => setMinAmount(Number(e.target.value))}
                            className="w-full accent-[var(--color-accent)]"
                        />
                        <p className="text-[10px] font-mono text-[var(--color-accent)] mt-1">₹{minAmount.toLocaleString('en-IN')}</p>
                    </div>

                    <div className="space-y-2">
                        <button
                            onClick={resetLayout}
                            className="w-full text-[10px] font-bold uppercase tracking-widest py-2 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-accent)] transition-all"
                        >
                            ↺ Reset Layout
                        </button>
                        <button
                            onClick={loadData}
                            className="w-full text-[10px] font-bold uppercase tracking-widest py-2 rounded bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-all"
                        >
                            ⟳ Refresh Data
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="border-t border-[var(--color-border)] pt-4 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Stats</p>
                        {[
                            { label: 'Total Nodes', value: nodes.length },
                            { label: 'Total Edges', value: edges.length },
                            { label: 'Frozen Edges', value: edges.filter(e => e.status === 'FROZEN').length },
                            { label: 'Fraud Rings', value: fraudRings.length },
                        ].map(stat => (
                            <div key={stat.label} className="flex justify-between items-center">
                                <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">{stat.label}</span>
                                <span className="text-sm font-mono font-bold text-[var(--color-text-primary)]">{stat.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Fraud Rings Panel */}
                    {fraudRings.length > 0 && (
                        <div className="border-t border-[var(--color-danger)]/30 pt-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-danger)] mb-2">⚠ Fraud Rings Detected</p>
                            {fraudRings.map(ring => (
                                <div key={ring.receiverVpa} className="p-2 rounded bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 mb-2">
                                    <p className="text-[9px] font-mono text-[var(--color-danger)] truncate">{ring.receiverVpa}</p>
                                    <p className="text-[8px] text-[var(--color-text-muted)] mt-0.5">{ring.senderCount} unique senders (24h)</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Node Popup */}
            {popup && (
                <div
                    className="fixed z-50 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-4 shadow-2xl w-64 animate-in fade-in zoom-in-95 duration-150"
                    style={{ left: Math.min(popup.x + 10, window.innerWidth - 270), top: Math.min(popup.y - 10, window.innerHeight - 200) }}
                >
                    <div className="flex justify-between items-start mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Node Inspector</p>
                        <button onClick={() => setPopup(null)} className="text-[var(--color-text-muted)] hover:text-white text-xs">✕</button>
                    </div>
                    <p className="text-xs font-mono text-[var(--color-text-primary)] mb-3 break-all">{popup.node.vpa}</p>
                    <div className="space-y-1.5 text-[10px]">
                        <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">Role</span>
                            <span className="font-bold text-[var(--color-accent)]">{popup.node.isSender ? 'SENDER' : 'RECEIVER'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">Risk Category</span>
                            <span className="font-bold" style={{ color: NODE_COLORS[popup.node.riskCategory] || '#6b7280' }}>
                                {popup.node.riskCategory}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">Transactions</span>
                            <span className="font-bold text-[var(--color-text-primary)]">{popup.node.txCount}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">Total Amount</span>
                            <span className="font-bold text-[var(--color-text-primary)]">₹{popup.node.totalAmount.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
