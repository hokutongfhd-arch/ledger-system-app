import React from 'react';
import { Search, Filter } from 'lucide-react';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    onFilterClick?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    value,
    onChange,
    placeholder = "検索...",
    onFilterClick
}) => {
    return (
        <div className="bg-background-paper p-4 rounded-xl shadow-card border border-border flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={18} />
                <input
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none bg-background-subtle text-text-main placeholder-text-muted"
                />
            </div>
            <button
                onClick={onFilterClick}
                className="text-text-secondary hover:text-text-main p-2 rounded-lg hover:bg-background-subtle"
            >
                <Filter size={20} />
            </button>
        </div>
    );
};
