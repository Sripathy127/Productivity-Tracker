/**
 * Turns the flat activity list from the API into per-day, lane-packed segments
 * ready for rendering.
 *
 * Two problems are solved here:
 *
 * 1. **Midnight crossings.** An activity from 23:10 to 01:30 belongs on two day
 *    rows. It is split into one segment per day, each clipped to that day, and
 *    the cut edges are flagged so the bar can be drawn square with a
 *    continuation marker instead of pretending to end at midnight.
 *
 * 2. **Overlaps.** Two activities at the same time would otherwise draw on top
 *    of each other. Segments are greedily packed into lanes so overlapping work
 *    stacks vertically and the row grows to fit.
 */

import type { Activity, SubActivity } from "@/types/api";
import {
  addDays,
  formatDateKey,
  minuteOfDay,
  parseLocalDateTime,
  startOfDay,
} from "@/lib/date-utils";
import { MINUTES_PER_DAY } from "@/lib/timeline-geometry";

export interface SubActivitySegment {
  key: string;
  subActivity: SubActivity;
  startMinute: number;
  endMinute: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  /**
   * Sub-lane within the whole day, across every expanded activity.
   *
   * Packing per activity is wrong: the month grid draws all sub-bars in one
   * band beneath the parent lanes, so two expanded activities that overlap in
   * time would each claim lane 0 and draw on top of each other.
   */
  lane: number;
  /**
   * Sub-lane within this sub-activity's own parent. The mobile day view nests
   * chips inside their parent block, where only siblings can collide, so it
   * indents against this rather than the day-global lane.
   */
  laneWithinParent: number;
}

export interface ActivitySegment {
  key: string;
  activity: Activity;
  /** Minute-of-day at which this segment starts on its day (0–1440). */
  startMinute: number;
  endMinute: number;
  /** True when the activity began on an earlier day. */
  continuesBefore: boolean;
  /** True when the activity runs past this day's midnight. */
  continuesAfter: boolean;
  lane: number;
  /**
   * How many lanes this segment's own overlap cluster needs.
   *
   * Distinct from the day's `laneCount`: a day with one overlapping pair in the
   * afternoon should not squeeze the morning's single activity to half width.
   * The month grid stacks lanes vertically so it does not need this, but the
   * mobile day view divides the column horizontally and does.
   */
  clusterSize: number;
  subSegments: SubActivitySegment[];
}

export interface DayLayout {
  dateKey: string;
  date: Date;
  segments: ActivitySegment[];
  laneCount: number;
  /** Minutes tracked on this day, counting only the visible segments. */
  trackedMinutes: number;
}

interface Interval {
  startMinute: number;
  endMinute: number;
}

/** Split one absolute interval into per-day, clipped pieces. */
function splitByDay(
  startAt: Date,
  endAt: Date
): {
  dateKey: string;
  interval: Interval;
  clippedStart: boolean;
  clippedEnd: boolean;
}[] {
  const pieces: {
    dateKey: string;
    interval: Interval;
    clippedStart: boolean;
    clippedEnd: boolean;
  }[] = [];

  let cursorDay = startOfDay(startAt);
  // A guard rather than `while (true)`: nothing legal spans more than two days
  // (activities are capped at 24h), but a bad payload must not hang the UI.
  for (let guard = 0; guard < 3; guard += 1) {
    const dayStart = cursorDay;
    const nextDayStart = addDays(cursorDay, 1);
    if (dayStart >= endAt) break;

    const pieceStart = startAt > dayStart ? startAt : dayStart;
    const pieceEnd = endAt < nextDayStart ? endAt : nextDayStart;
    if (pieceEnd <= pieceStart) break;

    const startMinute = pieceStart > dayStart ? minuteOfDay(pieceStart) : 0;
    const endMinute = pieceEnd < nextDayStart ? minuteOfDay(pieceEnd) : MINUTES_PER_DAY;

    pieces.push({
      dateKey: formatDateKey(dayStart),
      interval: { startMinute, endMinute },
      clippedStart: pieceStart > startAt,
      clippedEnd: pieceEnd < endAt,
    });

    cursorDay = nextDayStart;
  }

  return pieces;
}

/**
 * Greedy interval-graph colouring: place each interval in the first lane whose
 * last occupant has already finished. Input must be sorted by start.
 */
function assignLanes<T extends Interval>(intervals: T[]): (T & { lane: number })[] {
  const laneEnds: number[] = [];
  return intervals.map((interval) => {
    let lane = laneEnds.findIndex((end) => end <= interval.startMinute);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(interval.endMinute);
    } else {
      laneEnds[lane] = interval.endMinute;
    }
    return { ...interval, lane };
  });
}

/**
 * Tags each interval with the lane count of its own overlap cluster.
 *
 * A cluster is a run of intervals with no gap between them; `clusterSize` is
 * the widest point in that run. Input must be sorted by start and already
 * lane-assigned.
 */
function assignClusterSizes<T extends Interval & { lane: number }>(
  intervals: T[]
): (T & { clusterSize: number })[] {
  const result: (T & { clusterSize: number })[] = [];
  let index = 0;

  while (index < intervals.length) {
    let clusterEnd = intervals[index].endMinute;
    let maxLane = intervals[index].lane;
    let end = index + 1;

    // Extend while the next interval starts before the cluster so far ends.
    while (end < intervals.length && intervals[end].startMinute < clusterEnd) {
      clusterEnd = Math.max(clusterEnd, intervals[end].endMinute);
      maxLane = Math.max(maxLane, intervals[end].lane);
      end += 1;
    }

    const clusterSize = maxLane + 1;
    for (let member = index; member < end; member += 1) {
      result.push({ ...intervals[member], clusterSize });
    }
    index = end;
  }

  return result;
}

function buildSubSegments(
  activity: Activity,
  dateKey: string,
  expanded: boolean
): SubActivitySegment[] {
  if (!expanded || activity.sub_activities.length === 0) return [];

  const raw: (Omit<SubActivitySegment, "lane" | "laneWithinParent"> & Interval)[] = [];
  for (const sub of activity.sub_activities) {
    const start = parseLocalDateTime(sub.start_at);
    const end = parseLocalDateTime(sub.end_at);
    for (const piece of splitByDay(start, end)) {
      if (piece.dateKey !== dateKey) continue;
      raw.push({
        key: `sub-${sub.id}-${piece.dateKey}`,
        subActivity: sub,
        startMinute: piece.interval.startMinute,
        endMinute: piece.interval.endMinute,
        continuesBefore: piece.clippedStart,
        continuesAfter: piece.clippedEnd,
      });
    }
  }

  raw.sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
  // `lane` here is provisional: `packSubLanesAcrossDay` rewrites it once every
  // activity on the day is known.
  return assignLanes(raw).map((sub) => ({
    ...sub,
    laneWithinParent: sub.lane,
  }));
}

/**
 * Re-packs every expanded activity's sub-bars into one shared set of lanes for
 * the day, so sub-bars belonging to different parents never overlap.
 *
 * Returns the new lane per segment key; parents keep their own
 * `laneWithinParent` untouched.
 */
function packSubLanesAcrossDay(
  segments: readonly ActivitySegment[]
): Map<string, number> {
  const all = segments
    .flatMap((segment) => segment.subSegments)
    .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

  const laneEnds: number[] = [];
  const laneByKey = new Map<string, number>();

  for (const sub of all) {
    let lane = laneEnds.findIndex((end) => end <= sub.startMinute);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(sub.endMinute);
    } else {
      laneEnds[lane] = sub.endMinute;
    }
    laneByKey.set(sub.key, lane);
  }

  return laneByKey;
}

export interface BuildLayoutOptions {
  days: Date[];
  activities: Activity[];
  /** Ids of activities whose sub-bars are currently shown. */
  expandedIds: ReadonlySet<number>;
}

export function buildMonthLayout({
  days,
  activities,
  expandedIds,
}: BuildLayoutOptions): DayLayout[] {
  const byDay = new Map<
    string,
    (Omit<ActivitySegment, "lane" | "clusterSize"> & Interval)[]
  >();
  for (const day of days) {
    byDay.set(formatDateKey(day), []);
  }

  for (const activity of activities) {
    const start = parseLocalDateTime(activity.start_at);
    const end = parseLocalDateTime(activity.end_at);

    for (const piece of splitByDay(start, end)) {
      const bucket = byDay.get(piece.dateKey);
      // Segments outside the rendered month are dropped, not clamped.
      if (bucket === undefined) continue;

      bucket.push({
        key: `activity-${activity.id}-${piece.dateKey}`,
        activity,
        startMinute: piece.interval.startMinute,
        endMinute: piece.interval.endMinute,
        continuesBefore: piece.clippedStart,
        continuesAfter: piece.clippedEnd,
        subSegments: buildSubSegments(
          activity,
          piece.dateKey,
          expandedIds.has(activity.id)
        ),
      });
    }
  }

  return days.map((day) => {
    const dateKey = formatDateKey(day);
    const raw = byDay.get(dateKey) ?? [];
    raw.sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

    const packed = assignClusterSizes(assignLanes(raw));
    const subLaneByKey = packSubLanesAcrossDay(packed);
    const segments = packed.map((segment) => ({
      ...segment,
      subSegments: segment.subSegments.map((sub) => ({
        ...sub,
        lane: subLaneByKey.get(sub.key) ?? sub.lane,
      })),
    }));

    const laneCount = segments.reduce(
      (max, segment) => Math.max(max, segment.lane + 1),
      0
    );
    const trackedMinutes = segments.reduce(
      (total, segment) => total + (segment.endMinute - segment.startMinute),
      0
    );

    return { dateKey, date: day, segments, laneCount, trackedMinutes };
  });
}

/** Deepest sub-lane stack across a day's expanded segments. */
export function subLaneCountFor(layout: DayLayout): number {
  // Lanes are shared across the day, so this is one flat maximum rather than a
  // maximum of per-activity depths.
  return layout.segments.reduce(
    (max, segment) =>
      segment.subSegments.reduce((inner, sub) => Math.max(inner, sub.lane + 1), max),
    0
  );
}
