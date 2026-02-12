import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    fullWidth?: boolean
}

export const Label: React.FC<{ children: React.ReactNode, className?: string, htmlFor?: string }> = ({ children, className = '', htmlFor }) => (
    <label htmlFor={htmlFor} className={`block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ${className}`}>
        {children}
    </label>
)

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, className = '', fullWidth = true, id, ...props }, ref) => {
        const inputId = id || React.useId()

        return (
            <div className={`${fullWidth ? 'w-full' : ''} mb-4`}>
                {label && <Label htmlFor={inputId}>{label}</Label>}
                <input
                    id={inputId}
                    ref={ref}
                    className={`
                        w-full px-4 py-3 rounded-xl font-bold
                        bg-slate-50 dark:bg-slate-800
                        border transition-all outline-none
                        ${error
                            ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                            : 'border-slate-200 dark:border-slate-700 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-orange-500/20'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                        text-slate-800 dark:text-slate-100
                        placeholder-slate-400
                        ${className}
                    `}
                    {...props}
                />
                {error && <div className="text-xs text-rose-500 mt-1 font-bold">{error}</div>}
            </div>
        )
    }
)
Input.displayName = 'Input'
