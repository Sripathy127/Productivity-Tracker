/**
 * "Sign in with Google" via Google Identity Services.
 *
 * GIS renders its own button into a container element; Google requires its
 * markup for the official button, so it is not restyled beyond width and
 * theme. The ID token it produces is handed straight to the backend and never
 * stored client-side.
 *
 * The `google` global is declared locally rather than pulled in as a typed
 * dependency: only the three calls used here are described, so the surface
 * stays honest about what is relied on.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const GIS_SRC = "https://accounts.google.com/gsi/client";
const GIS_SCRIPT_ID = "google-identity-services";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_black" | "filled_blue";
      size?: "small" | "medium" | "large";
      text?: "signin_with" | "signup_with" | "continue_with";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: number;
    }
  ): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

type ScriptState = "idle" | "loading" | "ready" | "failed";

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(GIS_SCRIPT_ID);
    if (existing !== null) {
      if (window.google?.accounts?.id !== undefined) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google sign-in script failed to load")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = GIS_SCRIPT_ID;
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google sign-in script failed to load"));
    document.head.appendChild(script);
  });
}

export function GoogleSignInButton({
  clientId,
  onCredential,
  onError,
  width = 260,
}: {
  clientId: string;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
  width?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptState, setScriptState] = useState<ScriptState>("idle");

  // Held in a ref so re-renders of the parent never re-initialise GIS.
  const credentialHandler = useRef(onCredential);
  credentialHandler.current = onCredential;
  const errorHandler = useRef(onError);
  errorHandler.current = onError;

  const mount = useCallback(() => {
    const identity = window.google?.accounts?.id;
    const container = containerRef.current;
    if (identity === undefined || container === null) return;

    identity.initialize({
      client_id: clientId,
      callback: (response) => {
        if (typeof response.credential === "string") {
          credentialHandler.current(response.credential);
        } else {
          errorHandler.current("Google did not return a sign-in token.");
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    container.replaceChildren();
    identity.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
      width,
    });
  }, [clientId, width]);

  useEffect(() => {
    let cancelled = false;
    setScriptState("loading");

    loadGisScript()
      .then(() => {
        if (cancelled) return;
        setScriptState("ready");
        mount();
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setScriptState("failed");
        errorHandler.current(
          caught instanceof Error
            ? caught.message
            : "Google sign-in could not be loaded."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [mount]);

  if (scriptState === "failed") {
    return (
      <p className="text-sm text-danger">
        Google sign-in could not be loaded. Check your connection and reload.
      </p>
    );
  }

  return (
    <div className="min-h-11" style={{ width: `${width}px` }}>
      <div ref={containerRef} />
      {scriptState !== "ready" && (
        <div
          className="h-11 w-full animate-pulse border border-rule bg-card-sunken"
          aria-label="Loading Google sign-in"
        />
      )}
    </div>
  );
}
