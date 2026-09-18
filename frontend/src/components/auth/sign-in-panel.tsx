/**
 * The sign-in card on the landing page.
 *
 * Four distinct states, each of which must be unmistakable:
 *   - loading            — we do not yet know
 *   - signed in          — go to the tracker
 *   - Google configured  — render Google's button
 *   - not configured     — say so plainly, and show exactly how to fix it
 *
 * The last state is the one that matters most: a silent dev bypass that looks
 * like a real sign-in is worse than no sign-in at all, so the local option is
 * always labelled as local.
 */

import { ArrowRightIcon, CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { describeError } from "@/components/ui/error-display";
import { Spinner } from "@/components/ui/spinner";
import { useGoogleSignIn, useSession } from "@/hooks/use-session";

const SETUP_STEPS = [
  "Create an OAuth client ID (type: Web application) in Google Cloud Console.",
  "Add http://localhost:5173 as an authorised JavaScript origin.",
  "Put the client ID in backend/.env as GOOGLE_CLIENT_ID, set AUTH_DEV_BYPASS=0, and restart the API.",
] as const;

const CONSOLE_URL = "https://console.cloud.google.com/apis/credentials";

export function SignInPanel() {
  const navigate = useNavigate();
  const sessionQuery = useSession();
  const googleSignIn = useGoogleSignIn();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const session = sessionQuery.data;

  const handleCredential = (credential: string) => {
    setError(null);
    googleSignIn.mutate(credential, {
      onSuccess: () => navigate("/tracker"),
      onError: (caught) => setError(describeError(caught)),
    });
  };

  const copyOrigin = async () => {
    try {
      await navigator.clipboard.writeText("http://localhost:5173");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be denied; the value is visible on screen anyway.
      setError("Could not copy — the origin is shown above.");
    }
  };

  if (sessionQuery.isLoading) {
    return (
      <div className="flex h-24 items-center gap-2.5 text-sm text-ink-muted">
        <Spinner />
        Checking your session
      </div>
    );
  }

  /* ------------------------------------------------------------ signed in */
  if (session?.authenticated === true) {
    return (
      <div className="animate-settle">
        <Button variant="primary" size="lg" className="w-full sm:w-auto" asChild>
          <Link to="/tracker">
            Start tracking
            <ArrowRightIcon />
          </Link>
        </Button>
        <p className="mt-3 text-sm text-ink-secondary">
          Signed in as{" "}
          <span className="font-semibold text-ink">{session.user?.email}</span>
          {session.is_dev_session && (
            <span className="text-ink-muted"> · local development account</span>
          )}
        </p>
      </div>
    );
  }

  /* --------------------------------------------------- Google configured */
  if (session?.google_sign_in_enabled === true) {
    return (
      <div className="animate-settle">
        <GoogleSignInButton
          clientId={session.google_client_id}
          onCredential={handleCredential}
          onError={setError}
        />
        <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-ink-secondary">
          Your Google account is used to identify you and nothing else. No calendar,
          contact or Drive access is requested.
        </p>
        {googleSignIn.isPending && (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
            <Spinner />
            Signing you in
          </p>
        )}
        {error !== null && (
          <p
            role="alert"
            className="mt-3 max-w-[42ch] rounded-2xl bg-danger-wash px-4 py-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------- not yet configured */
  return (
    <div className="animate-settle max-w-lg rounded-3xl border border-rule bg-card p-5 shadow-lift-2 sm:p-6">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-clay-wash text-sm font-bold text-clay"
          aria-hidden="true"
        >
          !
        </span>
        <div className="min-w-0">
          <p className="display text-lg text-ink">
            Google sign-in isn&rsquo;t set up yet
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
            It needs a client ID from your own Google Cloud project — about three
            minutes.
          </p>
        </div>
      </div>

      <ol className="mt-5 space-y-3">
        {SETUP_STEPS.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm leading-relaxed">
            <span className="readout mt-px shrink-0 font-semibold text-clay">
              {index + 1}.
            </span>
            <span className="text-ink-secondary">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="md" asChild>
          <a href={CONSOLE_URL} target="_blank" rel="noreferrer noopener">
            Open Google Console
            <ArrowRightIcon />
          </a>
        </Button>
        <Button variant="secondary" size="md" onClick={() => void copyOrigin()}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy origin"}
        </Button>
      </div>

      {session?.is_dev_session === false && (
        <p className="mt-5 border-t border-rule pt-4 text-sm text-ink-muted">
          Until then the tracker is locked. Set{" "}
          <code className="readout rounded bg-card-sunken px-1.5 py-0.5 text-ink-secondary">
            AUTH_DEV_BYPASS=1
          </code>{" "}
          in <code className="readout">backend/.env</code> to use a local account
          instead.
        </p>
      )}

      {error !== null && (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-danger-wash px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}
