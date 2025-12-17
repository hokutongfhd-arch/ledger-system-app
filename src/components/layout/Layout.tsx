
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../features/context/AuthContext';
import { LogOut } from 'lucide-react';

export const Layout = () => {
    const { user, logout } = useAuth();

    return (
        <div className="flex min-h-screen bg-paper font-sans selection:bg-accent-electric selection:text-ink">
            {/* Fixed Sidebar/Nav */}
            <div className="fixed inset-y-0 left-0 z-50">
                <Sidebar />
            </div>

            {/* Main Content Area - Offset for Sidebar */}
            <div className="flex-1 flex flex-col pl-64 relative min-h-screen">
                <header className="h-20 bg-paper/95 backdrop-blur-sm border-b-2 border-ink flex items-center justify-between px-10 sticky top-0 z-40">
                    <h2 className="text-xl font-display font-bold tracking-tighter text-ink">
                        LEDGER SYSTEM
                        <span className="text-accent-violet ml-1">.</span>
                    </h2>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="font-bold text-ink text-sm font-display tracking-tight">{user?.name}</p>
                            <p className="text-ink-light text-xs tracking-wider uppercase">{user?.role === 'admin' ? 'Administrator' : 'User'}</p>
                        </div>
                        <button
                            onClick={logout}
                            className="p-2 border-2 border-transparent hover:border-ink hover:bg-accent-electric transition-all duration-300 rounded-none group"
                            title="Log Out"
                        >
                            <LogOut size={20} className="text-ink group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </header>
                <main className="flex-1 p-10 overflow-x-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
