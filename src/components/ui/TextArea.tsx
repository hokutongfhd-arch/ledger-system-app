
import React, { forwardRef } from 'react';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    error?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
    ({ className = '', error, ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 outline-none transition-all ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    } ${className}`}
                {...props}
            />
        );
    }
);

TextArea.displayName = 'TextArea';
