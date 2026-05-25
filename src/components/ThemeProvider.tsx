import { createContext, useContext, useEffect, useState } from "react"

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

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
    children,
    defaultTheme = "system",
    defaultScale = 1,
    storageKey = "vite-ui-theme",
    scaleStorageKey = "vite-ui-scale",
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
    )

    const [scale, setScale] = useState<number>(
        () => {
            const storedScale = localStorage.getItem(scaleStorageKey);
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

    const value = {
        theme,
        setTheme: (theme: Theme) => {
            localStorage.setItem(storageKey, theme)
            setTheme(theme)
        },
        scale,
        setScale: (scale: number) => {
            localStorage.setItem(scaleStorageKey, String(scale))
            setScale(scale)
        }
    }

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
