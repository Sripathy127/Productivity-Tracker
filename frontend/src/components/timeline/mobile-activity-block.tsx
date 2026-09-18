/**
 * One activity as a vertical block in the mobile day view.
 *
 * Expanding nests the sub-activities *inside* the parent block, inset from its
 * left edge, so containment is visible: a sub-activity is literally drawn
 * within the bounds of the thing it belongs to.
 */

import {
  ChevronDownIcon,
  ChevronRightIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { formatClock, formatDuration, parseLocalDateTime } from "@/lib/date-utils";
import {
  MOBILE_LANE_INSET,
  intervalToVerticalBox,
  type VerticalGeometry,
} from "@/lib/timeline-geometry";
import type { ActivitySegment, SubActivitySegment } from "@/lib/timeline-layout";
import type { SubActivity } from "@/types/api";
import { resolveCategoryColor, subActivityFill } from "@/lib/category-palette";
import { useIsDarkScheme } from "@/hooks/use-media-query";
import { cn, readableTextColor } from "@/lib/utils";

/** Space the parent's own title occupies at the top of the block. */
const HEADER_HEIGHT = 30;
/** Below this height the block can only show its title. */
const HEIGHT_FOR_DETAIL = 46;
const HEIGHT_FOR_ACTIONS = 78;
const MIN_CHIP_HEIGHT = 22;
const CHIP_HEIGHT_FOR_TIME = 34;

export function MobileActivityBlock({
  segment,
  geometry,
  isExpanded,
  use24Hour,
  onToggleExpand,
  onEdit,
  onDelete,
  onEditSub,
  onDeleteSub,
}: {
  segment: ActivitySegment;
  geometry: VerticalGeometry;
  isExpanded: boolean;
  use24Hour: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditSub: (subActivity: SubActivity) => void;
  onDeleteSub: (subActivity: SubActivity) => void;
}) {
  const { activity, startMinute, endMinute, continuesBefore, continuesAfter } = segment;
  const box = intervalToVerticalBox(startMinute, endMinute, geometry);
  const isDark = useIsDarkScheme();
  const color = resolveCategoryColor(activity.category?.color, isDark);
  const textColor = readableTextColor(color);
  const hasChildren = activity.sub_activities.length > 0;
  const Chevron = isExpanded ? ChevronDownIcon : ChevronRightIcon;

  const trueStart = parseLocalDateTime(activity.start_at);
  const trueEnd = parseLocalDateTime(activity.end_at);
  const totalMinutes = Math.round((trueEnd.getTime() - trueStart.getTime()) / 60_000);

  // Only genuinely concurrent activities share the column's width, so a single
  // morning activity stays full width even if the afternoon has an overlap.
  const laneWidthPercent = 100 / Math.max(segment.clusterSize, 1);

  return (
    <div
      className={cn(
        "animate-grow-y absolute overflow-hidden shadow-lift-1",
        continuesBefore ? "rounded-t-none" : "rounded-t-xl",
        continuesAfter ? "rounded-b-none" : "rounded-b-xl"
      )}
      style={{
        top: `${box.top}px`,
        height: `${box.height}px`,
        left: `calc(${segment.lane * laneWidthPercent}% + 6px)`,
        width: `calc(${laneWidthPercent}% - 12px)`,
        backgroundColor: color,
        color: textColor,
        borderTop: continuesBefore ? `2px dashed ${textColor}55` : undefined,
        borderBottom: continuesAfter ? `2px dashed ${textColor}55` : undefined,
      }}
    >
      <button
        type="button"
        onClick={hasChildren ? onToggleExpand : onEdit}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-label={
          hasChildren
            ? `${isExpanded ? "Hide" : "Show"} the ${activity.sub_activities.length} parts of ${activity.title}`
            : `Edit ${activity.title}`
        }
        className="sticky top-0 z-30 flex w-full items-start gap-1.5 rounded-t-xl px-2.5 pb-1 pt-1.5 text-left outline-none backdrop-blur-[2px] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
      >
        {hasChildren && <Chevron className="mt-0.5 size-4 shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-tight">
            {activity.title}
          </span>
          {box.height >= HEIGHT_FOR_DETAIL && (
            <span className="readout mt-0.5 block text-[11px] opacity-85">
              {formatClock(trueStart, use24Hour)} – {formatClock(trueEnd, use24Hour)} ·{" "}
              {formatDuration(totalMinutes)}
            </span>
          )}
        </span>
      </button>

      {isExpanded &&
        segment.subSegments.map((sub) => (
          <SubChip
            key={sub.key}
            sub={sub}
            parentTop={box.top}
            parentColor={color}
            geometry={geometry}
            use24Hour={use24Hour}
            isDark={isDark}
            onEdit={() => onEditSub(sub.subActivity)}
            onDelete={() => onDeleteSub(sub.subActivity)}
          />
        ))}

      {box.height >= HEIGHT_FOR_ACTIONS && !isExpanded && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 px-1.5 pb-1.5">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${activity.title}`}
            className="rounded-lg p-1.5 transition-colors hover:bg-black/15 active:bg-black/25 outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <PencilIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${activity.title}`}
            className="rounded-lg p-1.5 transition-colors hover:bg-black/15 active:bg-black/25 outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * A nested sub-activity chip.
 *
 * Its top is its true offset within the parent, floored to just below the
 * parent's title so the title is never covered. Only the floor is applied —
 * nothing is ever *scaled* — so relative spacing and ordering stay truthful,
 * and the chip always shows its real start time as text.
 */
function SubChip({
  sub,
  parentTop,
  parentColor,
  geometry,
  use24Hour,
  isDark,
  onEdit,
  onDelete,
}: {
  sub: SubActivitySegment;
  parentTop: number;
  parentColor: string;
  geometry: VerticalGeometry;
  use24Hour: boolean;
  isDark: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const subBox = intervalToVerticalBox(sub.startMinute, sub.endMinute, geometry);
  const top = Math.max(subBox.top - parentTop, HEADER_HEIGHT);
  const height = Math.max(subBox.height, MIN_CHIP_HEIGHT);

  const start = parseLocalDateTime(sub.subActivity.start_at);
  const end = parseLocalDateTime(sub.subActivity.end_at);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);

  return (
    <div
      className="absolute z-20 flex items-start gap-1 overflow-hidden rounded-lg border pl-2 pr-1 text-ink shadow-lift-1"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        // Siblings indent against the parent-local lane; the day-global lane
        // is for the month grid, where all parents share one band.
        left: `${MOBILE_LANE_INSET + sub.laneWithinParent * 8}px`,
        right: "6px",
        borderColor: parentColor,
        backgroundColor: subActivityFill(parentColor, isDark),
      }}
    >
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit sub-activity ${sub.subActivity.title}`}
        className="min-w-0 flex-1 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-clay"
      >
        <span className="block truncate text-[11px] font-semibold leading-tight">
          {sub.subActivity.title}
        </span>
        {height >= CHIP_HEIGHT_FOR_TIME && (
          <span className="readout block text-[10px] text-ink-muted">
            {formatClock(start, use24Hour)} – {formatClock(end, use24Hour)} ·{" "}
            {formatDuration(minutes)}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete sub-activity ${sub.subActivity.title}`}
        className="mt-0.5 shrink-0 rounded-md p-1 text-danger transition-colors hover:bg-danger-wash outline-none focus-visible:ring-2 focus-visible:ring-clay"
      >
        <Trash2Icon className="size-3" />
      </button>
    </div>
  );
}
