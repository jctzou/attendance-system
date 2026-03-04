import React from 'react'

interface LoadingSpinnerProps {
    message?: string;
    fullScreen?: boolean;
}

export function LoadingSpinner({ message = '載入中...', fullScreen = false }: LoadingSpinnerProps) {
    const content = (
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <div className="w-10 h-10 border-4 border-slate-200 dark:border-neutral-700 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
            {message && <div className="text-slate-500 font-medium text-sm animate-pulse">{message}</div>}
        </div>
    )

    if (fullScreen) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm z-[9999]">
                {content}
            </div>
        )
    }

    return content
}
