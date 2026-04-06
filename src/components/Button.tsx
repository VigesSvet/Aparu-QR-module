import { type ReactNode, type ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'main' | 'main-stroke' | 'second' | 'second-stroke' | 'third'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: ReactNode
  children: ReactNode
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  'main':
    'bg-brand-orange text-white disabled:bg-brand-muted',
  'main-stroke':
    'bg-white text-brand-orange border border-brand-orange disabled:text-brand-muted disabled:border-brand-muted',
  'second':
    'bg-brand-dark text-white disabled:bg-brand-muted',
  'second-stroke':
    'bg-white text-brand-dark border border-brand-dark disabled:text-brand-muted disabled:border-brand-muted',
  'third':
    'bg-transparent text-text-muted',
}

export function Button({
  variant = 'main',
  icon,
  children,
  fullWidth = true,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2',
        'h-12 px-[14px] rounded-btn',
        'font-medium text-base leading-snug tracking-tight',
        'transition-opacity active:opacity-80',
        'disabled:cursor-not-allowed',
        fullWidth ? 'w-full' : '',
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {icon && <span className="shrink-0 w-5 h-5 flex items-center justify-center">{icon}</span>}
      {children}
    </button>
  )
}
