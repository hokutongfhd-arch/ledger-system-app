'use client';

import { SidebarPreview } from '../../../components/layout/SidebarPreview';
import { Search, Calendar, ChevronDown, MoreHorizontal, ArrowUpRight } from 'lucide-react';

export default function DesignPreviewPage() {
    return (
        <div className="flex h-screen overflow-hidden bg-gradient-to-br from-pulsar-bg-start to-pulsar-bg-end font-sans">
            <SidebarPreview />

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden relative">

                {/* Header */}
                <header className="px-8 py-6 flex justify-between items-center z-10">
                    <h1 className="text-3xl font-bold text-pulsar-text-main">
                        Analytical board
                    </h1>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-sm font-medium text-pulsar-text-secondary cursor-pointer hover:text-pulsar-text-main">
                            Chart: Funnel <ChevronDown size={14} />
                        </div>

                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-pulsar-text-secondary" />
                            <input
                                type="text"
                                placeholder="Search"
                                className="pl-10 pr-4 py-2 bg-white/40 border border-white/60 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-pulsar-accent/20 w-64 backdrop-blur-sm shadow-soft transition-all"
                            />
                        </div>

                        <button className="p-2 bg-pulsar-primary text-white rounded-full shadow-lg hover:shadow-xl transition-transform hover:-translate-y-0.5 active:translate-y-0">
                            <Calendar size={18} />
                        </button>
                    </div>
                </header>

                {/* Dashboard Grid */}
                <div className="flex-1 overflow-y-auto p-8 pt-0 pb-12">
                    <div className="grid grid-cols-12 gap-8 h-full">

                        {/* Left Column (Big Chart + Table) */}
                        <div className="col-span-8 flex flex-col gap-6">

                            {/* Main Chart Card */}
                            <div className="glass-card p-8 relative overflow-hidden min-h-[400px]">
                                <div className="flex justify-between items-start mb-8">
                                    <h2 className="text-xl font-semibold text-pulsar-text-main">Sales Funnel Analytics</h2>
                                    <span className="text-sm font-medium text-pulsar-text-secondary flex items-center gap-1 cursor-pointer">
                                        This week <ChevronDown size={14} />
                                    </span>
                                </div>

                                {/* Fake Chart Area */}
                                <div className="grid grid-cols-4 gap-4 mb-2">
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-pulsar-text-main mb-1">95k</div>
                                        <div className="text-xs text-pulsar-text-secondary">Emails</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-pulsar-text-main mb-1">73.4k</div>
                                        <div className="text-xs text-pulsar-text-secondary">Visits</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-pulsar-text-main mb-1">33.1k</div>
                                        <div className="text-xs text-pulsar-text-secondary">Log in</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-pulsar-text-main mb-1">15.7k</div>
                                        <div className="text-xs text-pulsar-text-secondary">Payments</div>
                                    </div>
                                </div>

                                {/* Abstract Blue Wave (CSS/SVG) */}
                                <div className="absolute bottom-0 left-0 right-0 h-48 opacity-80 pointer-events-none">
                                    <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="w-full h-full">
                                        <defs>
                                            <linearGradient id="blueGradient" x1="0" x2="0" y1="0" y2="1">
                                                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
                                                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
                                            </linearGradient>
                                        </defs>
                                        <path fill="url(#blueGradient)" d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                                        <path fill="#3B82F6" stroke="#2563EB" strokeWidth="2" fillOpacity="0.1" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,250.7C960,235,1056,181,1152,170.7C1248,160,1344,192,1392,208L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                                    </svg>
                                </div>

                                {/* Stats Cards Inline */}
                                <div className="absolute bottom-6 left-6 right-6 flex justify-between">
                                    <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-sm w-[30%] border border-white/50">
                                        <div className="text-2xl font-bold text-pulsar-text-main">123%</div>
                                        <div className="text-xs font-semibold text-pulsar-accent uppercase mt-1 flex items-center gap-1">
                                            <div className="w-2 h-2 rounded-full bg-pulsar-accent"></div> ROI
                                        </div>
                                    </div>
                                    <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-sm w-[30%] border border-white/50">
                                        <div className="text-2xl font-bold text-pulsar-text-main">5%</div>
                                        <div className="text-xs font-semibold text-pulsar-accent uppercase mt-1 flex items-center gap-1">
                                            <ArrowUpRight size={12} /> Click Rate
                                        </div>
                                    </div>
                                    <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-sm w-[30%] border border-white/50">
                                        <div className="text-2xl font-bold text-pulsar-text-main">450K</div>
                                        <div className="text-xs font-semibold text-pulsar-accent uppercase mt-1 flex items-center gap-1">
                                            <div className="w-2 h-2 rounded-full bg-pulsar-accent"></div> Active Users
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Table List */}
                            <div className="mt-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-semibold text-pulsar-text-main">High-Risk Customers</h2>
                                    <span className="text-xs font-bold text-pulsar-text-secondary underline cursor-pointer">See all</span>
                                </div>
                                <div className="glass-panel p-6">
                                    <table className="w-full text-left">
                                        <thead className="text-xs text-pulsar-text-light font-medium uppercase border-b border-gray-200/50">
                                            <tr>
                                                <th className="pb-3 pl-2">Name</th>
                                                <th className="pb-3 text-center">Risk</th>
                                                <th className="pb-3">Key factors</th>
                                                <th className="pb-3 text-right">Account value</th>
                                                <th className="pb-3 text-center">Feedback</th>
                                                <th className="pb-3 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {[
                                                { name: "Ralph Edwards", risk: "high", factor: "Low activity", val: "$ 12,500", img: "Jasper" },
                                                { name: "Floyd Miles", risk: "high", factor: "Inactivity", val: "$ 7,240", img: "Aneka" },
                                                { name: "Jenny Wilson", risk: "high", factor: "Low engagement", val: "$ 91,000", img: "Jocelyn" },
                                            ].map((item, i) => (
                                                <tr key={i} className="hover:bg-white/30 transition-colors group">
                                                    <td className="py-4 pl-2 flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${item.img}`} alt={item.name} />
                                                        </div>
                                                        <span className="font-semibold text-pulsar-text-main">{item.name}</span>
                                                    </td>
                                                    <td className="py-4 text-center">
                                                        <div className="flex gap-1 justify-center">
                                                            {[1, 2, 3, 4].map(x => <div key={x} className={`w-1 h-3 rounded-full ${x <= 3 ? 'bg-pulsar-accent' : 'bg-gray-300'}`}></div>)}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 text-pulsar-text-secondary">{item.factor}</td>
                                                    <td className="py-4 text-right font-medium text-pulsar-text-main">{item.val}</td>
                                                    <td className="py-4 text-center flex justify-center gap-1 text-blue-400 mt-1">
                                                        <span>✦</span><span>✦</span><span>✦</span>
                                                    </td>
                                                    <td className="py-4 text-center text-gray-400 cursor-pointer hover:text-gray-600">
                                                        <MoreHorizontal size={16} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Right Column (AI Copilot / Cards) */}
                        <div className="col-span-4 flex flex-col gap-6">
                            <div className="glass-card p-6 flex flex-col items-center text-center relative overflow-hidden bg-gradient-to-b from-white/70 to-white/30">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pulsar-accent to-transparent opacity-50"></div>
                                <h3 className="text-lg font-semibold text-pulsar-text-main mb-6">
                                    The <span className="bg-pulsar-accent/10 text-pulsar-accent px-1 rounded border border-pulsar-accent/20">AI</span> Co-Pilot
                                </h3>

                                {/* Orb Representation */}
                                <div className="relative w-48 h-48 mb-6">
                                    <div className="absolute inset-0 bg-blue-500 rounded-full blur-[60px] opacity-20 animate-pulse"></div>
                                    <div className="w-full h-full rounded-full border border-white/40 shadow-inner flex items-center justify-center bg-gradient-to-br from-blue-100/50 to-purple-100/50 backdrop-blur-sm">
                                        {/* Abstract inner shapes */}
                                        <div className="w-32 h-32 rounded-full border border-white/60 relative animate-blob">
                                            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-400/30 to-purple-500/30 rounded-full blur-md"></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full text-left mb-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-pulsar-text-main">Retention</span>
                                        <span className="text-xs text-pulsar-text-secondary flex items-center">Monthly <ChevronDown size={10} /></span>
                                    </div>
                                    <p className="text-xs text-pulsar-text-secondary mb-4">Customer loyalty grew by 8%</p>

                                    {/* Mini Bar Chart */}
                                    <div className="h-20 flex items-end justify-between px-4 gap-2">
                                        <div className="w-1/3 bg-blue-200/50 h-[60%] rounded-t-lg"></div>
                                        <div className="w-1/3 bg-blue-300/50 h-[40%] rounded-t-lg"></div>
                                        <div className="w-1/3 bg-blue-500 h-[80%] rounded-t-lg shadow-lg shadow-blue-500/30 relative group">
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">85%</div>
                                        </div>
                                    </div>
                                </div>

                                <button className="w-full py-3 bg-pulsar-primary text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all text-sm font-semibold">
                                    Generate Report
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
