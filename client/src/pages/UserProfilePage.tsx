import { useEffect, useState } from 'react';
import client from '../api/client';

export default function UserProfilePage() {
    const [profile, setProfile] = useState<any>(null);
    const [userContext, setUserContext] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = localStorage.getItem('fraudshield_token');
                if (token) {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    setUserContext(payload);

                    const profileRes = await client.get(`/api/users/${payload.userId}/profile`);
                    if (profileRes.data?.data) {
                        setProfile(profileRes.data.data);
                    }
                }
            } catch (err) {
                console.error("Failed to load user profile", err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    if (loading) return <div className="flex h-screen items-center justify-center pt-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--color-accent)]"></div></div>;

    if (!profile) {
        return (
            <div className="pt-[100px] px-8 md:px-12 pb-12 w-full animate-in fade-in flex items-center justify-center min-h-[calc(100vh-100px)]">
                <div className="text-center text-[var(--color-text-secondary)]">
                    <p className="mb-2">No Behavioral Profile Setup Yet</p>
                    <p className="text-sm">Initiate transactions securely mapping profile clusters safely creating temporal boundaries...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pt-[100px] px-8 md:px-12 pb-12 w-full animate-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8 flex justify-between items-end border-b border-[var(--color-border)] pb-6 relative">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">My Profile</h1>
                    <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)] font-mono">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md text-[var(--color-accent)]">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            {userContext?.email || 'Unknown User'}
                        </span>
                        <span>UUID:: {userContext?.userId}</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-lg relative overflow-hidden group">
                    <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4">Avg Transaction</h3>
                    <div className="text-3xl font-black text-white font-mono tracking-tighter">₹{profile.avgTransactionAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-lg relative overflow-hidden group">
                    <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4">Most Common Time</h3>
                    <div className="text-3xl font-black text-[var(--color-accent)] font-mono tracking-tighter">{profile.mostCommonHour}:00 HRS</div>
                </div>
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-lg relative overflow-hidden group">
                    <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4">Night Activity</h3>
                    <div className="text-3xl font-black text-white font-mono tracking-tighter">{(profile.nightTransactionRatio * 100).toFixed(1)}%</div>
                </div>
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-lg relative overflow-hidden group">
                    <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4">Transactions</h3>
                    <div className="text-3xl font-black text-white font-mono tracking-tighter">{profile.transactionsProcessed}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-bold text-white mb-4">Favorite Receivers</h3>
                    <div className="flex flex-col gap-3">
                        {profile.favoriteReceiverVpas.length === 0 ? (
                            <div className="text-[var(--color-text-muted)] text-sm">No receivers established yet...</div>
                        ) : profile.favoriteReceiverVpas.map((vpa: string, i: number) => (
                            <div key={vpa} className="flex justify-between items-center px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg font-mono text-sm text-[var(--color-text-secondary)] hover:text-white transition">
                                <span>{i + 1}. {vpa}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-bold text-white mb-4">Standard Locations</h3>
                    <div className="flex flex-col gap-3">
                        {profile.favoriteLocations.length === 0 ? (
                            <div className="text-[var(--color-text-muted)] text-sm">No locations established yet...</div>
                        ) : profile.favoriteLocations.map((loc: string, i: number) => (
                            <div key={loc} className="flex justify-between items-center px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg font-mono text-sm text-[var(--color-text-secondary)] hover:text-white transition">
                                <span>{i + 1}. {loc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-6 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-bold text-[var(--color-danger)] mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Anomaly Math Parameters
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] mb-6">Limits mapped dynamically resolving against complex standard deviations tracking explicitly inside GNN.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-sm">
                    <div className="p-4 border border-[var(--color-border)] bg-[var(--color-bg-primary)] rounded-lg flex flex-col gap-1">
                        <span className="text-[var(--color-text-secondary)] uppercase text-[10px] tracking-widest font-black">Spike Bounds Limit (Amount)</span>
                        <div className="text-white">{(profile.avgTransactionAmount + 2.5 * profile.stdDevAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[var(--color-text-muted)]">({profile.amountZscoreThreshold}σ)</span></div>
                    </div>
                    <div className="p-4 border border-[var(--color-border)] bg-[var(--color-bg-primary)] rounded-lg flex flex-col gap-1">
                        <span className="text-[var(--color-text-secondary)] uppercase text-[10px] tracking-widest font-black">Velocity Throttle</span>
                        <div className="text-white">{profile.velocityThreshold} <span className="text-[var(--color-text-muted)]">TX/min</span></div>
                    </div>
                </div>
            </div>

        </div>
    );
}
