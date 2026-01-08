
import React from 'react';

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    required?: boolean;
}

export const FormLabel: React.FC<FormLabelProps> = ({ children, className = '', required, ...props }) => {
    return (
        <label className={`block text-sm font-medium text-gray-700 mb-1 ${className}`} {...props}>
            {children}
            {required && <span className="text-red-500 ml-1">*</span>}
        </label>
    );
};

export const FormError: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, className = '', ...props }) => {
    if (!children) return null;
    return (
        <p className={`text-red-500 text-sm mt-1 ${className}`} {...props}>
            {children}
        </p>
    );
};
