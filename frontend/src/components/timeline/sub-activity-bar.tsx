/**
 * A sub-bar shown beneath its parent when the parent is expanded — "what I was
 * actually doing at that moment".
 *
 * It sits on the same time axis as the parent, so its left edge lines up with
 * the real clock time even when it is only a few minutes long.
 */

import { PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatClock, formatDuration, parseLocalDateTime } from "@/lib/date-utils";
import {
  LANE_GAP,
  LANE_HEIGHT,
  ROW_PADDING_Y,
  SUB_LANE_GAP,
  SUB_LANE_HEIGHT,
  intervalToBox,
  type TimelineGeometry,
} from "@/lib/timeline-geometry";
import type { ActivitySegment, SubActivitySegment } from "@/lib/timeline-layout";
import { resolveCategoryColor, subActivityFill } from "@/lib/category-palette";
import { useIsDarkScheme } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const WIDTH_FOR_TITLE = 44;
const WIDTH_FOR_TIMES = 150;
const WIDTH_FOR_ACTIONS = 218;

export function SubActivityBar({
  segment,
  parent,
  parentLaneCount,
  geometry,
  use24Hour,
  onEdit,
  onDelete,
}: {
  segment: SubActivitySegment;
  parent: ActivitySegment;
  parentLaneCount: number;
  geometry: TimelineGeometry;
  use24Hour: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const box = intervalToBox(segment.startMinute, segment.endMinute, geometry);
  const isDark = useIsDarkScheme();
  const color = resolveCategoryColor(parent.activity.category?.color, isDark);

  // Sub-lanes are stacked below *all* parent lanes so they can never collide
  // with a bar sitting in a lower lane of the same row.
  const parentBlockHeight =
    parentLaneCount * LANE_HEIGHT + (parentLaneCount - 1) * LANE_GAP;
  const top =
    ROW_PADDING_Y +
    parentBlockHeight +
    SUB_LANE_GAP +
    segment.lane * (SUB_LANE_HEIGHT + SUB_LANE_GAP);

  const start = parseLocalDateTime(segment.subActivity.start_at);
  const end = parseLocalDateTime(segment.subActivity.end_at);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  const timeRange = `${formatClock(start, use24Hour)} – ${formatClock(end, use24Hour)}`;

  return (
    <div
      className={cn(
        "group/sub absolute flex items-center gap-1.5 overflow-hidden rounded-full border px-2 text-ink outline-none transition-all duration-200 hover:shadow-lift-1 focus-visible:ring-2 focus-visible:ring-clay"
      )}
      style={{
        left: `${box.left}px`,
        width: `${box.width}px`,
        top: `${top}px`,
        height: `${SUB_LANE_HEIGHT}px`,
        // The parent's colour, mixed down so the chip reads as a child of the
        // bar above it rather than a peer of it.
        backgroundColor: subActivityFill(color, isDark),
        borderColor: color,
        borderLeftWidth: segment.continuesBefore ? "2px" : "1px",
        borderLeftStyle: segment.continuesBefore ? "dashed" : "solid",
        borderRightWidth: segment.continuesAfter ? "2px" : "1px",
        borderRightStyle: segment.continuesAfter ? "dashed" : "solid",
      }}
      title={[
        segment.subActivity.title,
        `${timeRange} (${formatDuration(minutes)})`,
        `Part of: ${parent.activity.title}`,
        segment.subActivity.notes ?? null,
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
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />

      {box.width >= WIDTH_FOR_TITLE && (
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-none">
          {segment.subActivity.title}
        </span>
      )}

      {box.width >= WIDTH_FOR_TIMES && (
        <span className="readout shrink-0 whitespace-nowrap text-[10px] text-ink-muted">
          {timeRange}
        </span>
      )}

      {box.width >= WIDTH_FOR_ACTIONS && (
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/sub:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="iconSm"
            aria-label={`Edit sub-activity ${segment.subActivity.title}`}
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
            aria-label={`Delete sub-activity ${segment.subActivity.title}`}
            className="rounded-full text-danger"
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
