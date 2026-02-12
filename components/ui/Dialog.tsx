'use client'

import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface DialogProps {
    isOpen: boolean
    onClose: () => void
    children: React.ReactNode
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

export const Dialog: React.FC<DialogProps> = ({
    isOpen,
    onClose,
    children,
    maxWidth = 'md'
}) => {
    const overlayRef = useRef<HTMLDivElement>(null)

    // Handle Escape Key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [isOpen, onClose])

    // Prevent scrolling when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => { document.body.style.overflow = 'unset' }
    }, [isOpen])

    if (!isOpen) return null

    // Use Portal if possible, checking for document existence
    if (typeof document === 'undefined') return null

    const maxWidthClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl'
    }

    const content = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                ref={overlayRef}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Dialog Panel */}
            <div
                className={`
                    relative w-full ${maxWidthClasses[maxWidth]} 
                    bg-[var(--color-card-light)] dark:bg-[var(--color-card-dark)]
                    rounded-[var(--radius-xl)] shadow-2xl
                    transform transition-all
                    overflow-hidden
                    border border-slate-100 dark:border-slate-800
                `}
                role="dialog"
                aria-modal="true"
            >
                {children}
            </div>
        </div>
    )

    // Using createPortal to render outside the current DOM hierarchy (usually document.body)
    return createPortal(content, document.body)
}

export const DialogHeader: React.FC<{ title: string, onClose?: () => void, children?: React.ReactNode }> = ({ title, onClose, children }) => (
    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        {children}
        {onClose && (
            <button
                onClick={onClose}
                type="button"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
                <span className="material-symbols-outlined">close</span>
            </button>
        )}
    </div>
)

export const DialogContent: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <div className={`px-6 py-6 overflow-y-auto max-h-[80vh] ${className}`}>
        {children}
    </div>
)

export const DialogFooter: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <div className={`px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 ${className}`}>
        {children}
    </div>
)
