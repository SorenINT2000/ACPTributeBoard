import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemePreference = 'light' | 'dark' | 'auto';
type EffectiveTheme = 'light' | 'dark';

interface ThemeContextType {
    theme: ThemePreference;
    effectiveTheme: EffectiveTheme;
    setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'auto',
    effectiveTheme: 'light',
    setTheme: () => {},
});

const STORAGE_KEY = 'theme';

function getStoredTheme(): ThemePreference {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
    return 'auto';
}

function getSystemTheme(): EffectiveTheme {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(preference: ThemePreference): EffectiveTheme {
    return preference === 'auto' ? getSystemTheme() : preference;
}

function applyTheme(effective: EffectiveTheme) {
    document.documentElement.setAttribute('data-bs-theme', effective);
    document.documentElement.style.colorScheme = effective;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemePreference>(getStoredTheme);
    const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>(() => resolveTheme(getStoredTheme()));

    const setTheme = useCallback((next: ThemePreference) => {
        localStorage.setItem(STORAGE_KEY, next);
        setThemeState(next);
        const resolved = resolveTheme(next);
        setEffectiveTheme(resolved);
        applyTheme(resolved);
    }, []);

    useEffect(() => {
        applyTheme(effectiveTheme);
    }, [effectiveTheme]);

    useEffect(() => {
        if (theme !== 'auto') return;

        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            const resolved = resolveTheme('auto');
            setEffectiveTheme(resolved);
            applyTheme(resolved);
        };
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
