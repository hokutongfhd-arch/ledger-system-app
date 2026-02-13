import React, { useState, useEffect, useRef } from 'react';
import { Input } from './Input';

interface IpInputProps {
    name: string;
    value: string;
    onChange: (name: string, value: string) => void;
    error?: boolean;
    disabled?: boolean;
}

export const IpInput: React.FC<IpInputProps> = ({ name, value, onChange, error, disabled }) => {
    // Initialize state from value
    const [parts, setParts] = useState<string[]>(['', '', '', '']);
    const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

    useEffect(() => {
        if (value) {
            const split = value.split('.');
            const newParts = ['', '', '', ''];
            for (let i = 0; i < 4; i++) {
                newParts[i] = split[i] || '';
            }
            setParts(newParts);
        } else {
            setParts(['', '', '', '']);
        }
    }, [value]);

    const handleChange = (index: number, val: string) => {
        if (!/^\d*$/.test(val)) return;

        const newParts = [...parts];
        newParts[index] = val;
        setParts(newParts);

        // Filter out empty parts for the final check to avoid ".." or "192..1" if intuitive, 
        // but IP standard usually expects specific structure. 
        // For simplicity and to match simple text storage, we join with '.'.
        // If a part is empty, it stays empty between dots like "192..1.1" which validation should catch later.
        // Or we can construct "192.168.1.1" properly. 

        const newValue = newParts.join('.');
        onChange(name, newValue);

        // Auto-focus next input if 3 digits entered
        if (val.length === 3 && index < 3) {
            refs[index + 1].current?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && parts[index] === '' && index > 0) {
            // Move back to previous input on backspace if empty
            refs[index - 1].current?.focus();
        }
        if (e.key === '.' && index < 3) {
            e.preventDefault();
            refs[index + 1].current?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text');

        // Try to parse as full IP or partial
        const match = pastedData.match(/(\d{1,3})\.?(\d{1,3})?\.?(\d{1,3})?\.?(\d{1,3})?/);
        if (match) {
            const newParts = [...parts];
            // match[0] is full match, 1-4 are groups
            for (let i = 0; i < 4; i++) {
                if (match[i + 1]) {
                    newParts[i] = match[i + 1].slice(0, 3);
                }
            }
            setParts(newParts);
            onChange(name, newParts.join('.'));
        }
    };

    return (
        <div className="flex items-center gap-1">
            {parts.map((part, index) => (
                <React.Fragment key={index}>
                    <Input
                        ref={refs[index]}
                        className={`w-14 text-center px-1 ${error ? 'border-red-500' : ''}`}
                        value={part}
                        onChange={(e) => handleChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={index === 0 ? handlePaste : undefined}
                        maxLength={3}
                        placeholder="xxx"
                        disabled={disabled}
                    />
                    {index < 3 && <span className="text-gray-500 font-bold">.</span>}
                </React.Fragment>
            ))}
        </div>
    );
};
