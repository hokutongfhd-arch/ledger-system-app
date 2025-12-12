import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Database } from 'lucide-react';

export const Login = () => {
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const user = await login(code, password);
        if (user) {
            if (user.role === 'admin') {
                navigate('/');
            } else {
                navigate('/user-dashboard');
            }
        } else {
            setError('社員番号またはパスワードが間違っています');
        }
    };

    return (
        <div className="min-h-screen bg-paper flex items-center justify-center font-sans text-ink selection:bg-accent-electric selection:text-ink">
            <div className="bg-white p-10 w-full max-w-md border-2 border-ink shadow-offset relative">
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-2 bg-ink"></div>
                <div className="absolute top-0 right-0 -mr-2 -mt-2 w-8 h-8 bg-accent-electric border-2 border-ink z-10"></div>

                <div className="flex justify-center mb-8">
                    <div className="p-4 bg-ink text-white border-2 border-transparent">
                        <Database size={40} />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-center text-ink font-display tracking-tighter mb-2">LEDGER LOGIN</h1>
                <p className="text-center text-ink-light font-mono text-xs tracking-widest mb-10">AUTHORIZED PERSONNEL ONLY</p>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="relative group">
                        <label className="block text-xs font-bold text-ink uppercase tracking-widest mb-2 font-display">
                            Employee ID
                        </label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-ink bg-background-subtle focus:bg-white focus:outline-none focus:shadow-offset transition-all font-mono text-ink placeholder-ink-light/50"
                            placeholder="EMP001"
                            required
                        />
                    </div>

                    <div className="relative group">
                        <label className="block text-xs font-bold text-ink uppercase tracking-widest mb-2 font-display">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-ink bg-background-subtle focus:bg-white focus:outline-none focus:shadow-offset transition-all font-mono text-ink placeholder-ink-light/50"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && (
                        <div className="text-white bg-accent-coral border-2 border-ink p-3 text-sm font-bold text-center shadow-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-ink text-white py-4 px-6 border-2 border-transparent hover:bg-accent-electric hover:text-ink hover:border-ink hover:shadow-offset transition-all duration-300 font-bold tracking-widest font-display text-lg uppercase"
                    >
                        Access System
                    </button>
                </form>

                <div className="mt-10 pt-6 border-t-2 border-ink text-center text-xs text-ink-light font-mono">
                    <p className="mb-1">DEMO ACCOUNTS:</p>
                    <p>ADMIN: EMP001 / USER: EMP002</p>
                </div>
            </div>
        </div>
    );
};
