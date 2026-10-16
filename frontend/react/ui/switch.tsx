import * as React from 'react'
import * as Primitive from '@radix-ui/react-switch'
import { cn } from '../lib/utils'

// shadcn/ui（MIT）：样式限定在 archive 命名空间。
export const Switch = React.forwardRef<React.ElementRef<typeof Primitive.Root>, React.ComponentPropsWithoutRef<typeof Primitive.Root>>(
  ({ className, ...props }, ref) => <Primitive.Root ref={ref} className={cn('archive-switch', className)} {...props}><Primitive.Thumb className="archive-switch-thumb" /></Primitive.Root>,
)
Switch.displayName = 'Switch'
