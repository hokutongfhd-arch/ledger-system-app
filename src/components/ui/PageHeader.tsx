import React from 'react';

interface PageHeaderProps {
    title: string;
    actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, actions }) => {
    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-2xl font-extrabold font-sans text-ink">{title}</h1>
            <div className="flex gap-2 flex-wrap">
                {actions}
            </div>
        </div>
    );
};
