import { type ReactNode } from 'react'

interface PageShellProps {
  children: ReactNode
}

export function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-full bg-surface-base flex justify-center">
      <div className="w-full max-w-mobile flex flex-col min-h-full">
        {children}
      </div>
    </div>
  )
}
