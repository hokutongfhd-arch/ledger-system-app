import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface Option {
    label: string;
    value: string;
    subLabel?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = '選択してください',
    className = '',
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Focus search input when opening
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    // Find selected option label
    const selectedOption = options.find(opt => opt.value === value);

    // Filter options based on search term
    const filteredOptions = options.filter(opt => {
        const term = searchTerm.toLowerCase();
        return (
            opt.label.toLowerCase().includes(term) ||
            opt.value.toLowerCase().includes(term) ||
            (opt.subLabel && opt.subLabel.toLowerCase().includes(term))
        );
    });

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearchTerm('');
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                className={`
                    w-full px-3 py-2 border rounded-md bg-white flex items-center justify-between cursor-pointer transition-colors
                    ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-70' : 'hover:border-blue-400'}
                    ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300'}
                `}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <div className="flex-1 truncate text-sm">
                    {selectedOption ? (
                        <span className="text-gray-900">
                            {selectedOption.label}
                            {selectedOption.subLabel && (
                                <span className="text-xs text-gray-500 ml-2">({selectedOption.subLabel})</span>
                            )}
                        </span>
                    ) : (
                        <span className="text-gray-400">{placeholder}</span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {value && !disabled && (
                        <div
                            role="button"
                            onClick={handleClear}
                            className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"
                        >
                            <X size={14} />
                        </div>
                    )}
                    <ChevronDown size={16} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                                placeholder="検索..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    className={`
                                        px-3 py-2 text-sm rounded cursor-pointer flex flex-col
                                        ${value === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}
                                    `}
                                    onClick={() => handleSelect(option.value)}
                                >
                                    <span className="font-medium">{option.label}</span>
                                    <div className="flex items-center gap-2 text-xs opacity-70">
                                        <span>ID: {option.value}</span>
                                        {option.subLabel && option.subLabel !== option.value && <span>• {option.subLabel}</span>}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-sm text-gray-500">
                                該当なし
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
