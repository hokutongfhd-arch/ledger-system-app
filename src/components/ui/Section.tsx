
import React from 'react';

interface SectionHeaderProps extends React.HTMLAttributes<HTMLHeadingElement> {
    icon?: React.ReactNode;
    title?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ children, className = '', icon, title, ...props }) => {
    const content = title || children;

    return (
        <div className={`flex items-center gap-2 border-b-2 border-gray-200 pb-2 mb-4 ${className}`}>
            {icon && <span className="text-gray-500">{icon}</span>}
            <h3 className="text-lg font-bold text-gray-800" {...props}>
                {content}
            </h3>
        </div>
    );
};
