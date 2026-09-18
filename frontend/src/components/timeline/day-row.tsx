/**
 * One day of the month: a sticky left panel plus the 24-hour lane area.
 *
 * The left panel uses `position: sticky; left: 0`, which is what keeps the day
 * label visible while the lane area scrolls horizontally. The row itself is a
 * normal block, so vertical scrolling is handled by the shared container and
 * the header stays stuck to the top.
 */

import { PlusIcon } from "lucide-react";
import { useRef } from "react";

import { ActivityBar } from "@/components/timeline/activity-bar";
import { SubActivityBar } from "@/components/timeline/sub-activity-bar";
import { Button } from "@/components/ui/button";
import {
  WEEKDAY_NAMES,
  formatDuration,
  isWeekend,
  nowMinuteWithinDay,
} from "@/lib/date-utils";
import {
  DAY_PANEL_WIDTH,
  MINUTES_PER_DAY,
  laneBackgroundImage,
  minutesToPx,
  pxToSnappedMinutes,
  rowHeight,
  type TimelineGeometry,
} from "@/lib/timeline-geometry";
import { subLaneCountFor, type DayLayout } from "@/lib/timeline-layout";
import type { Activity, SubActivity } from "@/types/api";
import { cn } from "@/lib/utils";

export interface DayRowHandlers {
  onCreateAt: (day: Date, startMinute: number) => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (activity: Activity) => void;
  onEditSubActivity: (subActivity: SubActivity, parent: Activity) => void;
  onDeleteSubActivity: (subActivity: SubActivity) => void;
  onToggleExpand: (activityId: number) => void;
}

export function DayRow({
  layout,
  geometry,
  expandedIds,
  use24Hour,
  now,
  handlers,
}: {
  layout: DayLayout;
  geometry: TimelineGeometry;
  expandedIds: ReadonlySet<number>;
  use24Hour: boolean;
  now: Date;
  handlers: DayRowHandlers;
}) {
  const laneRef = useRef<HTMLDivElement>(null);
  const subLaneCount = subLaneCountFor(layout);
  const height = rowHeight(layout.laneCount, subLaneCount);
  const nowMinute = nowMinuteWithinDay(layout.date, now);
  const weekend = isWeekend(layout.date);
  const isToday = nowMinute !== null;

  /** Empty-grid click → create an activity snapped to the 2-minute slot. */
  const handleLaneClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const bounds = laneRef.current?.getBoundingClientRect();
    if (bounds === undefined) return;

    const offsetPx = event.clientX - bounds.left;
    handlers.onCreateAt(layout.date, pxToSnappedMinutes(offsetPx, geometry));
  };

  return (
    <div
      className="flex border-b border-rule last:border-b-0"
      style={{ width: `${geometry.contentWidth}px`, height: `${height}px` }}
      role="row"
      aria-label={`${layout.date.toDateString()}, ${formatDuration(layout.trackedMinutes)} tracked`}
    >
      <div
        className={cn(
          "sticky left-0 z-20 flex shrink-0 items-center gap-3 border-r border-rule px-4",
          isToday ? "bg-clay-wash" : weekend ? "bg-weekend" : "bg-card"
        )}
        style={{ width: `${DAY_PANEL_WIDTH}px` }}
      >
        <div className="flex w-11 shrink-0 flex-col items-center">
          <span
            className={cn(
              "readout display text-2xl leading-none",
              isToday ? "text-clay" : "text-ink"
            )}
          >
            {layout.date.getDate()}
          </span>
          <span className={cn("label-soft mt-1 mb-0", weekend && "text-ink-secondary")}>
            {WEEKDAY_NAMES[layout.date.getDay()]}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="readout truncate text-sm font-semibold text-ink">
            {layout.trackedMinutes > 0
              ? formatDuration(layout.trackedMinutes)
              : "No entries"}
          </p>
          {layout.segments.length > 0 && (
            <p className="truncate text-[11px] text-ink-muted">
              {layout.segments.length}
              {layout.segments.length === 1 ? " activity" : " activities"}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="iconSm"
          aria-label={`Add an activity on ${layout.date.toDateString()}`}
          title="Add an activity on this day"
          onClick={() =>
            handlers.onCreateAt(layout.date, defaultStartMinute(now, layout))
          }
        >
          <PlusIcon />
        </Button>
      </div>

      <div
        ref={laneRef}
        className={cn(
          "relative shrink-0 cursor-copy",
          weekend && !isToday && "bg-weekend"
        )}
        style={{
          width: `${geometry.laneWidth}px`,
          backgroundImage: laneBackgroundImage(geometry),
        }}
        onClick={handleLaneClick}
        title="Click an empty slot to add an activity"
      >
        {/* Dim the part of today that has not happened yet. */}
        {nowMinute !== null && nowMinute < MINUTES_PER_DAY && (
          <div
            className="pointer-events-none absolute inset-y-0 bg-ink/[0.035]"
            style={{
              left: `${minutesToPx(nowMinute, geometry)}px`,
              width: `${minutesToPx(MINUTES_PER_DAY - nowMinute, geometry)}px`,
            }}
            aria-hidden="true"
          />
        )}

        {nowMinute !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 z-30 w-px bg-now"
            style={{ left: `${minutesToPx(nowMinute, geometry)}px` }}
            aria-hidden="true"
          >
            <span className="absolute -left-[3px] top-0 size-[7px] rounded-full bg-now" />
          </div>
        )}

        {/* Bars are positioned directly on the lane (no wrapper) so a click on
            empty grid still has the lane itself as its event target. */}
        {layout.segments.map((segment) => (
          <ActivityBar
            key={segment.key}
            segment={segment}
            geometry={geometry}
            isExpanded={expandedIds.has(segment.activity.id)}
            use24Hour={use24Hour}
            onToggleExpand={() => handlers.onToggleExpand(segment.activity.id)}
            onEdit={() => handlers.onEditActivity(segment.activity)}
            onDelete={() => handlers.onDeleteActivity(segment.activity)}
          />
        ))}

        {layout.segments.flatMap((segment) =>
          segment.subSegments.map((subSegment) => (
            <SubActivityBar
              key={subSegment.key}
              segment={subSegment}
              parent={segment}
              parentLaneCount={Math.max(layout.laneCount, 1)}
              geometry={geometry}
              use24Hour={use24Hour}
              onEdit={() =>
                handlers.onEditSubActivity(subSegment.subActivity, segment.activity)
              }
              onDelete={() => handlers.onDeleteSubActivity(subSegment.subActivity)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Where the "+" button starts a new activity: the current time on today, or
 * 09:00 on any other day.
 */
function defaultStartMinute(now: Date, layout: DayLayout): number {
  const minute = nowMinuteWithinDay(layout.date, now);
  return minute ?? 9 * 60;
}
