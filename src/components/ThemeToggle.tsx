import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
      title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      onClick={(event) => toggleTheme(event)}
      className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 sm:h-9 sm:w-16 ${
        isDark
          ? 'border-slate-600 bg-slate-700 hover:bg-slate-600'
          : 'border-slate-300 bg-slate-200 hover:bg-slate-300'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] sm:h-7 sm:w-7 ${
          isDark
            ? 'translate-x-6 bg-slate-900 text-amber-300 shadow-amber-400/20 sm:translate-x-7'
            : 'translate-x-0 bg-white text-amber-500 shadow-amber-500/30'
        }`}
      >
        {isDark ? <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
      </span>
      <span className="sr-only">Changer de thème</span>
    </button>
  );
};
