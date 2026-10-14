import * as React from 'react'
import { cn } from '../lib/utils'

// shadcn/ui (MIT), with isolated class names.
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn('archive-textarea', className)} {...props} />,
)
Textarea.displayName = 'Textarea'
