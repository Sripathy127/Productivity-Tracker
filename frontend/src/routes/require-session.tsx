import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { ErrorDisplay } from "@/components/ui/error-display";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/hooks/use-session";

/**
 * Route guard for the tracker.
 *
 * The check is a convenience, not the security boundary: every API route
 * independently requires a session, so a user who forces their way to
 * `/tracker` sees an empty, non-functional page rather than anyone's data.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { data, isLoading, isError, error, refetch } = useSession();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-ink-muted">
        <Spinner />
        Checking your session
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <ErrorDisplay
          error={error}
          title="Could not verify your session"
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (data?.authenticated !== true) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
