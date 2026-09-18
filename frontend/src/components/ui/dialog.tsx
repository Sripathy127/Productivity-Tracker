import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[1px]" />
      <DialogPrimitive.Content
        className={cn(
          // A hairline border and a flat surface, not a floating rounded card.
          "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-1.5rem)] w-[min(46rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-card shadow-lift-3 focus:outline-none",
          className
        )}
        {...props}
      >
        <div className="p-5 sm:p-7">{children}</div>
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-full p-2 text-ink-muted transition-colors hover:bg-card-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-clay outline-none"
          aria-label="Close"
        >
          <XIcon className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mb-6 pr-10", className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("display text-2xl text-ink sm:text-[26px]", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("mt-2 max-w-prose text-sm text-ink-secondary", className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-7 flex flex-col-reverse gap-2 border-t border-rule pt-5 sm:flex-row sm:items-center sm:justify-end",
        className
      )}
      {...props}
    />
  );
}
