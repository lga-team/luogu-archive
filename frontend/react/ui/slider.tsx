import * as React from 'react'
import * as Primitive from '@radix-ui/react-slider'
import { cn } from '../lib/utils'

// shadcn/ui（MIT）：按缓存的 Radix 实现适配，保留键盘和无障碍行为。
export const Slider = React.forwardRef<React.ElementRef<typeof Primitive.Root>, React.ComponentPropsWithoutRef<typeof Primitive.Root>>(
  ({ className, value, defaultValue, ...props }, ref) => <Primitive.Root ref={ref} className={cn('archive-slider', className)} value={value} defaultValue={defaultValue} {...props}>
    <Primitive.Track className="archive-slider-track"><Primitive.Range className="archive-slider-range" /></Primitive.Track>
    {(value || defaultValue || [0]).map((_, index) => <Primitive.Thumb key={index} className="archive-slider-thumb" aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} />)}
  </Primitive.Root>,
)
Slider.displayName = 'Slider'
