'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { useData } from '@/features/context/DataContext';
import { useAuth } from '@/features/context/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { ActionButton } from '@/components/ui/ActionButton';
import { Modal } from '@/components/ui/Modal';
import { Download, Plus, Upload, X, FileText, Trash2, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TitleFragment, ManualItem, ManualFile } from '@/features/manuals/manual.types';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useConfirm } from '@/hooks/useConfirm';

const SortableFileItem = ({
    file,
    fileIndex,
    itemId,
    onDelete,
    onLinkClick
}: {
    file: { name: string; url: string };
    fileIndex: number;
    itemId: string;
    onDelete: (itemId: string, index: number) => void;
    onLinkClick: (e: React.MouseEvent, url: string, name: string) => void;
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: `${itemId}-${file.name}-${fileIndex}` });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="group flex items-center justify-between p-2 bg-white border border-border rounded-md hover:shadow-sm transition-all"
        >
            <div className="flex items-center gap-2 overflow-hidden">
                <div
                    className="text-gray-400 cursor-grab active:cursor-grabbing hover:text-blue-600 outline-none"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical size={14} />
                </div>
                <a
                    href={file.url}
                    onClick={(e) => onLinkClick(e, file.url, file.name)}
                    className="text-sm text-blue-600 hover:underline truncate flex items-center gap-2"
                >
                    <FileText size={14} />
                    {file.name}
                </a>
            </div>
            <button
                onClick={() => onDelete(itemId, fileIndex)}
                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                title="削除"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
};

// Draggable Table Row Component
const DraggableRow = ({
    fragment,
    sensors,
    closestCenter,
    handleDragStart,
    handleDragEnd,
    handleDeleteFile,
    handleLinkClick
}: {
    fragment: TitleFragment,
    sensors: any,
    closestCenter: any,
    handleDragStart: () => void,
    handleDragEnd: (event: DragEndEvent, itemId: string) => void,
    handleDeleteFile: (itemId: string, index: number) => void,
    handleLinkClick: (e: React.MouseEvent, url: string, name: string) => void
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: `row-${fragment.id}` });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : 1,
        opacity: isDragging ? 0.6 : 1,
        position: 'relative' as any,
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={clsx(
                "transition-colors",
                isDragging ? "bg-accent-electric/20 shadow-lg z-50" : "hover:bg-accent-electric/5"
            )}
        >
            <td className="px-6 py-4 text-sm font-medium text-ink align-top">
                <div className="flex items-start gap-3">
                    <button
                        {...attributes}
                        {...listeners}
                        className="mt-0.5 text-gray-400 hover:text-blue-600 cursor-grab active:cursor-grabbing touch-none"
                    >
                        <GripVertical size={16} />
                    </button>
                    {fragment.title}
                </div>
            </td>
            <td className="px-6 py-4 text-sm text-ink-light whitespace-normal">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={(e) => handleDragEnd(e, fragment.itemId)}
                >
                    <SortableContext
                        items={fragment.files.map((f) => `${(f as any).parentId}-${f.name}-${f.originalIndex}`)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="flex flex-col gap-1">
                            {fragment.files.map((file) => (
                                <SortableFileItem
                                    key={`${(file as any).parentId}-${file.name}-${file.originalIndex}`}
                                    file={{ name: file.name, url: file.url }}
                                    fileIndex={file.originalIndex}
                                    itemId={(file as any).parentId}
                                    onDelete={handleDeleteFile}
                                    onLinkClick={handleLinkClick}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </td>
            <td className="px-6 py-4 text-sm text-ink-lighter italic align-top">
                {fragment.updatedAt}
            </td>
        </tr>
    );
};

export default function ManualListPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) router.push('/login');
    }, [user, router]);

    if (!user) return null;

    return (
        <DeviceManualListContent />
    );
}

const DeviceManualListContent = () => {
    const supabase = createClientComponentClient();
    const [manuals, setManuals] = useState<ManualItem[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    const isDraggingRef = useRef(false);
    const { confirm, ConfirmDialog } = useConfirm();

    const [isDownloading, setIsDownloading] = useState(false);

    const fetchManuals = async () => {
        try {
            const { data, error } = await supabase
                .from('device_manuals')
                .select('*')
                .order('display_order', { ascending: true })
                .order('updated_at', { ascending: false });

            if (error) throw error;
            if (data) {
                const mappedData: ManualItem[] = data.map(d => ({
                    id: d.id,
                    title: d.title,
                    files: d.files || [],
                    updatedAt: new Date(d.updated_at).toLocaleString('ja-JP')
                }));
                setManuals(mappedData);
            }
        } catch (error) {
            console.error('Error fetching manuals:', error);
        }
    };

    useEffect(() => {
        fetchManuals();
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 100,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const rowSensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                delay: 100,
                tolerance: 5,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 100,
                tolerance: 5,
            },
        })
    );

    const handleDragStart = () => {
        isDraggingRef.current = true;
    };

    const handleLinkClick = async (e: React.MouseEvent, url: string, fileName: string) => {
        if (isDraggingRef.current) {
            e.preventDefault();
            return;
        }

        e.preventDefault();
        if (isDownloading) return;

        try {
            setIsDownloading(true);
            const response = await fetch(url);
            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Download error:', error);
            showAlert('ダウンロードに失敗しました');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent, itemId: string) => {
        setTimeout(() => {
            isDraggingRef.current = false;
        }, 200);

        const { active, over } = event;

        if (over && active.id !== over.id) {
            const itemIndex = manuals.findIndex(m => m.id === itemId);
            if (itemIndex === -1) return;

            const item = manuals[itemIndex];
            const oldIndex = item.files.findIndex((_, matchIndex) => `${itemId}-${item.files[matchIndex].name}-${matchIndex}` === active.id);
            const newIndex = item.files.findIndex((_, matchIndex) => `${itemId}-${item.files[matchIndex].name}-${matchIndex}` === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newFiles = arrayMove(item.files, oldIndex, newIndex);

                const newManuals = [...manuals];
                newManuals[itemIndex] = { ...item, files: newFiles };
                setManuals(newManuals);

                try {
                    const { error } = await supabase
                        .from('device_manuals')
                        .update({
                            files: newFiles
                        })
                        .eq('id', itemId);

                    if (error) throw error;
                } catch (error) {
                    console.error('Failed to update order:', error);
                    fetchManuals();
                }
            }
        }
    };

    const handleRowDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = fragments.findIndex(f => `row-${f.id}` === active.id);
            const newIndex = fragments.findIndex(f => `row-${f.id}` === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const activeItemId = fragments[oldIndex].itemId;
                const overItemId = fragments[newIndex].itemId;

                if (activeItemId === overItemId) return;

                const oldManualIndex = manuals.findIndex(m => m.id === activeItemId);
                const newManualIndex = manuals.findIndex(m => m.id === overItemId);

                if (oldManualIndex !== -1 && newManualIndex !== -1) {
                    const newManuals = arrayMove(manuals, oldManualIndex, newManualIndex);
                    setManuals(newManuals);

                    try {
                        // Persist the new order by updating display_order for all items
                        await Promise.all(newManuals.map((manual, index) =>
                            supabase
                                .from('device_manuals')
                                .update({ display_order: index })
                                .eq('id', manual.id)
                        ));
                    } catch (err) {
                        console.error('Failed to update row order:', err);
                        fetchManuals();
                    }
                }
            }
        }
    };

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [dragActive, setDragActive] = useState(false);

    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');

    const showAlert = (message: string) => {
        setAlertMessage(message);
        setIsAlertOpen(true);
    };

    const allowedExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf', '.csv'];

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const validateFile = (file: File) => {
        const fileName = file.name.toLowerCase();
        const isValid = allowedExtensions.some(ext => fileName.endsWith(ext));
        if (!isValid) {
            showAlert(`許可されていないファイル形式です。\n許可のみ: ${allowedExtensions.join(', ')}`);
            return false;
        }
        return true;
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            const validFiles = files.filter(file => validateFile(file));
            if (validFiles.length > 0) {
                setSelectedFiles(prev => [...prev, ...validFiles]);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            const validFiles = files.filter(file => validateFile(file));
            if (validFiles.length > 0) {
                setSelectedFiles(prev => [...prev, ...validFiles]);
            }
        }
    };

    const handleRegister = async () => {
        if (!title || selectedFiles.length === 0) {
            showAlert('タイトルとファイルを入力してください');
            return;
        }

        const skippedFiles: string[] = [];
        const registeredFiles: string[] = [];
        let hasError = false;

        try {
            const targetItem = manuals.find(item => item.title.trim() === title.trim());
            let currentFiles: ManualFile[] = targetItem ? [...targetItem.files] : [];

            for (const file of selectedFiles) {
                // Check for duplicate filenames across ALL manuals
                const isDuplicate = manuals.some(item =>
                    item.files.some(f => f.name.toLowerCase() === file.name.toLowerCase())
                );

                // Also check against files being added in this batch
                const isDuplicateInBatch = registeredFiles.some(name => name.toLowerCase() === file.name.toLowerCase());

                if (isDuplicate || isDuplicateInBatch) {
                    skippedFiles.push(file.name);
                    continue;
                }

                const filePath = file.name;

                const { error: uploadError } = await supabase.storage
                    .from('manuals')
                    .upload(filePath, file);

                if (uploadError) {
                    console.error(`Upload error for ${file.name}:`, uploadError);
                    hasError = true;
                    continue;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('manuals')
                    .getPublicUrl(filePath);

                const newFile: ManualFile = {
                    name: file.name,
                    url: `${publicUrl}?download=${encodeURIComponent(file.name)}`
                };

                currentFiles.push(newFile);
                registeredFiles.push(file.name);
            }

            if (registeredFiles.length > 0) {
                if (targetItem) {
                    const { error: dbError } = await supabase
                        .from('device_manuals')
                        .update({
                            files: currentFiles,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', targetItem.id);

                    if (dbError) throw dbError;
                } else {
                    const { error: dbError } = await supabase
                        .from('device_manuals')
                        .insert({
                            title: title,
                            files: currentFiles,
                            updated_at: new Date().toISOString()
                        });

                    if (dbError) throw dbError;
                }

                await fetchManuals();

                for (const fileName of registeredFiles) {
                    // Manual log removed
                }
            }

            let message = '';
            if (registeredFiles.length > 0) {
                message += `${registeredFiles.length}件のファイルを登録しました。`;
            }
            if (skippedFiles.length > 0) {
                message += `\n以下のファイルは既に存在するためスキップされました:\n${skippedFiles.join('\n')}`;
            }
            if (hasError) {
                message += '\n一部のファイルのアップロードに失敗しました。';
            }

            if (message) showAlert(message);

            if (registeredFiles.length > 0 || skippedFiles.length > 0) {
                setIsAddModalOpen(false);
                setTitle('');
                setSelectedFiles([]);
            }

        } catch (error: any) {
            console.error('Error registering manual:', error);
            showAlert(`登録に失敗しました: ${error.message || JSON.stringify(error)}`);
        }
    };

    const handleDeleteFile = async (itemId: string, fileIndex: number) => {
        const confirmed = await confirm({
            title: '確認',
            description: 'このファイルを削除してもよろしいですか？',
            confirmText: 'Delete',
            variant: 'destructive',
        });

        if (!confirmed) return;

        try {
            const item = manuals.find(i => i.id === itemId);
            if (!item) return;

            const deletedFile = item.files[fileIndex];

            const urlObj = new URL(deletedFile.url);
            const pathParts = urlObj.pathname.split('/');
            const storageFileName = decodeURIComponent(pathParts[pathParts.length - 1]);

            if (storageFileName) {
                const { error: storageError } = await supabase.storage
                    .from('manuals')
                    .remove([storageFileName]);
                if (storageError) {
                    throw new Error(`ストレージファイルの削除に失敗しました: ${storageError.message}`);
                }
            }

            const newFiles = item.files.filter((_, index) => index !== fileIndex);

            if (newFiles.length === 0) {
                const { error } = await supabase
                    .from('device_manuals')
                    .delete()
                    .eq('id', itemId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('device_manuals')
                    .update({
                        files: newFiles,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', itemId);
                if (error) throw error;
            }

            fetchManuals();

            const deletedFileName = item.files[fileIndex]?.name || '不明なファイル';

        } catch (error: any) {
            console.error('Error deleting file:', error);
            showAlert(`削除に失敗しました: ${error.message || JSON.stringify(error)}`);
        }
    };

    // --- Grouping and Pagination Logic ---

    // Group manuals by title
    const groupedManuals = manuals.reduce((acc, item) => {
        const titleKey = item.title.trim();
        if (!acc[titleKey]) {
            acc[titleKey] = {
                id: item.id,
                itemId: item.id,
                title: item.title,
                files: [],
                updatedAt: item.updatedAt,
                allIds: [item.id]
            };
        } else {
            acc[titleKey].allIds.push(item.id);
            // Keep the latest timestamp
            if (new Date(item.updatedAt) > new Date(acc[titleKey].updatedAt)) {
                acc[titleKey].updatedAt = item.updatedAt;
            }
        }

        // Add files from this item, avoiding exact duplicates in the merged list
        item.files.forEach((f, i) => {
            const isAlreadyAdded = acc[titleKey].files.some(existing =>
                existing.name === f.name && existing.url === f.url
            );
            if (!isAlreadyAdded) {
                acc[titleKey].files.push({
                    ...f,
                    originalIndex: i,
                    parentId: item.id
                });
            }
        });

        return acc;
    }, {} as Record<string, TitleFragment & { allIds: string[] }>);

    // Reconstruct sortedGroups based on the order of 'manuals'
    const uniqueTitles = Array.from(new Set(manuals.map(m => m.title.trim())));
    const sortedGroups = uniqueTitles.map(title => groupedManuals[title]).filter(Boolean);

    // Flatten to identify individual files across all groups for precise pagination
    const allFilesFlattened = sortedGroups.flatMap(g =>
        g.files.map(f => ({
            ...f,
            title: g.title,
            updatedAt: g.updatedAt,
            itemId: (f as any).parentId || g.itemId
        }))
    );

    const totalItemsCount = allFilesFlattened.length;
    const totalPages = Math.ceil(totalItemsCount / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItemsCount);

    const paginatedFiles = allFilesFlattened.slice(startIndex, endIndex);

    // Re-group only the paginated files for display
    const fragments: TitleFragment[] = [];
    paginatedFiles.forEach((file, idx) => {
        const last = fragments[fragments.length - 1];
        if (last && last.itemId === file.itemId) {
            last.files.push(file as any);
        } else {
            fragments.push({
                id: `${file.itemId}-${startIndex + idx}`,
                itemId: file.itemId,
                title: file.title,
                files: [file as any],
                updatedAt: file.updatedAt
            });
        }
    });

    const fileStartIndex = startIndex;
    const fileEndIndex = endIndex;
    const totalFiles = totalItemsCount;

    const handlePageChange = (page: number) => {
        const p = Math.max(1, Math.min(page, totalPages));
        setCurrentPage(p);
    };

    return (
        <div className="space-y-4 h-full flex flex-col relative">
            <PageHeader
                title="マニュアル管理"
                actions={
                    <ActionButton onClick={() => setIsAddModalOpen(true)} icon={Plus} variant="primary">
                        ファイル追加
                    </ActionButton>
                }
            />

            <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-800">
                <p><strong>Note:</strong> マニュアルをダウンロードするには、ファイル名をクリックしてください。</p>
            </div>

            <div className="flex-1 bg-paper rounded-lg shadow-sm border border-border overflow-hidden flex flex-col">
                <DndContext
                    sensors={rowSensors}
                    collisionDetection={closestCenter}
                    onDragStart={() => (isDraggingRef.current = true)}
                    onDragEnd={(e) => {
                        isDraggingRef.current = false;
                        handleRowDragEnd(e);
                    }}
                >
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-background-subtle">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-ink-light uppercase tracking-wider w-1/3">タイトル</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-ink-light uppercase tracking-wider w-1/2">ファイル名</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-ink-light uppercase tracking-wider w-1/6">更新日時</th>
                            </tr>
                        </thead>
                        <SortableContext
                            items={fragments.map(f => `row-${f.id}`)}
                            strategy={verticalListSortingStrategy}
                        >
                            <tbody className="bg-white divide-y divide-border">
                                {fragments.map((fragment) => (
                                    <DraggableRow
                                        key={fragment.id}
                                        fragment={fragment}
                                        sensors={sensors}
                                        closestCenter={closestCenter}
                                        handleDragStart={handleDragStart}
                                        handleDragEnd={handleDragEnd}
                                        handleDeleteFile={handleDeleteFile}
                                        handleLinkClick={handleLinkClick}
                                    />
                                ))}
                                {fragments.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-10 text-center text-ink-lighter italic">
                                            表示するマニュアルがありません
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </SortableContext>
                    </table>
                </DndContext>
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalFiles}
                startIndex={fileStartIndex}
                endIndex={fileEndIndex}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                }}
            />


            <Modal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="ファイル追加"
            >
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-ink mb-1">タイトル</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-electric/50"
                            placeholder="デバイス名などを入力"
                        />
                    </div>

                    {selectedFiles.length === 0 ? (
                        <div
                            className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${dragActive ? 'border-accent-electric bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('manual-file-upload')?.click()}
                        >
                            <input
                                type="file"
                                id="manual-file-upload"
                                className="hidden"
                                onChange={handleChange}
                                accept={allowedExtensions.join(',')}
                                multiple
                            />
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3 text-blue-600">
                                <Upload size={24} />
                            </div>
                            <p className="font-medium text-ink mb-1">ソースをアップロード</p>
                            <p className="text-sm text-ink-light mb-4">
                                ドラッグ＆ドロップまたは<span className="text-blue-600 font-medium hover:underline">ファイルを選択</span>してアップロード
                            </p>
                            <p className="text-xs text-ink-lighter max-w-xs mx-auto">
                                サポートされているファイル形式: PDF, Word, Excel, PowerPoint, CSV
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {selectedFiles.map((file, index) => (
                                <div key={`${file.name}-${index}`} className="border border-border rounded-lg p-3 flex items-center justify-between bg-gray-50">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-8 h-8 bg-white border border-border rounded flex items-center justify-center text-blue-600 flex-shrink-0">
                                            <FileText size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-ink truncate text-sm">{file.name}</p>
                                            <p className="text-xs text-ink-light">{(file.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => document.getElementById('manual-file-upload')?.click()}
                                className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={16} />
                                ファイルを追加
                            </button>
                            <input
                                type="file"
                                id="manual-file-upload"
                                className="hidden"
                                onChange={handleChange}
                                accept={allowedExtensions.join(',')}
                                multiple
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <ActionButton onClick={() => setIsAddModalOpen(false)}>
                            キャンセル
                        </ActionButton>
                        <ActionButton variant="primary" onClick={handleRegister} disabled={!title || selectedFiles.length === 0}>
                            登録
                        </ActionButton>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isAlertOpen}
                onClose={() => setIsAlertOpen(false)}
                title="通知"
                maxWidth="max-w-sm"
            >
                <div className="flex flex-col items-center gap-4 py-2">
                    <p className="text-ink text-center whitespace-pre-line">{alertMessage}</p>
                    <ActionButton variant="primary" onClick={() => setIsAlertOpen(false)}>
                        OK
                    </ActionButton>
                </div>
            </Modal>

            {isDownloading && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/50 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-10 w-10 bg-[#0EA5E9] rounded-lg shadow-lg border-2 border-[#0A0E27] animate-pulse"></div>
                        <span className="text-[#0A0E27] font-bold">データを読み込み中...</span>
                    </div>
                </div>
            )}

            <ConfirmDialog />
        </div>
    );
};
