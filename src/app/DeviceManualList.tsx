
import { useState, useEffect, useRef } from 'react';
import { useData } from '../features/context/DataContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Table } from '../components/ui/Table';
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

export const DeviceManualList = () => {
    // Initial mock data
    const [manuals, setManuals] = useState<ManualItem[]>([]);
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
                // Map DB columns to ManualItem interface
                const mappedData: ManualItem[] = data.map(d => ({
                    id: d.id,
                    title: d.title,
                    files: d.files || [],
                    updatedAt: new Date(d.updated_at).toLocaleDateString()
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
                // Require drag distance of 5px to start drag, allowing clicks for download
                distance: 5,
            },
        }),
        useSensor(TouchSensor, {
            // For touch devices, delay 250ms (long press) to start drag
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
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
            // Extract indices from IDs (composite id: itemId - fileName - index) helps but using index directly in id is risky if array changes.
            // Better: map sortable items to unique IDs. 
            // Here, let's assume valid ID matching. we need to find index based on the sortable ID strategy.

            // Strategy: The SortableContext items will be the file objects themselves (if they had IDs) or we assign temporary IDs.
            // Simplest: Use index as ID suffix.

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
                    // Revert on fail? (omitted for brevity)
                    fetchManuals();
                }
            }
        }
    };

    const [isAppModalOpen, setIsAddModalOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (validateFile(file)) {
                setSelectedFile(file);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (validateFile(file)) {
                setSelectedFile(file);
            }
        }
    };

    const handleRegister = async () => {
        if (!title || !selectedFile) {
            showAlert('タイトルとファイルを入力してください');
            return;
        }

        // Check for duplicates
        // Check for duplicates globally
        const isDuplicate = manuals.some(item => item.files.some(f => f.name === selectedFile.name));
        if (isDuplicate) {
            showAlert('同じ名前のファイルが既に存在します。');
            return;
        }

        try {
            // 1. Upload file to Supabase Storage
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('manuals')
                .upload(filePath, selectedFile);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('manuals')
                .getPublicUrl(filePath);

            const newFile: ManualFile = {
                name: selectedFile.name,
                url: `${publicUrl}?download=${encodeURIComponent(selectedFile.name)}`
            };

            // 3. Update DB
            const existingItem = manuals.find(item => item.title === title);

            if (existingItem) {
                // Update existing record
                const updatedFiles = [...existingItem.files, newFile];
                const { error: dbError } = await supabase
                    .from('device_manuals')
                    .update({
                        files: updatedFiles,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingItem.id);

                if (dbError) throw dbError;
            } else {
                // Insert new record
                const { error: dbError } = await supabase
                    .from('device_manuals')
                    .insert({
                        title: title,
                        files: [newFile],
                        updated_at: new Date().toISOString()
                    });

                if (dbError) throw dbError;
            }

            // 4. Refresh List
            await fetchManuals();

            // Log the action
            await addLog('manuals', 'add', `ファイル追加: ${selectedFile.name} (${title})`);

            setIsAddModalOpen(false);
            setTitle('');
            setSelectedFile(null);

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
                <Table<ManualItem>
                    data={manuals}
                    columns={[
                        { header: 'タイトル', accessor: 'title', className: 'w-1/3 font-medium text-ink' },
                        {
                            header: 'ファイル名',
                            accessor: (item) => (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragStart={handleDragStart}
                                    onDragEnd={(e) => handleDragEnd(e, item.id)}
                                >
                                    <SortableContext
                                        items={item.files.map((f, idx) => `${item.id}-${f.name}-${idx}`)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="flex flex-col gap-1">
                                            {item.files.map((file, index) => (
                                                <SortableFileItem
                                                    key={`${item.id}-${file.name}-${index}`}
                                                    file={file}
                                                    fileIndex={index}
                                                    itemId={item.id}
                                                    onDelete={handleDeleteFile}
                                                    onLinkClick={handleLinkClick}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            ),
                            className: 'w-1/2'
                        },
                        { header: '更新日時', accessor: 'updatedAt', className: 'w-1/6 text-ink-light' },
                    ]}
                />
            </div>

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

                    {!selectedFile ? (
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
                        <div className="border border-border rounded-lg p-4 flex items-center justify-between bg-gray-50">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-10 h-10 bg-white border border-border rounded flex items-center justify-center text-blue-600 flex-shrink-0">
                                    <FileText size={20} />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-medium text-ink truncate">{selectedFile.name}</p>
                                    <p className="text-xs text-ink-light">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedFile(null)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <ActionButton onClick={() => setIsAddModalOpen(false)}>
                            キャンセル
                        </ActionButton>
                        <ActionButton variant="primary" onClick={handleRegister} disabled={!title || !selectedFile}>
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
