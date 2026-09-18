/**
 * Month totals as a single compact strip.
 *
 * One line on purpose: this is reference information sitting above the thing
 * you came to use, so it takes the least height that still reads. Label and
 * value share a baseline rather than stacking, which is what makes one line
 * possible.
 *
 * Two data-viz rules drive the split bar:
 *
 *   1. **The legend is always present.** Identity must never be carried by
 *      colour alone, so every category is named whatever the viewport width —
 *      the strip scrolls rather than dropping the key. (It previously showed
 *      only the top three, and only above 1280px, which left the bar as an
 *      unexplained row of colours.)
 *   2. **Segments render in fixed palette order, not sorted by size.** The
 *      palette's ordering is what guarantees neighbouring segments are
 *      distinguishable under colour-vision deficiency; sorting by size would
 *      make any pair adjacent, which the palette does not clear. Order comes
 *      from `category_id`, with the uncategorised bucket last.
 *
 * Durations are printed in the legend rather than left to tooltips: a value that
 * is only reachable by hovering is not reachable at all for a keyboard or touch
 * user. The strip scrolls horizontally when the legend outgrows the line, which
 * keeps every value visible text.
 */

import { formatDuration } from "@/lib/date-utils";
import { resolveCategoryColor } from "@/lib/category-palette";
import { useIsDarkScheme } from "@/hooks/use-media-query";
import type { CategoryTotal, MonthStats } from "@/types/api";
import { cn } from "@/lib/utils";

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-baseline gap-1.5">
      <span className="label-soft mb-0">{label}</span>
      <span
        // Proportional figures, not `.readout`: these sit inline rather than in
        // a vertical column, so equal-width digits only make them look loose.
        className={cn(
          "text-[15px] font-semibold leading-none",
          accent ? "text-clay" : "text-ink"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <span className="h-4 w-px shrink-0 bg-rule" aria-hidden="true" />;
}

const STRIP_CLASS =
  "scroll-hidden flex items-center gap-3 overflow-x-auto rounded-2xl border border-rule bg-card px-3.5 py-2 shadow-lift-1";

/** Fixed order: by category id, with the uncategorised bucket last. */
function inPaletteOrder(entries: CategoryTotal[]): CategoryTotal[] {
  return [...entries].sort((a, b) => {
    if (a.category_id === null) return 1;
    if (b.category_id === null) return -1;
    return a.category_id - b.category_id;
  });
}

export function MonthSummary({
  stats,
  compact = false,
}: {
  stats: MonthStats | undefined;
  compact?: boolean;
}) {
  const isDark = useIsDarkScheme();

  if (stats === undefined) {
    return (
      <div className={STRIP_CLASS} aria-hidden="true">
        {["Tracked", "Activities", "Days", "Avg / day"].map((label) => (
          <div key={label} className="flex shrink-0 items-baseline gap-1.5">
            <span className="label-soft mb-0">{label}</span>
            <span className="h-3.5 w-12 animate-pulse rounded bg-card-sunken" />
          </div>
        ))}
      </div>
    );
  }

  const dailyAverage =
    stats.tracked_days > 0 ? stats.tracked_minutes / stats.tracked_days : 0;
  const total = Math.max(stats.tracked_minutes, 1);
  const ordered = inPaletteOrder(stats.per_category);

  return (
    <div className={STRIP_CLASS}>
      <Stat label="Tracked" value={formatDuration(stats.tracked_minutes)} accent />

      {!compact && (
        <>
          <Divider />
          <Stat label="Activities" value={String(stats.activity_count)} />
          <Divider />
          <Stat label="Days" value={String(stats.tracked_days)} />
        </>
      )}

      <Divider />
      <Stat label="Avg / day" value={formatDuration(dailyAverage)} />

      {ordered.length > 0 && (
        <>
          <Divider />

          {/* 2px surface gaps between fills, and the data-end corners rounded. */}
          <div
            className="flex h-2.5 w-28 shrink-0 gap-0.5 sm:w-36"
            role="img"
            aria-label={`Split by category: ${ordered
              .map(
                (entry) =>
                  `${entry.category_name} ${formatDuration(entry.tracked_minutes)}`
              )
              .join(", ")}`}
          >
            {ordered.map((entry) => (
              <span
                key={entry.category_id ?? "none"}
                className="rounded-[2px] transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                style={{
                  backgroundColor: resolveCategoryColor(entry.color, isDark),
                  width: `${(entry.tracked_minutes / total) * 100}%`,
                }}
                title={`${entry.category_name}: ${formatDuration(entry.tracked_minutes)}`}
              />
            ))}
          </div>

          {/* Always present: colour must never be the only carrier of identity. */}
          <ul className="flex shrink-0 items-center gap-2.5">
            {ordered.map((entry) => (
              <li
                key={`${entry.category_id ?? "none"}-legend`}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-ink-secondary"
                title={`${entry.category_name}: ${formatDuration(entry.tracked_minutes)}`}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: resolveCategoryColor(entry.color, isDark),
                  }}
                  aria-hidden="true"
                />
                {entry.category_name}
                <span className="text-ink-muted">
                  {formatDuration(entry.tracked_minutes)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
