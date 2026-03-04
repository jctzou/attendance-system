import React from 'react'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={`animate-pulse rounded-md bg-slate-300 dark:bg-neutral-700 ${className || ''}`}
            {...props}
        />
    )
}
