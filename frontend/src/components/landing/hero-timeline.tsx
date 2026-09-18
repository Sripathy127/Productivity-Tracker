/**
 * The hero visual: three real day rows built from the app's own geometry.
 *
 * Not a screenshot and not a decorative graphic — it uses `intervalToBox` and
 * the same colour family the app seeds, so what the landing page promises is
 * what the product renders. The bars grow in from the left on load, the way a
 * day actually fills.
 *
 * `hourWidth` is a prop so the strip can be tightened on narrow screens
 * without ever falling back to a flat image.
 */

import { formatDuration } from "@/lib/date-utils";
import { CATEGORY_SLOTS, subActivityFill } from "@/lib/category-palette";
import { buildGeometry, intervalToBox } from "@/lib/timeline-geometry";

/** Hours shown in the strip: a working window, not all 24. */
const FIRST_HOUR = 8;
const LAST_HOUR = 11;

// The validated categorical slots, so the marketing visual shows the real
// colours the app paints.
const COLOR_DEEP = CATEGORY_SLOTS[0].light;
const COLOR_MEETING = CATEGORY_SLOTS[1].light;
const COLOR_LEARNING = CATEGORY_SLOTS[2].light;
const COLOR_BREAK = CATEGORY_SLOTS[4].light;

interface HeroBar {
  label: string;
  startMinute: number;
  endMinute: number;
  color: string;
  lane: 0 | 1;
}

interface HeroRow {
  day: number;
  weekday: string;
  bars: HeroBar[];
  subBars?: HeroBar[];
}

const at = (hour: number, minute: number) => hour * 60 + minute;

const ROWS: HeroRow[] = [
  {
    day: 16,
    weekday: "Tue",
    bars: [
      {
        label: "Timeline geometry",
        startMinute: at(8, 42),
        endMinute: at(10, 26),
        color: COLOR_DEEP,
        lane: 0,
      },
      {
        label: "Review",
        startMinute: at(10, 38),
        endMinute: at(11, 44),
        color: COLOR_LEARNING,
        lane: 0,
      },
    ],
  },
  {
    day: 17,
    weekday: "Wed",
    bars: [
      {
        label: "Migration work",
        startMinute: at(8, 12),
        endMinute: at(11, 44),
        color: COLOR_DEEP,
        lane: 0,
      },
      {
        label: "Standup",
        startMinute: at(9, 30),
        endMinute: at(9, 48),
        color: COLOR_MEETING,
        lane: 1,
      },
      {
        label: "Coffee",
        startMinute: at(10, 24),
        endMinute: at(10, 52),
        color: COLOR_BREAK,
        lane: 1,
      },
    ],
    subBars: [
      {
        label: "Read the spec",
        startMinute: at(8, 12),
        endMinute: at(8, 54),
        color: COLOR_DEEP,
        lane: 0,
      },
      {
        label: "Write the adapter",
        startMinute: at(8, 54),
        endMinute: at(10, 48),
        color: COLOR_DEEP,
        lane: 0,
      },
      {
        label: "Verify",
        startMinute: at(10, 48),
        endMinute: at(11, 44),
        color: COLOR_DEEP,
        lane: 0,
      },
    ],
  },
  {
    day: 18,
    weekday: "Thu",
    bars: [
      {
        label: "Debugging, from 08:53",
        startMinute: at(8, 53),
        endMinute: at(10, 7),
        color: COLOR_DEEP,
        lane: 0,
      },
      {
        label: "Interview panel",
        startMinute: at(10, 30),
        endMinute: at(11, 45),
        color: COLOR_MEETING,
        lane: 0,
      },
    ],
  },
];

const LANE_H = 32;
const SUB_LANE_H = 20;

export function HeroTimeline({ hourWidth = 128 }: { hourWidth?: number }) {
  const geometry = buildGeometry(hourWidth);
  const hours = Array.from(
    { length: LAST_HOUR - FIRST_HOUR + 1 },
    (_, index) => FIRST_HOUR + index
  );
  const stripWidth = hours.length * hourWidth;
  const panelWidth = Math.round(hourWidth * 0.55);

  const offsetOf = (minute: number) =>
    intervalToBox(minute - FIRST_HOUR * 60, minute - FIRST_HOUR * 60, geometry).left;

  let delayStep = 0;

  return (
    <figure className="m-0 overflow-hidden rounded-3xl border border-rule bg-card shadow-lift-3">
      <figcaption className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-3">
        <span className="label-soft">September 2026</span>
        <span className="readout text-[11px] text-ink-muted">
          30 &times; 2 min per hour
        </span>
      </figcaption>

      <div style={{ width: `${stripWidth + panelWidth}px` }}>
        <div className="flex border-b border-rule">
          <div className="shrink-0" style={{ width: `${panelWidth}px` }} />
          <div className="flex">
            {hours.map((hour) => (
              <div
                key={hour}
                className="shrink-0 border-l border-rule px-2 py-1.5"
                style={{ width: `${hourWidth}px` }}
              >
                <span className="readout text-[11px] font-semibold text-ink-muted">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>
        </div>

        {ROWS.map((row) => {
          const laneCount = row.bars.some((bar) => bar.lane === 1) ? 2 : 1;
          const hasSubs = row.subBars !== undefined;
          const height = laneCount * LANE_H + (hasSubs ? SUB_LANE_H + 6 : 0) + 14;

          return (
            <div
              key={row.day}
              className="flex border-b border-rule last:border-b-0"
              style={{ height: `${height}px` }}
            >
              <div
                className="flex shrink-0 items-center gap-2 border-r border-rule px-3"
                style={{ width: `${panelWidth}px` }}
              >
                <span className="readout display text-lg leading-none text-ink">
                  {row.day}
                </span>
                <span className="label-soft mb-0 hidden sm:inline">{row.weekday}</span>
              </div>

              <div
                className="relative shrink-0"
                style={{
                  width: `${stripWidth}px`,
                  backgroundImage:
                    "repeating-linear-gradient(to right, var(--grid-minor) 0 1px, transparent 1px 8.5px)",
                }}
              >
                {row.bars.map((bar) => {
                  delayStep += 1;
                  const left = offsetOf(bar.startMinute);
                  const width = offsetOf(bar.endMinute) - left;
                  const duration = bar.endMinute - bar.startMinute;
                  return (
                    <div
                      key={bar.label}
                      className="animate-grow-x absolute flex items-center gap-2 overflow-hidden rounded-full px-2.5 text-white shadow-lift-1"
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                        top: `${7 + bar.lane * LANE_H}px`,
                        height: `${LANE_H - 7}px`,
                        backgroundColor: bar.color,
                        animationDelay: `${delayStep * 80}ms`,
                      }}
                      title={`${bar.label} · ${formatDuration(duration)}`}
                    >
                      <span className="truncate text-[11px] font-semibold">
                        {bar.label}
                      </span>
                      {width > 165 && (
                        <span className="readout ml-auto shrink-0 text-[10px] opacity-85">
                          {formatDuration(duration)}
                        </span>
                      )}
                    </div>
                  );
                })}

                {row.subBars?.map((bar) => {
                  delayStep += 1;
                  const left = offsetOf(bar.startMinute);
                  const width = offsetOf(bar.endMinute) - left;
                  return (
                    <div
                      key={`sub-${bar.label}`}
                      className="animate-grow-x absolute flex items-center overflow-hidden rounded-full border px-2 text-ink"
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                        top: `${7 + laneCount * LANE_H + 3}px`,
                        height: `${SUB_LANE_H}px`,
                        borderColor: bar.color,
                        backgroundColor: subActivityFill(bar.color, false),
                        animationDelay: `${delayStep * 80}ms`,
                      }}
                      title={bar.label}
                    >
                      <span className="truncate text-[10px] font-medium">
                        {bar.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
