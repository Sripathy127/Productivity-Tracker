import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Rounded, lifted, tactile. Every variant carries real hover, active,
 * focus-visible and disabled states, and presses translate down by 1px so the
 * control feels physical.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 ease-[cubic-bezier(0.22,0.8,0.3,1)] outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-sand disabled:pointer-events-none disabled:opacity-45 active:translate-y-px [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-clay text-white shadow-[var(--lift-clay)] hover:bg-clay-pressed hover:shadow-lift-2",
        secondary:
          "bg-card text-ink border border-rule-strong shadow-lift-1 hover:bg-card-sunken hover:shadow-lift-2",
        ghost: "text-ink-secondary hover:bg-card-sunken hover:text-ink",
        soft: "bg-clay-wash text-clay hover:brightness-95",
        danger: "bg-danger text-white shadow-lift-1 hover:brightness-110",
        dangerGhost: "text-danger hover:bg-danger-wash",
      },
      size: {
        sm: "h-8 rounded-lg px-2.5 text-xs [&_svg]:size-3.5",
        md: "h-10 rounded-xl px-4 text-sm [&_svg]:size-4",
        lg: "h-12 rounded-full px-6 text-[15px] [&_svg]:size-4",
        icon: "size-9 rounded-xl [&_svg]:size-4",
        iconSm: "size-7 rounded-lg [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
