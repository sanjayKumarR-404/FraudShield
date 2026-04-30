import React from 'react';
import { NavLink } from 'react-router-dom';

const GridIcon = () => (<svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>);
const ChartIcon = () => (<svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>);
const ShieldIcon = () => (<svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);

export default function Sidebar({ expanded, setExpanded }: { expanded: boolean, setExpanded: React.Dispatch<React.SetStateAction<boolean>> }) {
    return (
        <aside className={`relative top-0 left-0 bg-[var(--color-bg-card)] border-r border-[var(--color-border)] h-screen transition-all duration-300 z-50 flex-col ${expanded ? 'w-[220px]' : 'w-16'} hidden md:flex`}>
            {/* Logo */}
            <div className="h-[60px] flex items-center justify-center border-b border-[var(--color-border)] overflow-hidden">
                <div className="w-8 h-8 rounded-lg min-w-[32px] bg-gradient-to-tr from-[var(--color-accent)] to-[#60a5fa] flex items-center justify-center font-black text-white shadow-lg">
                    F
                </div>
                {expanded && <h1 className="ml-3 text-lg font-bold text-white tracking-tight absolute left-14 whitespace-nowrap animate-in fade-in">FraudShield</h1>}
            </div>

            <nav className="flex-1 mt-6 flex flex-col gap-2 px-3 relative">
                <NavLink to="/dashboard" className={({ isActive }) => `flex items-center gap-4 px-2.5 py-2.5 rounded-lg transition-colors group relative ${isActive ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-white'}`}>
                    <GridIcon />
                    {expanded && <span className="font-semibold text-sm whitespace-nowrap absolute left-10">Dashboard</span>}
                    {!expanded && <div className="absolute left-14 bg-[var(--color-bg-elevated)] text-white text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Dashboard</div>}
                </NavLink>
                <NavLink to="/analytics" className={({ isActive }) => `flex items-center gap-4 px-2.5 py-2.5 rounded-lg transition-colors group relative ${isActive ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-white'}`}>
                    <ChartIcon />
                    {expanded && <span className="font-semibold text-sm whitespace-nowrap absolute left-10">Analytics</span>}
                    {!expanded && <div className="absolute left-14 bg-[var(--color-bg-elevated)] text-white text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Analytics</div>}
                </NavLink>
                <NavLink to="/recovery" className={({ isActive }) => `flex items-center gap-4 px-2.5 py-2.5 rounded-lg transition-colors group relative ${isActive ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-white'}`}>
                    <ShieldIcon />
                    {expanded && <span className="font-semibold text-sm whitespace-nowrap absolute left-10">Recovery Cases</span>}
                    {!expanded && <div className="absolute left-14 bg-[var(--color-bg-elevated)] text-white text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Recovery Cases</div>}
                </NavLink>
            </nav>

            <div className="p-4 border-t border-[var(--color-border)] flex flex-col gap-4 overflow-hidden">
                <button onClick={() => setExpanded(!expanded)} className={`flex text-[var(--color-text-muted)] hover:text-white transition ${expanded ? 'justify-end' : 'justify-center'}`}>
                    <svg className={`w-5 h-5 transition-transform duration-300 ${!expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                </button>
                {expanded && (
                    <div className="flex flex-col gap-1 items-start whitespace-nowrap animate-in fade-in">
                        <span className="text-[10px] font-mono text-[var(--color-text-muted)] tracking-wider">v1.0.0</span>
                        <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 px-2 py-0.5 rounded text-[9px] font-bold tracking-widest text-[var(--color-success)] uppercase">Powered by GNN</div>
                    </div>
                )}
            </div>
        </aside>
    );
}
