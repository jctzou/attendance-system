import React from 'react'

interface PageContainerProps {
    children: React.ReactNode
    title?: string
    description?: string
    action?: React.ReactNode
    className?: string
}

export const PageContainer: React.FC<PageContainerProps> = ({
    children,
    title,
    description,
    action,
    className = ''
}) => {
    return (
        <div className={`w-full max-w-7xl mx-auto ${className}`}>
            {/* Page Header */}
            {(title || action) && (
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        {title && (
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white tracking-tight page-title">
                                {title}
                            </h1>
                        )}
                        {description && (
                            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                                {description}
                            </p>
                        )}
                    </div>
                    {action && (
                        <div className="flex-shrink-0">
                            {action}
                        </div>
                    )}
                </div>
            )}

            {/* Content */}
            <div className="w-full">
                {children}
            </div>
        </div>
    )
}
