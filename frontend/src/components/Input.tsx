import { type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  prefix?: string
}

export function Input({ label, error, prefix, className = '', id, ...rest }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-4 text-base font-medium text-text-primary select-none">
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          className={[
            'w-full h-12 rounded-btn border bg-white',
            'text-base font-medium text-text-primary',
            'placeholder:text-text-muted placeholder:font-normal',
            'transition-colors outline-none',
            prefix ? 'pl-10 pr-4' : 'px-4',
            error
              ? 'border-red-500 focus:border-red-500'
              : 'border-brand-muted focus:border-brand-orange',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
