import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'

// shadcn/ui (MIT), Radix version with isolated class names.
// https://ui.shadcn.com/r/styles/new-york/dialog.json
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { overlayClassName?: string }>(
  ({ className, overlayClassName, children, ...props }, ref) => <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className={cn('archive-dialog-overlay', overlayClassName)} />
    <DialogPrimitive.Content ref={ref} className={cn('archive-react archive-dialog-content', className)} {...props}>
      {children}
      <DialogPrimitive.Close className="archive-dialog-close" aria-label="关闭" title="关闭"><X size={16} aria-hidden="true" /></DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>,
)
DialogContent.displayName = DialogPrimitive.Content.displayName
export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('archive-dialog-header', className)} {...props} />
export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('archive-dialog-footer', className)} {...props} />
export const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} className={cn('archive-dialog-title', className)} {...props} />,
)
DialogTitle.displayName = DialogPrimitive.Title.displayName
export const DialogDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Description ref={ref} className={cn('archive-dialog-description', className)} {...props} />,
)
DialogDescription.displayName = DialogPrimitive.Description.displayName
