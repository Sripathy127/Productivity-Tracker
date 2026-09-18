import { createBrowserRouter } from "react-router";

import { LandingPage } from "@/pages/landing-page";
import { TimelinePage } from "@/pages/timeline-page";
import { RequireSession } from "@/routes/require-session";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  {
    path: "/tracker",
    element: (
      <RequireSession>
        <TimelinePage />
      </RequireSession>
    ),
  },
  // Anything else lands on the description of what this is.
  { path: "*", element: <LandingPage /> },
]);
