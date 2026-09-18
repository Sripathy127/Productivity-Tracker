/**
 * The single source of truth for the timeline's time-to-pixel mapping.
 *
 * Every bar, grid line, header tick and now-marker derives its position from
 * `pxPerMinute`, so changing zoom can never desynchronise them.
 *
 * An hour is divided into 30 slots of 2 minutes. That grid is a *visual and
 * snapping* aid only — stored and rendered times keep full minute precision,
 * so an activity starting at 03:53 lands exactly on 03:53 and not on the
 * nearest slot boundary.
 */

export const HOURS_PER_DAY = 24;
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;

/** Minutes per grid cell: 30 cells per hour. */
export const SLOT_MINUTES = 2;
export const SLOTS_PER_HOUR = MINUTES_PER_HOUR / SLOT_MINUTES;
export const SLOTS_PER_DAY = SLOTS_PER_HOUR * HOURS_PER_DAY;

/** Width of the sticky left-hand day panel, in pixels. */
export const DAY_PANEL_WIDTH = 216;

/** Vertical metrics of a day row. */
export const LANE_HEIGHT = 44;
export const LANE_GAP = 4;
export const ROW_PADDING_Y = 8;
export const SUB_LANE_HEIGHT = 26;
export const SUB_LANE_GAP = 3;

/** A bar this short would be unclickable, so it is floored to this width. */
export const MIN_BAR_WIDTH = 10;

export const ZOOM_LEVELS = [
  { id: "compact", label: "Compact", hourWidth: 120 },
  { id: "default", label: "Default", hourWidth: 240 },
  { id: "detailed", label: "Detailed", hourWidth: 480 },
] as const;

export type ZoomId = (typeof ZOOM_LEVELS)[number]["id"];
export const DEFAULT_ZOOM: ZoomId = "default";

export interface TimelineGeometry {
  /** Width of one hour column in pixels. */
  hourWidth: number;
  /** Pixels per minute — the scalar everything else is derived from. */
  pxPerMinute: number;
  /** Width of one 2-minute grid cell in pixels. */
  slotWidth: number;
  /** Total scrollable width of the 24-hour lane area. */
  laneWidth: number;
  /** Full content width including the sticky day panel. */
  contentWidth: number;
}

export function buildGeometry(hourWidth: number): TimelineGeometry {
  const pxPerMinute = hourWidth / MINUTES_PER_HOUR;
  return {
    hourWidth,
    pxPerMinute,
    slotWidth: pxPerMinute * SLOT_MINUTES,
    laneWidth: hourWidth * HOURS_PER_DAY,
    contentWidth: hourWidth * HOURS_PER_DAY + DAY_PANEL_WIDTH,
  };
}

export function geometryForZoom(zoom: ZoomId): TimelineGeometry {
  const level = ZOOM_LEVELS.find((entry) => entry.id === zoom) ?? ZOOM_LEVELS[1];
  return buildGeometry(level.hourWidth);
}

/** Horizontal offset, in pixels, of a minute-of-day on the lane. */
export function minutesToPx(minuteOfDay: number, geometry: TimelineGeometry): number {
  return minuteOfDay * geometry.pxPerMinute;
}

/** Inverse of {@link minutesToPx}, clamped to the day and rounded to a slot. */
export function pxToSnappedMinutes(
  offsetPx: number,
  geometry: TimelineGeometry
): number {
  const rawMinutes = offsetPx / geometry.pxPerMinute;
  const snapped = Math.round(rawMinutes / SLOT_MINUTES) * SLOT_MINUTES;
  return clampMinuteOfDay(snapped);
}

export function clampMinuteOfDay(minute: number): number {
  if (Number.isNaN(minute)) return 0;
  return Math.min(Math.max(minute, 0), MINUTES_PER_DAY);
}

export interface BarBox {
  left: number;
  width: number;
}

/**
 * Pixel box for an interval expressed in minutes-of-day.
 *
 * The right edge is computed from the *end* minute rather than from a rounded
 * width, so adjacent bars stay pixel-flush and a 48-minute bar is exactly
 * 48 minutes wide at every zoom level.
 */
export function intervalToBox(
  startMinute: number,
  endMinute: number,
  geometry: TimelineGeometry
): BarBox {
  const left = minutesToPx(clampMinuteOfDay(startMinute), geometry);
  const right = minutesToPx(clampMinuteOfDay(endMinute), geometry);
  return { left, width: Math.max(right - left, MIN_BAR_WIDTH) };
}

/** Height of a day row given how many parent lanes and sub-lanes it shows. */
export function rowHeight(laneCount: number, subLaneCount: number): number {
  const lanes = Math.max(laneCount, 1);
  const parentHeight = lanes * LANE_HEIGHT + (lanes - 1) * LANE_GAP;
  const subHeight =
    subLaneCount > 0
      ? subLaneCount * SUB_LANE_HEIGHT +
        (subLaneCount - 1) * SUB_LANE_GAP +
        SUB_LANE_GAP
      : 0;
  return parentHeight + subHeight + ROW_PADDING_Y * 2;
}

/**
 * Background for the lane area: 2-minute minor lines, 10-minute mid lines and
 * a stronger line on the hour, painted as stacked gradients.
 *
 * Drawing 720 slot boundaries per row as elements would mean ~22k DOM nodes for
 * a 31-day month; as gradients it costs nothing.
 */
export function laneBackgroundImage(geometry: TimelineGeometry): string {
  const { slotWidth, hourWidth, pxPerMinute } = geometry;
  const tenMinuteWidth = pxPerMinute * 10;
  const layers: string[] = [];

  // Minor 2-minute lines are hidden when they would be denser than ~4px.
  if (slotWidth >= 4) {
    layers.push(
      `repeating-linear-gradient(to right, var(--grid-minor) 0 1px, transparent 1px ${slotWidth}px)`
    );
  }
  layers.push(
    `repeating-linear-gradient(to right, var(--grid-quarter) 0 1px, transparent 1px ${tenMinuteWidth}px)`,
    `repeating-linear-gradient(to right, var(--grid-hour) 0 1px, transparent 1px ${hourWidth}px)`,
    // Alternating hour bands make it easier to count across a wide row.
    `repeating-linear-gradient(to right, var(--grid-band) 0 ${hourWidth}px, transparent ${hourWidth}px ${hourWidth * 2}px)`
  );

  return layers.join(", ");
}

export const HOUR_SEQUENCE: readonly number[] = Array.from(
  { length: HOURS_PER_DAY },
  (_, hour) => hour
);

/* ===========================================================================
   Vertical axis — the mobile day view.

   On a phone the same day is rendered with time running top to bottom, which
   is the only orientation where a 24-hour span is legible on a 375px screen.
   The mapping is intentionally the *same* one, just applied to the other axis,
   so a 03:53 start is as exact here as it is on the month grid.
=========================================================================== */

/** Height of one hour band in the mobile day view, in pixels. */
export const MOBILE_HOUR_HEIGHT = 92;
/** Width of the sticky hour-label gutter. */
export const MOBILE_GUTTER_WIDTH = 54;
/** Horizontal inset of one nesting level, so sub-bars read as contained. */
export const MOBILE_LANE_INSET = 14;
export const MOBILE_MIN_BAR_HEIGHT = 26;

export interface VerticalGeometry {
  hourHeight: number;
  pxPerMinute: number;
  slotHeight: number;
  /** Total height of the 24-hour column. */
  columnHeight: number;
}

export function buildVerticalGeometry(hourHeight: number): VerticalGeometry {
  const pxPerMinute = hourHeight / MINUTES_PER_HOUR;
  return {
    hourHeight,
    pxPerMinute,
    slotHeight: pxPerMinute * SLOT_MINUTES,
    columnHeight: hourHeight * HOURS_PER_DAY,
  };
}

export interface VerticalBox {
  top: number;
  height: number;
}

/** Vertical box for an interval expressed in minutes-of-day. */
export function intervalToVerticalBox(
  startMinute: number,
  endMinute: number,
  geometry: VerticalGeometry
): VerticalBox {
  const top = clampMinuteOfDay(startMinute) * geometry.pxPerMinute;
  const bottom = clampMinuteOfDay(endMinute) * geometry.pxPerMinute;
  return {
    top,
    height: Math.max(bottom - top, MOBILE_MIN_BAR_HEIGHT),
  };
}

/** Inverse: a y-offset on the column, snapped to the 2-minute grid. */
export function verticalPxToSnappedMinutes(
  offsetPx: number,
  geometry: VerticalGeometry
): number {
  const rawMinutes = offsetPx / geometry.pxPerMinute;
  const snapped = Math.round(rawMinutes / SLOT_MINUTES) * SLOT_MINUTES;
  return clampMinuteOfDay(snapped);
}

/**
 * Horizontal grid lines for the day column: one per hour, plus quarter-hour
 * lines. Painted as a gradient for the same reason the month grid is.
 */
export function dayColumnBackgroundImage(geometry: VerticalGeometry): string {
  const quarterHeight = geometry.pxPerMinute * 15;
  return [
    `repeating-linear-gradient(to bottom, var(--grid-minor) 0 1px, transparent 1px ${quarterHeight}px)`,
    `repeating-linear-gradient(to bottom, var(--grid-hour) 0 1px, transparent 1px ${geometry.hourHeight}px)`,
    `repeating-linear-gradient(to bottom, var(--grid-band) 0 ${geometry.hourHeight}px, transparent ${geometry.hourHeight}px ${geometry.hourHeight * 2}px)`,
  ].join(", ");
}
