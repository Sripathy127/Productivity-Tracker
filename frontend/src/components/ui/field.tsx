import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Inputs are inset rather than outlined: a slightly sunken well on the card
 * surface, which suits a tactile direction better than a hard border.
 * `text-base` on mobile prevents iOS Safari from zooming on focus.
 */
export const inputClassName =
  "h-11 w-full rounded-xl border border-rule-strong bg-card-sunken/60 px-3 text-base sm:h-10 sm:text-sm text-ink transition-all duration-200 outline-none placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-clay focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-clay/25 disabled:opacity-45 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/20";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  const isTemporal = type === "time" || type === "date";
  return (
    <input
      type={type}
      className={cn(inputClassName, isTemporal && "readout", className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        inputClassName,
        "h-auto min-h-20 py-2.5 leading-relaxed",
        className
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("label-soft mb-1.5 block", className)}
      {...props}
    />
  );
}

/** Label + control + inline error, so every form field looks the same. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error !== undefined && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-danger">
          <span
            aria-hidden="true"
            className="mt-[5px] size-1.5 shrink-0 rounded-full bg-danger"
          />
          <span>{error}</span>
        </p>
      )}
      {error === undefined && hint !== undefined && (
        <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  );
}
