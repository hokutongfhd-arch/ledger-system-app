
import React from 'react';

interface ChartSegment {
    label: string;
    value: number;
    color: string;
}

interface SegmentedDonutChartProps {
    title: string;
    segments: ChartSegment[];
    total: number;
}

export const SegmentedDonutChart: React.FC<SegmentedDonutChartProps> = ({ title, segments, total }) => {
    const size = 200;
    const strokeWidth = 20;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    let accumulatedOffset = 0;

    // Check if total is 0 to avoid division by zero
    const renderSegments = () => {
        if (total === 0) {
            return (
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth={strokeWidth}
                />
            );
        }

        return segments.map((segment, index) => {
            if (segment.value === 0) return null;

            const percentage = (segment.value / total);
            const dashArray = circumference * percentage;
            const offset = accumulatedOffset;
            accumulatedOffset += dashArray;

            // 回転を使用してセグメントを配置するアプローチ
            // 前のセグメントの終了位置（offset）に基づいて回転角度を計算します
            const rotateDeg = (offset / circumference) * 360 - 90; // -90deg（12時の位置）から開始

            return (
                <circle
                    key={index}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dashArray} ${circumference - dashArray}`}
                    strokeDashoffset={0} // Offset handled by rotation
                    transform={`rotate(${rotateDeg} ${size / 2} ${size / 2})`}
                />
            );
        });
    };

    return (
        <div className="flex flex-col items-center justify-center">
            <h3 className="text-xl font-bold text-text-main mb-6">{title}</h3>
            <div className="relative">
                <svg width={size} height={size}>
                    {/* Background Track */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="#E2E8F0"
                        strokeWidth={strokeWidth}
                    />
                    {renderSegments()}
                </svg>
                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-display font-bold text-text-main">
                        {total}
                    </span>
                    <span className="text-xs text-text-secondary uppercase tracking-wider">Total</span>
                </div>
            </div>
            {/* Legend */}
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {segments.map((seg, i) => (
                    seg.value > 0 && (
                        <div key={i} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }}></div>
                            <span className="text-text-secondary">{seg.label}</span>
                            <span className="font-bold text-text-main">({seg.value})</span>
                        </div>
                    )
                ))}
            </div>
        </div>
    );
};
