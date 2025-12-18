import { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { useData } from '../features/context/DataContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { Download, Plus, Upload, X, FileText, Trash2 } from 'lucide-react';
import { ActionButton } from '../components/ui/ActionButton';
import { Modal } from '../components/ui/Modal';
import { supabase } from '../lib/supabaseClient';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


interface ManualFile {
    name: string;
    url: string;
}

interface ManualItem {
    id: string;
    title: string;
    files: ManualFile[];
    updatedAt: string;
}

interface TitleFragment {
    id: string; // Unique for Table row
    itemId: string;
    title: string;
    files: Array<ManualFile & { originalIndex: number }>;
    updatedAt: string;
}

// Sortable Item Component
const SortableFileItem = ({ file, fileIndex, itemId, onDelete, onLinkClick }: { file: ManualFile, fileIndex: number, itemId: string, onDelete: (itemId: string, index: number) => void, onLinkClick: (e: React.MouseEvent) => void }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: `${itemId}-${file.name}-${fileIndex}` });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1000 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    const pointerDownTimeRef = useRef<number>(0);

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex items-center gap-2 group w-fit touch-none my-1">
            <a
                href={file.url}
                download={file.name}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline cursor-grab active:cursor-grabbing"
                onPointerDown={() => {
                    pointerDownTimeRef.current = Date.now();
                }}
                onClick={(e) => {
                    if (Date.now() - pointerDownTimeRef.current > 200) {
                        e.preventDefault();
                        return;
                    }
                    onLinkClick(e);
                }}
            >
                <span className="truncate">{file.name}</span>
                <Download size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
            <button
                onClick={(e) => {
                    e.stopPropagation(); // Prevent drag start when clicking delete
                    onDelete(itemId, fileIndex);
                }}
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
    handleLinkClick: (e: React.MouseEvent) => void
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
            {...attributes}
            {...listeners}
            className={clsx(
                "transition-colors touch-none cursor-grab active:cursor-grabbing",
                isDragging ? "bg-accent-electric/20 shadow-lg z-50" : "hover:bg-accent-electric/5"
            )}
        >
            <td className="px-6 py-4 text-sm font-medium text-ink align-top">
                {fragment.title}
            </td>
            <td className="px-6 py-4 text-sm text-ink-light whitespace-normal">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={(e) => handleDragEnd(e, fragment.itemId)}
                >
                    <SortableContext
                        items={fragment.files.map((f) => `${fragment.itemId}-${f.name}-${f.originalIndex}`)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="flex flex-col gap-1">
                            {fragment.files.map((file) => (
                                <SortableFileItem
                                    key={`${fragment.itemId}-${file.name}-${file.originalIndex}`}
                                    file={{ name: file.name, url: file.url }}
                                    fileIndex={file.originalIndex}
                                    itemId={fragment.itemId}
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

export const DeviceManualList = () => {
    // Initial mock data
    const [manuals, setManuals] = useState<ManualItem[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const isDraggingRef = useRef(false);
    const { addLog } = useData();

    const fetchManuals = async () => {
        try {
            const { data, error } = await supabase
                .from('device_manuals')
                .select('*')
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

    // Sensors for row-level sorting (Long press for 100ms)
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

    const handleLinkClick = (e: React.MouseEvent) => {
        if (isDraggingRef.current) {
            e.preventDefault();
        }
    };

    const handleDragEnd = async (event: DragEndEvent, itemId: string) => {
        // Delay resetting isDraggingRef to prevent immediate click after drag
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

                // Optimistic UI update
                const newManuals = [...manuals];
                newManuals[itemIndex] = { ...item, files: newFiles };
                setManuals(newManuals);

                // Update DB
                try {
                    const { error } = await supabase
                        .from('device_manuals')
                        .update({
                            files: newFiles,
                            updated_at: new Date().toISOString()
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

                if (activeItemId === overItemId) return; // Same item fragments

                // Get original manuals order
                const oldManualIndex = manuals.findIndex(m => m.id === activeItemId);
                const newManualIndex = manuals.findIndex(m => m.id === overItemId);

                if (oldManualIndex !== -1 && newManualIndex !== -1) {
                    const newManuals = arrayMove(manuals, oldManualIndex, newManualIndex);
                    setManuals(newManuals);

                    // Perspective Persistence: Use timestamp trick
                    // We want to update the dragged item's updated_at to be between its new neighbors
                    // To simplify, let's just swap or set to current time if moved to top.
                    // For now, update the DB with current timestamp to move to top, 
                    // or we could implement a proper sort_order if the schema supported it.
                    // Here we'll just update updated_at of the moved item.
                    try {
                        const { error } = await supabase
                            .from('device_manuals')
                            .update({ updated_at: new Date().toISOString() })
                            .eq('id', activeItemId);
                        if (error) throw error;
                    } catch (err) {
                        console.error('Failed to update row order:', err);
                        fetchManuals();
                    }
                }
            }
        }
    };

    const [isAppModalOpen, setIsAddModalOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [dragActive, setDragActive] = useState(false);

    // Alert Modal State
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
            // 現在の対象レコードを特定
            let targetItem = manuals.find(item => item.title === title);
            let currentFiles: ManualFile[] = targetItem ? [...targetItem.files] : [];

            for (const file of selectedFiles) {
                // データベース全体、または現在のアイテム内での重複チェック
                // 仕様: データベース全体で同名のファイルがあればスキップ
                const isDuplicate = manuals.some(item => item.files.some(f => f.name === file.name));

                if (isDuplicate) {
                    skippedFiles.push(file.name);
                    continue;
                }

                // 1. Upload file to Supabase Storage
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('manuals')
                    .upload(filePath, file);

                if (uploadError) {
                    console.error(`Upload error for ${file.name}:`, uploadError);
                    hasError = true;
                    continue;
                }

                // 2. Get Public URL
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
                // 3. Update DB (Final state after processing all selected files)
                if (targetItem) {
                    // Update existing record
                    const { error: dbError } = await supabase
                        .from('device_manuals')
                        .update({
                            files: currentFiles,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', targetItem.id);

                    if (dbError) throw dbError;
                } else {
                    // Insert new record
                    const { error: dbError } = await supabase
                        .from('device_manuals')
                        .insert({
                            title: title,
                            files: currentFiles,
                            updated_at: new Date().toISOString()
                        });

                    if (dbError) throw dbError;
                }

                // 4. Refresh List
                await fetchManuals();

                // Log the action
                for (const fileName of registeredFiles) {
                    await addLog('manuals', 'add', `ファイル追加: ${fileName} (${title})`);
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
        if (!window.confirm('このファイルを削除してもよろしいですか？')) {
            return;
        }

        try {
            const item = manuals.find(i => i.id === itemId);
            if (!item) return;

            const newFiles = item.files.filter((_, index) => index !== fileIndex);

            if (newFiles.length === 0) {
                // Delete record if no files left
                const { error } = await supabase
                    .from('device_manuals')
                    .delete()
                    .eq('id', itemId);
                if (error) throw error;
            } else {
                // Update record with remaining files
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

            // Log the action (find item title for details)
            const deletedFileName = item.files[fileIndex]?.name || '不明なファイル';
            await addLog('manuals', 'delete', `ファイル削除: ${deletedFileName} (${item.title})`);

        } catch (error) {
            console.error('Error deleting file:', error);
            showAlert('削除に失敗しました');
        }
    };

    // Pagination Logic: ファイル数ベースで計算
    const allFilesFlattened = manuals.flatMap(item =>
        item.files.map((file, index) => ({
            ...file,
            itemId: item.id,
            title: item.title,
            updatedAt: item.updatedAt,
            originalIndex: index
        }))
    );

    const totalItems = allFilesFlattened.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);

    // 現在のページに含まれるファイルのリスト
    const paginatedFiles = allFilesFlattened.slice(startIndex, endIndex);

    // ファイルのリストをタイトルごとにグループ化（TitleFragmentの作成）
    const fragments: TitleFragment[] = [];
    paginatedFiles.forEach((file) => {
        const lastFragment = fragments[fragments.length - 1];
        if (lastFragment && lastFragment.itemId === file.itemId) {
            // 同じタイトルの継続なら既存のフラグメントに追加
            lastFragment.files.push({ name: file.name, url: file.url, originalIndex: file.originalIndex });
        } else {
            // 新しいタイトル、または別のタイトルの後の同じタイトルの場合は新フラグメント
            fragments.push({
                id: `${file.itemId}-${file.originalIndex}`,
                itemId: file.itemId,
                title: file.title,
                files: [{ name: file.name, url: file.url, originalIndex: file.originalIndex }],
                updatedAt: file.updatedAt
            });
        }
    });

    const handlePageChange = (page: number) => {
        const p = Math.max(1, Math.min(page, totalPages));
        setCurrentPage(p);
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <PageHeader
                title="機器一覧"
                actions={
                    <ActionButton onClick={() => setIsAddModalOpen(true)} icon={Plus} variant="primary">
                        ファイル追加
                    </ActionButton>
                }
            />

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
                                            表示する機器がありません
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
                totalItems={totalItems}
                startIndex={startIndex}
                endIndex={endIndex}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                }}
            />

            <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-800">
                <p><strong>Note:</strong> マニュアルをダウンロードするには、ファイル名をクリックしてください。</p>
            </div>

            <Modal
                isOpen={isAppModalOpen}
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

            {/* Error/Alert Modal */}
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
        </div>
    );
};
