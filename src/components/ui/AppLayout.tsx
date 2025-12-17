import React from 'react';

interface AppLayoutProps {
    children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    // Apply font-sans to ensure UD Shin Go is used
    return (
        <div className="font-sans min-h-screen">
            {children}
        </div>
    );
};
