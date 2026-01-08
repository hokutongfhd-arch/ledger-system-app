
import React, { forwardRef } from 'react';

interface SelectOption {
    label: string;
    value: string | number;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    options?: SelectOption[];
    error?: boolean;
    placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ className = '', error, options, children, placeholder, ...props }, ref) => {
        return (
            <select
                ref={ref}
                className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 outline-none transition-all ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    } ${className}`}
                {...props}
            >
                {placeholder && <option value="">{placeholder}</option>}
                {options
                    ? options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))
                    : children}
            </select>
        );
    }
);

Select.displayName = 'Select';
