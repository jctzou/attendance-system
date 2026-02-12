'use client'

import { useTheme } from './ThemeProvider'
import { Button } from './ui/Button'

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={`目前模式: ${theme === 'system' ? '系統' : theme === 'dark' ? '深色' : '淺色'}`}
            className="w-10 h-10 p-0 rounded-full"
        >
            <span className="material-symbols-outlined text-[1.2rem]">
                {theme === 'dark' ? 'dark_mode' : 'light_mode'}
            </span>
        </Button>
    )
}
