import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { Circle } from 'lucide-react'
import { cn } from '../lib/utils'

// shadcn/ui (MIT), Radix version with isolated class names.
// https://ui.shadcn.com/r/styles/new-york/radio-group.json
export const RadioGroup = React.forwardRef<React.ElementRef<typeof RadioGroupPrimitive.Root>, React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>>(
  ({ className, ...props }, ref) => <RadioGroupPrimitive.Root ref={ref} className={cn('archive-radio-group', className)} {...props} />,
)
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName
export const RadioGroupItem = React.forwardRef<React.ElementRef<typeof RadioGroupPrimitive.Item>, React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>>(
  ({ className, ...props }, ref) => <RadioGroupPrimitive.Item ref={ref} className={cn('archive-radio-item', className)} {...props}>
    <RadioGroupPrimitive.Indicator className="archive-radio-indicator"><Circle size={8} fill="currentColor" /></RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>,
)
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName
