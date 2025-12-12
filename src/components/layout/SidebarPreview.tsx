import React, { useState } from 'react';
import { LayoutDashboard, BarChart3, ListTodo, FileText, Bell, Settings, HelpCircle } from 'lucide-react';
import { clsx } from 'clsx';

// Mock Item for Preview
const SidebarItem = ({ icon: Icon, label, isActive, onClick }: { icon: any; label: string; isActive?: boolean; onClick?: () => void }) => (
    <div
        onClick={onClick}
        className={clsx(
            'flex items-center gap-3 px-5 py-3 text-sm font-medium transition-all duration-200 cursor-pointer mb-1',
            // Active: White pill, shadow, primary text
            isActive
                ? 'bg-white/80 shadow-soft text-pulsar-text-main rounded-r-[50px] rounded-l-[10px] scale-105 origin-left'
                : 'text-pulsar-text-secondary hover:text-pulsar-text-main hover:bg-white/40 hover:rounded-r-[50px] hover:rounded-l-[10px]'
        )}
    >
        <Icon size={20} className={isActive ? "text-pulsar-accent" : ""} />
        <span>{label}</span>
    </div>
);

const SidebarSection = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col gap-1 mb-6 px-4">
        {children}
    </div>
);

export const SidebarPreview = () => {
    const [active, setActive] = useState('Dashboard');

    return (
        <div className="w-64 h-full flex flex-col py-6">
            <div className="px-8 mb-10 flex items-center gap-2">
                {/* Logo Placeholder */}
                <div className="w-8 h-8 bg-pulsar-accent rounded-lg grid place-items-center">
                    <div className="w-3 h-3 bg-white rounded-full opacity-80" />
                </div>
                <h1 className="text-2xl font-bold text-pulsar-text-main tracking-tight">
                    PULSAR
                </h1>
            </div>

            <SidebarSection>
                <SidebarItem
                    icon={LayoutDashboard}
                    label="ダッシュボード"
                    isActive={active === 'Dashboard'}
                    onClick={() => setActive('Dashboard')}
                />
                <SidebarItem
                    icon={BarChart3}
                    label="統計"
                    isActive={active === 'Statistics'}
                    onClick={() => setActive('Statistics')}
                />
                <SidebarItem
                    icon={ListTodo}
                    label="タスク一覧"
                    isActive={active === 'Tasks'}
                    onClick={() => setActive('Tasks')}
                />
                <SidebarItem
                    icon={FileText}
                    label="レポート"
                    isActive={active === 'Report'}
                    onClick={() => setActive('Report')}
                />
                <SidebarItem
                    icon={Bell}
                    label="通知"
                    isActive={active === 'Notifications'}
                    onClick={() => setActive('Notifications')}
                />
            </SidebarSection>

            <div className="mt-auto px-4">
                <div className="mb-4 px-4 text-xs font-bold text-pulsar-text-secondary uppercase tracking-wider opacity-70">
                    その他
                </div>
                <SidebarItem
                    icon={Settings}
                    label="設定"
                    isActive={active === 'Settings'}
                    onClick={() => setActive('Settings')}
                />
                <SidebarItem
                    icon={HelpCircle}
                    label="ヘルプ"
                    isActive={active === 'Help'}
                    onClick={() => setActive('Help')}
                />
            </div>

            <div className="mt-8 px-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-300 overflow-hidden border-2 border-white shadow-sm">
                    {/* Avatar placeholder */}
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="user" className="w-full h-full bg-cover" />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-pulsar-text-main line-clamp-1">山田 太郎</span>
                    <span className="text-xs text-pulsar-text-secondary line-clamp-1">yamada@example.com</span>
                </div>
            </div>
        </div>
    );
};
