import { RefreshCwIcon } from "lucide-react";

import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";

export function ErrorDisplay({
  error,
  onRetry,
  title = "Something went wrong",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-rule bg-card p-7 text-center shadow-lift-2">
      <div
        className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-danger-wash"
        aria-hidden="true"
      >
        <span className="size-3 rounded-full bg-danger" />
      </div>
      <p className="display text-xl text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-[34ch] text-sm leading-relaxed text-ink-secondary">
        {describeError(error)}
      </p>
      {onRetry !== undefined && (
        <Button variant="secondary" size="md" className="mt-5" onClick={onRetry}>
          <RefreshCwIcon />
          Try again
        </Button>
      )}
    </div>
  );
}

/** Human-readable text for an unknown thrown value. */
export function describeError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Your session has ended. Sign in again to continue.";
    }
    if (error.fieldErrors.length > 0) {
      return error.fieldErrors.map((item) => item.message).join(" ");
    }
    if (error.status === 0 || error.status >= 500) {
      return "The API is not reachable. Is the backend running on port 8000?";
    }
    return error.message;
  }
  if (error instanceof TypeError) {
    return "The API is not reachable. Is the backend running on port 8000?";
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}
