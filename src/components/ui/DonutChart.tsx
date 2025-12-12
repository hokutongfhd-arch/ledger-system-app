
import React from 'react';

interface DonutChartProps {
    title: string;
    total: number;
    used: number;
    color: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({ title, total, used, color }) => {
    const percentage = total > 0 ? (used / total) * 100 : 0;
    const size = 160;
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="flex flex-col items-center bg-background-paper p-6 rounded-2xl shadow-card border border-border">
            <h3 className="text-xl font-bold text-text-main mb-4">{title}</h3>
            <div className="relative">
                <svg width={size} height={size} className="transform -rotate-90">
                    {/* Track */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="#E2E8F0" // gray-200 for 'Paper' feel
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />
                    {/* Progress */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                    />
                </svg>
                {/* Center Text */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold text-text-main">
                        {Math.round(percentage)}%
                    </span>
                </div>
            </div>

            <div className="mt-4 w-full space-y-2">
                <div className="flex justify-between text-sm text-text-secondary">
                    <span>総数</span>
                    <span className="font-semibold">{total}台</span>
                </div>
                <div className="flex justify-between text-sm text-text-secondary">
                    <span>貸与中</span>
                    <span className="font-semibold text-text-main">{used}台</span>
                </div>
            </div>
        </div>
    );
};
