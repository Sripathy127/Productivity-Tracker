import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-rule-strong bg-card-sunken/60 px-3 text-sm text-ink outline-none transition-all duration-200 hover:border-ink-muted focus-visible:border-clay focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-clay/25 disabled:opacity-45 sm:h-10",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDownIcon className="size-4 text-ink-muted" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={4}
        className={cn(
          "z-[60] max-h-72 min-w-[--radix-select-trigger-width] overflow-hidden rounded-2xl border border-rule bg-card shadow-lift-3",
          className
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-lg py-2 pl-2.5 pr-8 text-sm text-ink outline-none data-[highlighted]:bg-clay-wash data-[disabled]:opacity-45",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2">
        <CheckIcon className="size-3.5 text-clay" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
