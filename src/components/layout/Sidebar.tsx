import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, User, Smartphone, Tablet, Router as RouterIcon, Database, FileText, Phone, Bell } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

const SidebarItem = ({ to, icon: Icon, label, indent = false }: { to: string; icon: any; label: string; indent?: boolean }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            clsx(
                'flex items-center gap-4 px-6 py-3 text-sm font-medium transition-all duration-300 border-l-4 group relative overflow-hidden',
                isActive
                    ? 'border-accent-electric bg-ink text-white'
                    : 'border-transparent text-ink hover:bg-gray-100 hover:border-ink',
                indent && 'pl-10'
            )
        }
    >
        <Icon size={18} className="relative z-10" />
        <span className="font-display tracking-wide relative z-10">{label}</span>
    </NavLink>
);

const SidebarSection = ({ label, children }: { label?: string; children: React.ReactNode }) => (
    <div className="mb-8">
        {label && (
            <div className="flex items-center px-6 mb-3">
                <span className="text-xs font-bold text-ink-light uppercase tracking-[0.2em] relative">
                    {label}
                    <span className="absolute -bottom-1 left-0 w-8 h-[2px] bg-accent-coral"></span>
                </span>
            </div>
        )}
        <div className="flex flex-col">
            {children}
        </div>
    </div>
);

export const Sidebar = () => {
    const { user } = useAuth();
    const { employees } = useData();
    const currentUser = employees.find(e => e.id === user?.id);

    return (
        <div className="w-64 h-screen flex flex-col bg-paper border-r-2 border-ink overflow-y-auto font-sans">
            <div className="h-20 flex items-center px-6 border-b-2 border-ink mb-6 bg-ink text-white">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-accent-electric grid place-items-center border-2 border-white">
                        <span className="font-display font-bold text-ink text-lg">M</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-display font-bold tracking-tight">
                            MAIN MENU
                        </h1>
                    </div>
                </div>
            </div>

            <div className="flex-1 py-4">
                {user?.role === 'admin' && (
                    <SidebarSection>
                        <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />
                        <SidebarItem to="/logs" icon={Bell} label="ログ" />
                    </SidebarSection>
                )}

                <SidebarSection label="DEVICES">
                    <SidebarItem to="/devices/iphones" icon={Smartphone} label="iPhone" />
                    <SidebarItem to="/devices/feature-phones" icon={Phone} label="Feature Phone" />
                    <SidebarItem to="/devices/tablets" icon={Tablet} label="Tablet" />
                    <SidebarItem to="/devices/routers" icon={RouterIcon} label="WiFi Router" />
                </SidebarSection>

                <SidebarSection label="MASTERS">
                    <SidebarItem to="/masters/employees" icon={User} label="Employees" />
                    <SidebarItem to="/masters/areas" icon={Database} label="Areas" />
                    <SidebarItem to="/masters/addresses" icon={FileText} label="Addresses" />
                </SidebarSection>

                <SidebarSection label="SYSTEM">
                    <SidebarItem to="/user-dashboard" icon={User} label="My Page" />
                </SidebarSection>
            </div>

            {/* Profile Section */}
            <div className="p-6 border-t-2 border-ink bg-gray-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-ink flex items-center justify-center text-white border-2 border-ink relative overflow-hidden rounded-full">

                        {currentUser?.profileImage ? (
                            <img
                                src={currentUser.profileImage}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <User size={20} />
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-ink font-display truncate max-w-[120px]">
                            {currentUser?.name || user?.name || 'GUEST'}
                        </span>

                    </div>
                </div>
            </div>
        </div>
    );
};
