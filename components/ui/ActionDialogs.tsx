'use client'

import React from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from './Dialog'
import { Button } from './Button'

interface ConfirmDialogProps {
    isOpen: boolean
    title: string
    message: React.ReactNode
    onConfirm: () => void
    onCancel: () => void
    confirmText?: string
    cancelText?: string
    isDestructive?: boolean
    isLoading?: boolean
    errorMsg?: string
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = '確定',
    cancelText = '取消',
    isDestructive = false,
    isLoading = false,
    errorMsg
}) => {
    return (
        <Dialog isOpen={isOpen} onClose={isLoading ? () => { } : onCancel} maxWidth="sm">
            <DialogHeader title={title} onClose={isLoading ? undefined : onCancel} />
            <DialogContent className="pt-4 pb-2">
                <p className="text-slate-600 dark:text-neutral-300 text-sm leading-relaxed">{message}</p>
                {errorMsg && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">error</span>
                        {errorMsg}
                    </div>
                )}
            </DialogContent>
            <DialogFooter className="mt-4">
                <Button variant="outline" onClick={onCancel} disabled={isLoading}>
                    {cancelText}
                </Button>
                <Button
                    variant={isDestructive ? 'danger' : 'primary'}
                    onClick={onConfirm}
                    isLoading={isLoading}
                >
                    {confirmText}
                </Button>
            </DialogFooter>
        </Dialog>
    )
}

interface AlertDialogProps {
    isOpen: boolean
    title: string
    message: React.ReactNode
    onConfirm: () => void
    confirmText?: string
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    confirmText = '我知道了'
}) => {
    return (
        <Dialog isOpen={isOpen} onClose={onConfirm} maxWidth="sm">
            <DialogHeader title={title} onClose={onConfirm} />
            <DialogContent className="pt-4 pb-2">
                <p className="text-slate-600 dark:text-neutral-300 text-sm leading-relaxed">{message}</p>
            </DialogContent>
            <DialogFooter className="mt-4">
                <Button variant="primary" onClick={onConfirm}>
                    {confirmText}
                </Button>
            </DialogFooter>
        </Dialog>
    )
}
