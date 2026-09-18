import { useEffect, useState } from "react";

const ONE_MINUTE = 60_000;

/**
 * The current time, refreshed every minute.
 *
 * The timeline's resolution is one minute, so polling faster would repaint the
 * now-indicator without moving it.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), ONE_MINUTE);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}
