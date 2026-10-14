import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

function getInitialTheme() {
  try {
    const stored = localStorage.getItem('ia-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable
  }
  return null; // null = follow system
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === null) {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(current => {
      // Determine effective current theme
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const effective = current ?? (systemDark ? 'dark' : 'light');
      const next = effective === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('ia-theme', next);
      } catch {
        // Storage unavailable; continue without persisting
      }
      return next;
    });
  };

  const setExplicitTheme = (value) => {
    setTheme(value);
    try {
      if (value === null) {
        localStorage.removeItem('ia-theme');
      } else {
        localStorage.setItem('ia-theme', value);
      }
    } catch {
      // ignore
    }
  };

  // Derive the effective theme for consumers that need to know
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const effectiveTheme = theme ?? (systemPrefersDark ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, toggleTheme, setTheme: setExplicitTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
