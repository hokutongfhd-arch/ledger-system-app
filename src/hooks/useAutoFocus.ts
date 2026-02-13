
import { useRef, RefObject, useEffect } from 'react';

type InputRef = { current: HTMLInputElement | null };

export const useAutoFocus = (initialFocusRef?: RefObject<HTMLInputElement | null>) => {
    // Focus on mount if initialFocusRef is provided
    useEffect(() => {
        if (initialFocusRef?.current) {
            initialFocusRef.current.focus();
        }
    }, [initialFocusRef]);

    // Helper to move focus to next ref if max length reached
    const handleAutoTab = (
        e: React.ChangeEvent<HTMLInputElement>,
        maxLength: number,
        nextRef: InputRef | null
    ) => {
        const { value } = e.target;
        if (value.length >= maxLength && nextRef?.current) {
            nextRef.current.focus();
        }
    };

    return { handleAutoTab };
};
