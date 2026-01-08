import React from 'react';

export const DetailRow = ({ label, value, subValue, icon, isSensitive, className }: { label: string, value: string | undefined | number, subValue?: string, icon?: React.ReactNode, isSensitive?: boolean, className?: string }) => (
    <div className={`group ${className}`}>
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5 block">{label}</label>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                {icon}
                <span className={`font-medium ${!value ? 'text-gray-300' : 'text-gray-800'} ${isSensitive ? 'font-mono' : ''}`}>
                    {value || '-'}
                </span>
                {subValue && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {subValue}
                    </span>
                )}
            </div>
        </div>
    </div>
);
