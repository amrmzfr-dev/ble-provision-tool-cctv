import { cva, type VariantProps } from 'class-variance-authority'
import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900',
        secondary:
          'border-transparent bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50',
        success: 'border-transparent bg-green-600 text-white dark:bg-green-700',
        destructive: 'border-transparent bg-red-600 text-white dark:bg-red-700',
        outline: 'border-zinc-200 text-zinc-950 dark:border-zinc-800 dark:text-zinc-50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
