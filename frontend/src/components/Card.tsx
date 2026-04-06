import { type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  warm?: boolean
}

export function Card({ children, className = '', warm = false }: CardProps) {
  return (
    <div
      className={[
        'rounded-card border border-gray-100 p-4',
        warm ? 'bg-surface-warm' : 'bg-white',
        'shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}
