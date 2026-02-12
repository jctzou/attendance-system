import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    className?: string
    padding?: string
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    padding = 'p-6',
    ...props
}) => {
    return (
        <div
            className={`
            bg-[var(--color-card-light)] dark:bg-[var(--color-card-dark)]
            rounded-[var(--radius-xl)]
            shadow-sm hover:shadow-md transition-shadow duration-300
            border border-slate-100 dark:border-slate-800
            ${padding}
            ${className}
            card-root
        `}
            {...props}
        >
            {children}
        </div>
    )
}

export const CardHeader: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <div className={`mb-4 flex items-center justify-between ${className}`}>
        {children}
    </div>
)

export const CardTitle: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 ${className}">
        {children}
    </h3>
)
