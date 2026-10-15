import * as React from 'react'
import { cn } from '../lib/utils'

// shadcn/ui (MIT), new-york-v4 Card with isolated theme classes.
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card" className={cn('archive-card', className)} {...props} />
}
export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('archive-card-header', className)} {...props} />
}
export function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-title" className={cn('archive-card-title', className)} {...props} />
}
export function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-description" className={cn('archive-card-description', className)} {...props} />
}
export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('archive-card-footer', className)} {...props} />
}
