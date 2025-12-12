import { Modal } from './Modal';

interface DetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    data: any;
    labels: Record<string, string>;
}

export const DetailModal = ({ isOpen, onClose, title, data, labels }: DetailModalProps) => {
    if (!data) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="space-y-4">
                <dl className="space-y-3">
                    {Object.entries(labels).map(([key, label]) => {
                        const value = (data as any)[key];
                        return (
                            <div key={key} className="border-b border-gray-100 pb-2 last:border-0">
                                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
                                <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                                    {value !== undefined && value !== null && value !== '' ? String(value) : '-'}
                                </dd>
                            </div>
                        );
                    })}
                </dl>
            </div>
            <div className="mt-6 flex justify-end">
                <button
                    onClick={onClose}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
                >
                    閉じる
                </button>
            </div>
        </Modal>
    );
};
