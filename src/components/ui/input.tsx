import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 focus-visible:border-ring',
        className,
      )}
      {...props}
    />
  )
}
