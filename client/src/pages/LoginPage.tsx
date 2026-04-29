import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../api/client';

const AnimatedCounter = ({ end, duration }: { end: number, duration: number }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let start = 0;
        const increment = end / (duration / 16);
        const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
                setCount(end);
                clearInterval(timer);
            } else {
                setCount(Math.floor(start));
            }
        }, 16);
        return () => clearInterval(timer);
    }, [end, duration]);

    return <span>{count.toLocaleString()}</span>;
};

export default function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await loginUser(email, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-sans">
            {/* Left Panel */}
            <div className="hidden md:flex flex-col flex-1 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] relative overflow-hidden p-12 lg:p-20 justify-between">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent-glow)] to-transparent pointer-events-none opacity-40"></div>

                <div className="z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[var(--color-accent)] to-[#60a5fa] flex items-center justify-center font-black text-white text-2xl shadow-lg shadow-blue-500/20">
                            F
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight text-white">FraudShield</h1>
                    </div>
                    <p className="text-lg text-[var(--color-text-secondary)] font-medium max-w-md">
                        Securing India's Digital Payments Infrastructure
                    </p>
                </div>

                <div className="z-10 space-y-10 mt-12 mb-12 flex-1 flex flex-col justify-center">
                    <div className="space-y-2 group">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors">Transactions Protected Today</p>
                        <p className="text-5xl font-bold text-white font-mono"><AnimatedCounter end={1428573} duration={1500} /></p>
                    </div>
                    <div className="space-y-2 group">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors">Fraud Attempts Blocked</p>
                        <p className="text-5xl font-bold text-[var(--color-danger)] font-mono"><AnimatedCounter end={4821} duration={2000} /></p>
                    </div>
                    <div className="space-y-2 group">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors">Recovery Rate</p>
                        <p className="text-5xl font-bold text-[var(--color-success)] font-mono"><AnimatedCounter end={99} duration={2500} />.9%</p>
                    </div>
                </div>

                <div className="z-10 flex items-center gap-3 text-[var(--color-text-muted)] font-medium text-sm">
                    <svg className="w-5 h-5 text-[var(--color-success)]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    <span>Secured by RBI-grade encryption. AI Engine Active.</span>
                </div>
            </div>

            {/* Right Panel */}
            <div className="flex-1 flex flex-col justify-center items-center p-6 bg-transparent">
                <div className="w-full max-w-md">
                    {/* Only visible on mobile */}
                    <div className="md:hidden flex items-center gap-3 mb-10 justify-center">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--color-accent)] to-[#60a5fa] flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20">F</div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">FraudShield</h1>
                    </div>

                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-8 rounded-2xl shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-[var(--color-border-subtle)]">
                        <div className="flex justify-between items-center mb-8 border-b border-[var(--color-border)] pb-5">
                            <h2 className="text-lg font-semibold text-white">Authentication</h2>
                            <div className="flex bg-[var(--color-bg-elevated)] rounded-lg p-1 border border-[var(--color-border)]">
                                <button className="px-5 py-1.5 text-xs font-semibold bg-[var(--color-accent)] text-white rounded shadow-sm transition-all duration-200">Login</button>
                                <Link to="/register" className="px-5 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-white transition-all duration-200">Register</Link>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)] rounded-xl p-4 mb-6 text-sm flex items-center gap-3 animate-in fade-in zoom-in-95 font-medium">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Corporate Email</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-[var(--color-bg-elevated)] text-white border border-[var(--color-border)] rounded-xl p-3.5 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all duration-200"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="agent@fraudshield.internal"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Secure Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-[var(--color-bg-elevated)] text-white border border-[var(--color-border)] rounded-xl p-3.5 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all duration-200 font-mono tracking-[0.2em]"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[var(--color-accent)] hover:bg-[#2563eb] active:scale-[0.98] text-white font-semibold rounded-xl p-4 transition-all duration-200 shadow-lg shadow-blue-500/20 disabled:opacity-70 disabled:cursor-wait mt-2 flex justify-center items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Establishing Secure Link...
                                    </>
                                ) : 'Access Mission Control'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
