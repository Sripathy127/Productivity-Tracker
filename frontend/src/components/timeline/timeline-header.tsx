/**
 * The sticky hour ruler.
 *
 * Row 1 labels each hour column; row 2 draws the sub-hour ticks. Tick density
 * adapts to zoom: at the widest zoom every 2-minute slot gets a tick, otherwise
 * only the 10-minute marks are drawn, because sub-4px ticks read as a grey
 * smear rather than a scale.
 */

import {
  DAY_PANEL_WIDTH,
  HOUR_SEQUENCE,
  SLOTS_PER_HOUR,
  SLOT_MINUTES,
  type TimelineGeometry,
} from "@/lib/timeline-geometry";
import { formatHourLabel } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

const MIN_SLOT_WIDTH_FOR_TICKS = 7;
const TICKS_PER_HOUR_COARSE = 6;

interface HourTick {
  offsetPx: number;
  isMajor: boolean;
  minuteInHour: number;
}

function buildTicks(geometry: TimelineGeometry): HourTick[] {
  const showEverySlot = geometry.slotWidth >= MIN_SLOT_WIDTH_FOR_TICKS;
  const step = showEverySlot ? SLOT_MINUTES : 60 / TICKS_PER_HOUR_COARSE;
  const count = showEverySlot ? SLOTS_PER_HOUR : TICKS_PER_HOUR_COARSE;

  return Array.from({ length: count }, (_, index) => {
    const minuteInHour = index * step;
    return {
      minuteInHour,
      offsetPx: minuteInHour * geometry.pxPerMinute,
      // Every 10 minutes gets a taller tick to anchor the eye.
      isMajor: minuteInHour % 10 === 0,
    };
  });
}

export function TimelineHeader({
  geometry,
  use24Hour,
  headerLabel,
}: {
  geometry: TimelineGeometry;
  use24Hour: boolean;
  headerLabel: string;
}) {
  const ticks = buildTicks(geometry);

  return (
    <div
      className="sticky top-0 z-30 flex bg-card"
      style={{ width: `${geometry.contentWidth}px` }}
      role="row"
    >
      {/* Top-left corner: sticky on both axes so it never slides away. */}
      <div
        className="sticky left-0 z-40 flex shrink-0 flex-col justify-center border-b border-r border-rule bg-card px-4"
        style={{ width: `${DAY_PANEL_WIDTH}px`, height: "56px" }}
      >
        <span className="display text-base text-ink">{headerLabel}</span>
        <span className="label-soft mt-1">
          {SLOTS_PER_HOUR} × {SLOT_MINUTES} min
        </span>
      </div>

      <div
        className="relative shrink-0 border-b border-rule"
        style={{ width: `${geometry.laneWidth}px`, height: "56px" }}
      >
        <div className="flex h-full">
          {HOUR_SEQUENCE.map((hour) => (
            <div
              key={hour}
              className={cn(
                "relative flex shrink-0 flex-col border-l border-rule",
                hour % 2 === 1 && "bg-grid-band"
              )}
              style={{ width: `${geometry.hourWidth}px` }}
              role="columnheader"
              aria-label={`Hour starting ${formatHourLabel(hour, true)}`}
            >
              <span className="readout px-1.5 pt-1.5 text-xs font-medium text-ink">
                {formatHourLabel(hour, use24Hour)}
              </span>

              <div className="relative mt-auto h-3.5">
                {ticks.map((tick) => (
                  <span
                    key={tick.minuteInHour}
                    className={cn(
                      "absolute bottom-0 w-px",
                      tick.isMajor ? "h-3 bg-rule-strong" : "h-1.5 bg-rule"
                    )}
                    style={{ left: `${tick.offsetPx}px` }}
                    aria-hidden="true"
                  />
                ))}
                {/* Label the half-hour once there is room for it. */}
                {geometry.hourWidth >= 200 && (
                  <span className="readout absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-ink-muted">
                    30
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
