import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

// 来源：shadcn/ui（MIT），手动接入 Radix 版本并隔离样式，避免全局样式影响旧页面。
// https://ui.shadcn.com/r/styles/new-york/button.json
export const buttonVariants = cva('archive-button', {
  variants: {
    variant: { default: 'archive-button-primary', outline: 'archive-button-outline', ghost: 'archive-button-ghost' },
    size: { default: 'archive-button-default', sm: 'archive-button-sm', icon: 'archive-button-icon' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Component = asChild ? Slot : 'button'
    return <Component className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'
