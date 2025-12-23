import { useState, useCallback, ReactNode } from 'react';

// Note: Assuming Shadcn UI AlertDialog exists or needs to be created.
// If not, I will implement a basic custom one using the existing Modal or Dialog.
// For now, let's look at the existing `Modal.tsx`. 
// To allow consistent UI without needing new Shadcn components if they don't exist,
// I'll implement a simple one using the custom Modal OR the Radix Dialog.

// Let's use the standard Radix/Shadcn Dialog we saw earlier (src/components/ui/dialog.tsx).
// But for *Alert* specifically, usually standard Dialog is fine with styling.
// However, to be safe and dependent only on what we saw, I'll use the `Modal` from `src/components/ui/Modal.tsx`
// which seemed to be a custom implementation. OR better, `dialog.tsx` which is Radix.
// The `dialog.tsx` is more "standard" in this codebase style (shadcn).

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmOptions {
    title: string;
    description: ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
}

export const useConfirm = () => {
    const [open, setOpen] = useState(false);
    const [config, setConfig] = useState<ConfirmOptions>({
        title: '',
        description: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        variant: 'default'
    });

    // We need to store the resolve function to call it when user interactions occur
    const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        setConfig({
            confirmText: 'OK',
            cancelText: 'Cancel',
            variant: 'default',
            ...options
        });
        setOpen(true);

        return new Promise<boolean>((resolve) => {
            setResolver(() => resolve);
        });
    }, []);

    const handleConfirm = () => {
        setOpen(false);
        if (resolver) resolver(true);
    };

    const handleCancel = () => {
        setOpen(false);
        if (resolver) resolver(false);
    };

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) handleCancel();
    };

    const ConfirmDialog = () => (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{config.title}</DialogTitle>
                    <DialogDescription>
                        {config.description}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                    {config.cancelText && (
                        <Button variant="outline" onClick={handleCancel}>
                            {config.cancelText}
                        </Button>
                    )}
                    <Button
                        variant={config.variant === 'destructive' ? 'destructive' : 'default'}
                        onClick={handleConfirm}
                    >
                        {config.confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    return { confirm, ConfirmDialog };
};
