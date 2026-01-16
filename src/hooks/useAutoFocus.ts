
import { useRef, RefObject } from 'react';

type InputRef = { current: HTMLInputElement | null };

export const useAutoFocus = () => {
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
