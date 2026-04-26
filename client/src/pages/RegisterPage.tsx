import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../api/client';

export default function RegisterPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [upiVpa, setUpiVpa] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await registerUser(email, password, upiVpa);
            navigate('/login');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4">
            <div className="bg-[#1e293b] p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-800">
                <h2 className="text-3xl font-bold text-center text-white mb-2 tracking-tight">FraudShield</h2>
                <h3 className="text-lg text-gray-400 text-center mb-8">Create your analyst account</h3>
                {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 rounded p-3 mb-6 text-sm text-center">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1.5">UPI VPA Registration</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. your_name@okbank"
                            className="w-full bg-[#0f172a] text-white border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition"
                            value={upiVpa}
                            onChange={e => setUpiVpa(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1.5">Email Address</label>
                        <input
                            type="email"
                            required
                            placeholder="analyst@fraudshield.com"
                            className="w-full bg-[#0f172a] text-white border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
                        <input
                            type="password"
                            required
                            placeholder="••••••••"
                            className="w-full bg-[#0f172a] text-white border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#3b82f6] hover:bg-blue-600 active:bg-blue-700 text-white font-medium rounded-lg p-3 transition disabled:opacity-50 mt-2"
                    >
                        {loading ? 'Registering System...' : 'Register'}
                    </button>
                </form>
                <p className="mt-6 text-center text-gray-500 text-sm">
                    Already authorized? <Link to="/login" className="text-[#3b82f6] hover:text-blue-400 transition font-medium">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
