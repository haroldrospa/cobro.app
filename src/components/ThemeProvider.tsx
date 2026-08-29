import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    defaultScale?: number
    storageKey?: string
    scaleStorageKey?: string
}

type ThemeProviderState = {
    theme: Theme
    setTheme: (theme: Theme) => void
    scale: number
    setScale: (scale: number) => void
}

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
    scale: 1,
    setScale: () => null,
}

const safeGetItem = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
};

const safeSetItem = (key: string, value: string): void => {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        // Ignore exception silently
    }
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
    children,
    defaultTheme = "system",
    defaultScale = 1,
    storageKey = "vite-ui-theme",
    scaleStorageKey = "vite-ui-scale",
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(
        () => (safeGetItem(storageKey) as Theme) || defaultTheme
    )

    const [scale, setScale] = useState<number>(
        () => {
            const storedScale = safeGetItem(scaleStorageKey);
            return storedScale ? parseFloat(storedScale) : defaultScale;
        }
    )

    useEffect(() => {
        const root = window.document.documentElement

        root.classList.remove("light", "dark")

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
                .matches
                ? "dark"
                : "light"

            root.classList.add(systemTheme)
            return
        }

        root.classList.add(theme)
    }, [theme])

    useEffect(() => {
        const root = window.document.documentElement;
        // Apply scale as a percentage of the base font size (16px standard)
        // 1 = 100%, 0.9 = 90%, 1.1 = 110%
        // Using font-size percentage is better for accessibility and rem-based layouts (Tailwind)
        root.style.fontSize = `${scale * 100}%`;
    }, [scale]);

    // Memoizado — sin esto, `value` (y las dos funciones de adentro) eran
    // literales nuevos en cada render de este provider, que envuelve TODA la
    // app. Cualquier efecto/memo que use theme/setTheme como dependencia se
    // invalidaba de más aunque el tema no hubiera cambiado.
    const handleSetTheme = useCallback((newTheme: Theme) => {
        safeSetItem(storageKey, newTheme)
        setTheme(newTheme)
    }, [storageKey])

    const handleSetScale = useCallback((newScale: number) => {
        safeSetItem(scaleStorageKey, String(newScale))
        setScale(newScale)
    }, [scaleStorageKey])

    const value = useMemo(() => ({
        theme,
        setTheme: handleSetTheme,
        scale,
        setScale: handleSetScale
    }), [theme, handleSetTheme, scale, handleSetScale])

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext)

    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider")

    return context
}
