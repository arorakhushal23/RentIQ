import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

const ThemeContext = createContext();

const THEME_STORAGE_KEY = 'rentiq-theme';

function getInitialTheme() {
    try {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme === 'light' || savedTheme === 'dark') {
            return savedTheme;
        }

        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
    } catch (error) {
        console.warn('Unable to access localStorage for theme preference:', error);
    }
    return 'light';
}

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(getInitialTheme);
    const transitionTimerRef = useRef(null);

    const applyThemeToDocument = useCallback((newTheme, withTransition = false) => {
        const root = document.documentElement;

        if (withTransition) {
            root.classList.add('theme-transitioning');
            if (transitionTimerRef.current) {
                window.clearTimeout(transitionTimerRef.current);
            }
            transitionTimerRef.current = window.setTimeout(() => {
                root.classList.remove('theme-transitioning');
            }, 300);
        }

        root.setAttribute('data-theme', newTheme);
        root.style.colorScheme = newTheme;
    }, []);

    const setTheme = useCallback((newTheme) => {
        if (newTheme !== 'light' && newTheme !== 'dark') return;

        setThemeState(newTheme);
        applyThemeToDocument(newTheme, true);

        try {
            localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        } catch (error) {
            console.warn('Unable to save theme preference to localStorage:', error);
        }
    }, [applyThemeToDocument]);

    const toggleTheme = useCallback(() => {
        const nextTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
    }, [theme, setTheme]);

    useEffect(() => {
        // Initial application without transition to prevent initial flash
        applyThemeToDocument(theme, false);

        // Optional listener for system theme changes when user has not explicitly set a theme in localStorage
        try {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = (e) => {
                const saved = localStorage.getItem(THEME_STORAGE_KEY);
                if (!saved) {
                    const systemTheme = e.matches ? 'dark' : 'light';
                    setThemeState(systemTheme);
                    applyThemeToDocument(systemTheme, true);
                }
            };

            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        } catch {
            // MatchMedia listener not supported or failed
        }
    }, [theme, applyThemeToDocument]);

    return (
        <ThemeContext.Provider
            value={{
                theme,
                setTheme,
                toggleTheme,
                isDarkMode: theme === 'dark',
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

export default ThemeProvider;
