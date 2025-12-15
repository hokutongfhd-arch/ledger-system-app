import React from 'react';
import { Loader2 } from 'lucide-react';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon?: React.ElementType;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    isLoading?: boolean;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
    children,
    icon: Icon,
    variant = 'secondary',
    className = '',
    isLoading,
    disabled,
    ...props
}) => {
    const baseStyles = "px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-medium";

    const variants = {
        primary: "bg-primary text-white hover:bg-primary-hover",
        secondary: "bg-background-paper text-text-secondary border border-border hover:bg-background-subtle",
        danger: "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100",
        ghost: "bg-transparent text-text-secondary hover:bg-background-subtle border-none shadow-none"
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${className} ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : Icon && <Icon size={18} />}
            {children}
        </button>
    );
};
