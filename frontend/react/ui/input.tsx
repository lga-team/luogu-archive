import * as React from 'react'
import { cn } from '../lib/utils'

// 来源：shadcn/ui（MIT），输入组件保留原接口，样式改为迁移期的隔离命名。
export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => <input type={type} className={cn('archive-input', className)} ref={ref} {...props} />,
)
Input.displayName = 'Input'
