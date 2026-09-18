/**
 * Who is signed in, and the way out.
 *
 * Also the only place the dev bypass is surfaced: if the API is treating every
 * request as the local account, that must be visible rather than silently
 * looking like a real sign-in.
 */

import { LogOutIcon } from "lucide-react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useSession, useSignOut } from "@/hooks/use-session";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AccountMenu() {
  const navigate = useNavigate();
  const { data } = useSession();
  const signOut = useSignOut();

  const user = data?.user;
  if (user === null || user === undefined) return null;

  const handleSignOut = () => {
    signOut.mutate(undefined, {
      onSuccess: () => navigate("/"),
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2 pl-1 pr-2.5">
          <span
            className="readout flex size-6 items-center justify-center bg-ink text-[10px] font-medium text-sand"
            aria-hidden="true"
          >
            {initialsOf(user.name)}
          </span>
          <span className="max-w-32 truncate">{user.name}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b border-rule p-3">
          <p className="label-soft">Signed in as</p>
          <p className="mt-1 truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="readout mt-0.5 truncate text-[11px] text-ink-muted">
            {user.email}
          </p>
        </div>

        {data?.is_dev_session === true && (
          <div className="border-b border-rule bg-clay-wash p-3">
            <p className="label-soft text-ink-secondary">Local development</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
              <code className="readout">AUTH_DEV_BYPASS</code> is enabled, so the API is
              treating every request as this local account. Turn it off and set{" "}
              <code className="readout">GOOGLE_CLIENT_ID</code> to require a real
              sign-in.
            </p>
          </div>
        )}

        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleSignOut}
            disabled={signOut.isPending}
          >
            {signOut.isPending ? <Spinner /> : <LogOutIcon />}
            Sign out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
