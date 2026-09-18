/**
 * The phone timeline: one day at a time, with time running top to bottom.
 *
 * A 24-hour x 31-day grid cannot be read on a 375px screen, so on mobile the
 * axis rotates. The mapping is the same one the month grid uses, applied to the
 * vertical axis, so a 03:53 start is exactly as precise here.
 *
 * Days are laid out as a horizontally snapping pager, so swiping moves between
 * days with native momentum rather than a custom gesture handler.
 */

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { MobileActivityBlock } from "@/components/timeline/mobile-activity-block";
import { Button } from "@/components/ui/button";
import {
  WEEKDAY_NAMES,
  formatDuration,
  formatHourLabel,
  isWeekend,
  nowMinuteWithinDay,
} from "@/lib/date-utils";
import {
  HOUR_SEQUENCE,
  MOBILE_GUTTER_WIDTH,
  MOBILE_HOUR_HEIGHT,
  buildVerticalGeometry,
  dayColumnBackgroundImage,
  verticalPxToSnappedMinutes,
} from "@/lib/timeline-geometry";
import type { DayLayout } from "@/lib/timeline-layout";
import { cn } from "@/lib/utils";
import type { DayRowHandlers } from "@/components/timeline/day-row";

const geometry = buildVerticalGeometry(MOBILE_HOUR_HEIGHT);

export function MobileDayView({
  layouts,
  activeIndex,
  onActiveIndexChange,
  expandedIds,
  use24Hour,
  now,
  handlers,
}: {
  layouts: DayLayout[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  expandedIds: ReadonlySet<number>;
  use24Hour: boolean;
  now: Date;
  handlers: DayRowHandlers;
}) {
  const pagerRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const activeChipRef = useRef<HTMLButtonElement>(null);
  // Suppresses the scroll listener while we are the ones scrolling.
  const programmaticScroll = useRef(false);

  const clampedIndex = Math.min(Math.max(activeIndex, 0), layouts.length - 1);
  const active = layouts[clampedIndex];

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const pager = pagerRef.current;
    if (pager === null) return;
    programmaticScroll.current = true;
    pager.scrollTo({
      left: index * pager.clientWidth,
      behavior: smooth ? "smooth" : "instant",
    });
    // Released after the smooth scroll has had time to finish.
    window.setTimeout(
      () => {
        programmaticScroll.current = false;
      },
      smooth ? 420 : 60
    );
  }, []);

  // Keep the pager in step when the day is changed from outside (the date
  // strip, the arrows, or a month change).
  useEffect(() => {
    scrollToIndex(clampedIndex, false);
  }, [clampedIndex, layouts.length, scrollToIndex]);

  // The strip holds up to 31 chips and only about six fit, so the selected one
  // has to be brought into view or the strip and the heading disagree.
  useEffect(() => {
    // Called synchronously: effects run after the DOM is committed, and
    // `scrollIntoView` forces the layout it needs, so there is nothing to wait
    // for. Deliberately *not* wrapped in `requestAnimationFrame` — rAF does not
    // fire at all while a document is hidden (a background tab, or a headless
    // preview pane), which would silently skip the scroll.
    //
    // `behavior: "instant"` because a smooth scroll here is interrupted by the
    // scroll-snap pager settling in the effect above.
    activeChipRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "instant",
    });
  }, [clampedIndex]);

  const handlePagerScroll = () => {
    const pager = pagerRef.current;
    if (pager === null || programmaticScroll.current) return;
    const index = Math.round(pager.scrollLeft / pager.clientWidth);
    if (index !== clampedIndex && index >= 0 && index < layouts.length) {
      onActiveIndexChange(index);
    }
  };

  const handleColumnClick = (
    event: React.MouseEvent<HTMLDivElement>,
    layout: DayLayout
  ) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - bounds.top;
    handlers.onCreateAt(layout.date, verticalPxToSnappedMinutes(offsetY, geometry));
  };

  return (
    <div className="flex h-full flex-col">
      {/* ------------------------------------------------- day selector strip */}
      <div className="shrink-0 border-b border-rule bg-card">
        <div className="flex items-center gap-1 px-2 py-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous day"
            disabled={clampedIndex === 0}
            onClick={() => onActiveIndexChange(clampedIndex - 1)}
          >
            <ChevronLeftIcon />
          </Button>

          <div className="scroll-hidden flex flex-1 gap-1.5 overflow-x-auto px-1">
            {layouts.map((layout, index) => {
              const isActive = index === clampedIndex;
              const isToday = nowMinuteWithinDay(layout.date, now) !== null;
              return (
                <button
                  key={layout.dateKey}
                  ref={isActive ? activeChipRef : undefined}
                  type="button"
                  aria-current={isActive ? "date" : undefined}
                  onClick={() => onActiveIndexChange(index)}
                  className={cn(
                    "flex min-w-11 shrink-0 flex-col items-center rounded-xl px-2 py-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-clay",
                    isActive
                      ? "bg-clay text-white shadow-lift-1"
                      : "text-ink-secondary hover:bg-card-sunken"
                  )}
                >
                  <span className="readout text-base font-semibold leading-none">
                    {layout.date.getDate()}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 text-[10px] font-medium uppercase tracking-wide",
                      isActive
                        ? "text-white/80"
                        : isWeekend(layout.date)
                          ? "text-clay"
                          : "text-ink-muted"
                    )}
                  >
                    {WEEKDAY_NAMES[layout.date.getDay()]}
                  </span>
                  {/* A dot marks days with something logged, so the strip
                      doubles as a density overview of the month. */}
                  <span
                    className={cn(
                      "mt-1 h-1 w-1 rounded-full",
                      layout.trackedMinutes > 0
                        ? isActive
                          ? "bg-white"
                          : isToday
                            ? "bg-clay"
                            : "bg-ink-muted"
                        : "bg-transparent"
                    )}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Next day"
            disabled={clampedIndex === layouts.length - 1}
            onClick={() => onActiveIndexChange(clampedIndex + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>

        <div className="flex items-baseline justify-between gap-3 border-t border-rule px-4 py-2">
          <p className="display text-lg text-ink">
            {active.date.toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <p className="readout shrink-0 text-sm font-semibold text-clay">
            {active.trackedMinutes > 0 ? formatDuration(active.trackedMinutes) : "—"}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------- swiping pager */}
      <div
        ref={pagerRef}
        onScroll={handlePagerScroll}
        className="scroll-hidden flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
      >
        {layouts.map((layout, index) => {
          const nowMinute = nowMinuteWithinDay(layout.date, now);
          // Only the neighbours are rendered: 31 full day columns would be a
          // lot of DOM for a phone, and the pager only ever shows three.
          const isNear = Math.abs(index - clampedIndex) <= 1;

          return (
            <section
              key={layout.dateKey}
              className="w-full shrink-0 snap-start"
              aria-label={layout.date.toDateString()}
              aria-hidden={index !== clampedIndex}
            >
              {isNear ? (
                <div
                  ref={index === clampedIndex ? columnRef : undefined}
                  className="timeline-scroll h-full overflow-y-auto"
                >
                  <div className="flex">
                    {/* hour gutter */}
                    <div
                      className="sticky left-0 z-10 shrink-0 bg-sand"
                      style={{
                        width: `${MOBILE_GUTTER_WIDTH}px`,
                        height: `${geometry.columnHeight}px`,
                      }}
                    >
                      {HOUR_SEQUENCE.map((hour) => (
                        <div
                          key={hour}
                          className="relative"
                          style={{ height: `${geometry.hourHeight}px` }}
                        >
                          <span className="readout absolute -top-[7px] right-2 text-[11px] font-medium text-ink-muted">
                            {formatHourLabel(hour, use24Hour)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* the day column */}
                    <div
                      className={cn(
                        "relative flex-1 cursor-copy",
                        isWeekend(layout.date) && "bg-weekend"
                      )}
                      style={{
                        height: `${geometry.columnHeight}px`,
                        backgroundImage: dayColumnBackgroundImage(geometry),
                      }}
                      onClick={(event) => handleColumnClick(event, layout)}
                    >
                      {nowMinute !== null && (
                        <div
                          className="pointer-events-none absolute inset-x-0 z-20 h-px bg-now"
                          style={{ top: `${nowMinute * geometry.pxPerMinute}px` }}
                          aria-hidden="true"
                        >
                          <span className="absolute -top-1 left-0 h-2 w-2 rounded-full bg-now" />
                        </div>
                      )}

                      {layout.segments.map((segment) => (
                        <MobileActivityBlock
                          key={segment.key}
                          segment={segment}
                          geometry={geometry}
                          isExpanded={expandedIds.has(segment.activity.id)}
                          use24Hour={use24Hour}
                          onToggleExpand={() =>
                            handlers.onToggleExpand(segment.activity.id)
                          }
                          onEdit={() => handlers.onEditActivity(segment.activity)}
                          onDelete={() => handlers.onDeleteActivity(segment.activity)}
                          onEditSub={(sub) =>
                            handlers.onEditSubActivity(sub, segment.activity)
                          }
                          onDeleteSub={handlers.onDeleteSubActivity}
                        />
                      ))}

                      {layout.segments.length === 0 && (
                        <p className="pointer-events-none absolute inset-x-4 top-[33%] text-center text-sm text-ink-muted">
                          Nothing logged yet.
                          <br />
                          Tap any time to add something.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full" />
              )}
            </section>
          );
        })}
      </div>

      {/* --------------------------------------------------- floating add CTA */}
      <Button
        variant="primary"
        size="lg"
        className="absolute bottom-5 right-5 z-30 rounded-full px-5 shadow-lift-3"
        onClick={() =>
          handlers.onCreateAt(
            active.date,
            nowMinuteWithinDay(active.date, now) ?? 9 * 60
          )
        }
      >
        <PlusIcon />
        Add
      </Button>
    </div>
  );
}
