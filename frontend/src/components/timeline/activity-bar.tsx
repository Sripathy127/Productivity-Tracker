/**
 * One parent bar on a day row.
 *
 * Positioned absolutely from `intervalToBox`, so a 03:53 start lands on 03:53
 * at every zoom level rather than snapping to the 2-minute grid.
 */

import {
  ChevronDownIcon,
  ChevronRightIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatClock, formatDuration, parseLocalDateTime } from "@/lib/date-utils";
import {
  LANE_GAP,
  LANE_HEIGHT,
  ROW_PADDING_Y,
  intervalToBox,
  type TimelineGeometry,
} from "@/lib/timeline-geometry";
import type { ActivitySegment } from "@/lib/timeline-layout";
import { resolveCategoryColor } from "@/lib/category-palette";
import { useIsDarkScheme } from "@/hooks/use-media-query";
import { cn, readableTextColor } from "@/lib/utils";

/** Below these widths the bar cannot hold its label / times / buttons. */
const WIDTH_FOR_TITLE = 56;
const WIDTH_FOR_TIMES = 168;
const WIDTH_FOR_ACTIONS = 250;

export function ActivityBar({
  segment,
  geometry,
  isExpanded,
  use24Hour,
  onToggleExpand,
  onEdit,
  onDelete,
}: {
  segment: ActivitySegment;
  geometry: TimelineGeometry;
  isExpanded: boolean;
  use24Hour: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { activity, startMinute, endMinute, continuesBefore, continuesAfter } = segment;
  const box = intervalToBox(startMinute, endMinute, geometry);

  const isDark = useIsDarkScheme();
  const color = resolveCategoryColor(activity.category?.color, isDark);
  const textColor = readableTextColor(color);
  const hasChildren = activity.sub_activities.length > 0;
  const Chevron = isExpanded ? ChevronDownIcon : ChevronRightIcon;

  const trueStart = parseLocalDateTime(activity.start_at);
  const trueEnd = parseLocalDateTime(activity.end_at);
  const totalMinutes = Math.round((trueEnd.getTime() - trueStart.getTime()) / 60_000);
  const timeRange = `${formatClock(trueStart, use24Hour)} – ${formatClock(trueEnd, use24Hour)}`;

  const showTitle = box.width >= WIDTH_FOR_TITLE;
  const showTimes = box.width >= WIDTH_FOR_TIMES;
  const showActions = box.width >= WIDTH_FOR_ACTIONS;

  return (
    <div
      className={cn(
        "group/bar absolute flex items-center gap-1.5 overflow-hidden px-2 shadow-lift-1 outline-none transition-all duration-200 ease-[cubic-bezier(0.22,0.8,0.3,1)] hover:z-20 hover:shadow-lift-2 hover:brightness-105 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80",
        // A dashed edge marks a bar cut at midnight; the rounded corner on the
        // uncut side still reads as "this end is real".
        continuesBefore
          ? "rounded-l-none border-l-2 border-dashed border-l-sand"
          : "rounded-l-full",
        continuesAfter
          ? "rounded-r-none border-r-2 border-dashed border-r-sand"
          : "rounded-r-full"
      )}
      style={{
        left: `${box.left}px`,
        width: `${box.width}px`,
        top: `${ROW_PADDING_Y + segment.lane * (LANE_HEIGHT + LANE_GAP)}px`,
        height: `${LANE_HEIGHT}px`,
        backgroundColor: color,
        color: textColor,
      }}
      title={[
        activity.title,
        `${timeRange} (${formatDuration(totalMinutes)})`,
        activity.category !== null ? activity.category.name : "Uncategorised",
        continuesBefore || continuesAfter ? "Crosses midnight" : null,
        hasChildren ? `${activity.sub_activities.length} sub-activities` : null,
        activity.notes ?? null,
      ]
        .filter((line): line is string => line !== null)
        .join("\n")}
      role="button"
      tabIndex={0}
      onDoubleClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onEdit();
        }
      }}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand();
          }}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? `Hide sub-activities of ${activity.title}`
              : `Show sub-activities of ${activity.title}`
          }
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-black/20 outline-none transition-colors hover:bg-black/35 focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <Chevron className="size-3.5" />
        </button>
      ) : (
        <span
          className="ml-1 size-1.5 shrink-0 rounded-full bg-current opacity-60"
          aria-hidden="true"
        />
      )}

      {showTitle && (
        <span className="min-w-0 flex-1 truncate text-xs font-medium leading-tight">
          {activity.title}
        </span>
      )}

      {showTimes && (
        <span className="readout shrink-0 whitespace-nowrap text-[10px] opacity-85">
          {timeRange} · {formatDuration(totalMinutes)}
        </span>
      )}

      {showActions && (
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/bar:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="iconSm"
            aria-label={`Edit ${activity.title}`}
            className="rounded-full text-current hover:bg-black/25"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            aria-label={`Delete ${activity.title}`}
            className="rounded-full text-current hover:bg-black/25"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2Icon />
          </Button>
        </span>
      )}
    </div>
  );
}
