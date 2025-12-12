import React from 'react';
import { clsx } from 'clsx';
import { Edit, Trash2 } from 'lucide-react';

interface Column<T> {
    header: string | React.ReactNode;
    accessor: keyof T | ((item: T) => React.ReactNode);
    className?: string;
}

interface TableProps<T> {
    data: T[];
    columns: Column<T>[];
    onEdit?: (item: T) => void;
    onDelete?: (item: T) => void;
    canEdit?: (item: T) => boolean;
    canDelete?: (item: T) => boolean;
    rowClassName?: (item: T) => string;
    containerClassName?: string;
}

export const Table = <T extends { id: string }>({ data, columns, onEdit, onDelete, canEdit, canDelete, rowClassName, containerClassName }: TableProps<T>) => {
    return (
        <div className={clsx("table-container", containerClassName)}>
            <table className="min-w-full divide-y divide-ink">
                <thead className="bg-background-subtle">
                    <tr>
                        {columns.map((col, idx) => (
                            <th
                                key={idx}
                                scope="col"
                                className={clsx(
                                    "table-header sticky top-0 z-10",
                                    col.className
                                )}
                            >
                                {col.header}
                            </th>
                        ))}
                        {(onEdit || onDelete) && (
                            <th scope="col" className="table-header text-right sticky top-0 z-10">
                                操作
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-ink bg-white">
                    {data.map((item) => (
                        <tr
                            key={item.id}
                            className={clsx(
                                "hover:bg-accent-electric/10 transition-colors",
                                rowClassName?.(item)
                            )}
                        >
                            {columns.map((col, idx) => (
                                <td key={idx} className="table-cell">
                                    {typeof col.accessor === 'function'
                                        ? col.accessor(item)
                                        : (item[col.accessor] as React.ReactNode)}
                                </td>
                            ))}
                            {(onEdit || onDelete) && (
                                <td className="table-cell text-right">
                                    <div className="flex justify-end gap-2">
                                        {onEdit && (!canEdit || canEdit(item)) && (
                                            <button
                                                onClick={() => onEdit(item)}
                                                className="text-ink hover:text-white hover:bg-ink border border-ink p-1.5 transition-all shadow-sm"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        )}
                                        {onDelete && (!canDelete || canDelete(item)) && (
                                            <button
                                                onClick={() => onDelete(item)}
                                                className="text-white bg-accent-coral hover:bg-black border border-accent-coral hover:border-black p-1.5 transition-all shadow-sm"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                    {data.length === 0 && (
                        <tr>
                            <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} className="px-6 py-8 text-center text-text-muted text-sm">
                                データがありません
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
