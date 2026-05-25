import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for debouncing values
 * Delays updating the debounced value until after the user stops typing
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        // Set up the timeout
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Clear timeout if value changes (or on unmount)
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Hook for throttling function calls
 * Ensures a function is called at most once per specified interval
 * @param callback - Function to throttle
 * @param delay - Minimum time between calls in milliseconds
 */
export function useThrottle<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 300
): T {
    const lastRun = useRef(Date.now());

    return ((...args) => {
        const now = Date.now();
        if (now - lastRun.current >= delay) {
            lastRun.current = now;
            return callback(...args);
        }
    }) as T;
}
