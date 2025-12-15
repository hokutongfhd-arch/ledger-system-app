import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2 } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    startIndex: number;
    endIndex: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    selectedCount?: number;
    onBulkDelete?: () => void;
}

export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    pageSize,
    onPageChange,
    onPageSizeChange,
    selectedCount = 0,
    onBulkDelete
}) => {
    return (
        <div className="flex flex-col xl:flex-row justify-between items-center bg-white p-4 border-t border-gray-200 mt-auto rounded-b-lg gap-4">
            {/* Left: Result Count and Bulk Actions */}
            <div className="flex flex-wrap items-center gap-4 justify-center sm:justify-start">
                <span className="text-sm text-gray-600 whitespace-nowrap">
                    {totalItems} 件中 {startIndex + 1} - {endIndex} を表示
                </span>
                {onBulkDelete && (
                    <button
                        onClick={onBulkDelete}
                        disabled={selectedCount === 0}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Trash2 size={16} />
                        まとめて削除
                    </button>
                )}
            </div>

            {/* Right: Pagination Controls */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronsLeft size={20} />
                    </button>
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="flex items-center gap-2 mx-2">
                        <input
                            type="number"
                            min={1}
                            max={totalPages || 1}
                            value={currentPage}
                            onChange={(e) => onPageChange(Number(e.target.value))}
                            className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm"
                        />
                        <span className="text-sm text-gray-600 whitespace-nowrap">/ {totalPages || 1} ページ</span>
                    </div>

                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronRight size={20} />
                    </button>
                    <button
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronsRight size={20} />
                    </button>
                </div>

                <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                >
                    {[15, 30, 50, 100].map(size => (
                        <option key={size} value={size}>{size} 件 / ページ</option>
                    ))}
                </select>
            </div>
        </div>
    );
};
