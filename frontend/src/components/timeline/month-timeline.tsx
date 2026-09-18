/**
 * The scroll shell.
 *
 * A single element owns both axes (`overflow: auto`). Inside it:
 *
 *   - the header is `sticky top-0`          → survives vertical scrolling
 *   - each row's day panel is `sticky left-0` → survives horizontal scrolling
 *   - the header's corner cell is sticky on both, at the highest z-index
 *
 * One shared scroll container is what keeps the hour ruler and every row in
 * perfect horizontal alignment; two synchronised scrollers would drift.
 */

import { forwardRef } from "react";

import { DayRow, type DayRowHandlers } from "@/components/timeline/day-row";
import { TimelineHeader } from "@/components/timeline/timeline-header";
import { DAY_PANEL_WIDTH, type TimelineGeometry } from "@/lib/timeline-geometry";
import type { DayLayout } from "@/lib/timeline-layout";
import { MONTH_NAMES } from "@/lib/date-utils";

export const MonthTimeline = forwardRef<
  HTMLDivElement,
  {
    month: Date;
    layouts: DayLayout[];
    geometry: TimelineGeometry;
    expandedIds: ReadonlySet<number>;
    use24Hour: boolean;
    now: Date;
    handlers: DayRowHandlers;
  }
>(function MonthTimeline(
  { month, layouts, geometry, expandedIds, use24Hour, now, handlers },
  ref
) {
  return (
    <div
      ref={ref}
      className="timeline-scroll relative h-full w-full overflow-auto rounded-2xl border border-rule bg-card shadow-lift-2"
      role="grid"
      aria-label={`${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()} hourly timeline`}
      aria-rowcount={layouts.length}
    >
      <div
        style={{
          width: `${geometry.contentWidth}px`,
          minWidth: `${DAY_PANEL_WIDTH}px`,
        }}
      >
        <TimelineHeader
          geometry={geometry}
          use24Hour={use24Hour}
          headerLabel={`${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`}
        />

        {layouts.map((layout) => (
          <DayRow
            key={layout.dateKey}
            layout={layout}
            geometry={geometry}
            expandedIds={expandedIds}
            use24Hour={use24Hour}
            now={now}
            handlers={handlers}
          />
        ))}
      </div>
    </div>
  );
});
