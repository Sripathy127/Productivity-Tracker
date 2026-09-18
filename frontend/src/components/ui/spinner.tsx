import { cn } from "@/lib/utils";

/** Three soft dots breathing in sequence — slow, to match the motion language. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-flex items-center gap-1 align-middle", className)}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 animate-pulse rounded-full bg-current opacity-70"
          style={{
            animationDelay: `${index * 160}ms`,
            animationDuration: "1100ms",
          }}
        />
      ))}
    </span>
  );
}
