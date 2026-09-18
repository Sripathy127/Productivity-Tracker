/**
 * The productivity timeline page: month selection, the Gantt grid, and all
 * activity / sub-activity mutations.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { AccountMenu } from "@/components/auth/account-menu";
import {
  ActivityFormDialog,
  type ActivityFormSeed,
  type SubActivityDraft,
} from "@/components/activity/activity-form-dialog";
import {
  DeleteConfirmDialog,
  type DeleteTarget,
} from "@/components/activity/delete-confirm-dialog";
import { MobileDayView } from "@/components/timeline/mobile-day-view";
import { MonthSummary } from "@/components/timeline/month-summary";
import type { DayRowHandlers } from "@/components/timeline/day-row";
import { MonthTimeline } from "@/components/timeline/month-timeline";
import { TimelineToolbar } from "@/components/timeline/timeline-toolbar";
import { Button } from "@/components/ui/button";
import { ErrorDisplay } from "@/components/ui/error-display";
import { Spinner } from "@/components/ui/spinner";
import {
  useActivities,
  useCreateActivity,
  useCreateSubActivity,
  useDeleteActivity,
  useDeleteSubActivity,
  useMonthStats,
  useUpdateActivity,
  useUpdateSubActivity,
} from "@/hooks/use-activities";
import { useCategories } from "@/hooks/use-categories";
import { useIsMobile } from "@/hooks/use-media-query";
import { useNow } from "@/hooks/use-now";
import {
  addMonths,
  eachDayOfMonth,
  formatMonthKey,
  minuteOfDay,
} from "@/lib/date-utils";
import {
  DAY_PANEL_WIDTH,
  DEFAULT_ZOOM,
  geometryForZoom,
  minutesToPx,
  type ZoomId,
} from "@/lib/timeline-geometry";
import { buildMonthLayout } from "@/lib/timeline-layout";
import type {
  Activity,
  ActivityCreateInput,
  ActivityUpdateInput,
  SubActivity,
  SubActivityInput,
} from "@/types/api";

/** Keep the "now" marker a little inside the viewport, not flush to the edge. */
const NOW_SCROLL_MARGIN = 120;

export function TimelinePage() {
  const now = useNow();
  const [month, setMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const [zoom, setZoom] = useState<ZoomId>(DEFAULT_ZOOM);
  const [use24Hour, setUse24Hour] = useState(true);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<number>>(
    () => new Set<number>()
  );
  const [formSeed, setFormSeed] = useState<ActivityFormSeed | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  // Which day the mobile pager is showing. Zero-based index into `layouts`.
  const [mobileDayIndex, setMobileDayIndex] = useState(() => now.getDate() - 1);

  const isMobile = useIsMobile();

  const scrollRef = useRef<HTMLDivElement>(null);
  const monthKey = formatMonthKey(month);
  const geometry = useMemo(() => geometryForZoom(zoom), [zoom]);

  const activitiesQuery = useActivities(monthKey);
  const statsQuery = useMonthStats(monthKey);
  const categoriesQuery = useCategories();

  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const removeActivity = useDeleteActivity();
  const createSubActivity = useCreateSubActivity();
  const updateSubActivity = useUpdateSubActivity();
  const removeSubActivity = useDeleteSubActivity();

  const days = useMemo(() => eachDayOfMonth(month), [month]);

  useEffect(() => {
    // A shorter month must not leave the pager pointing past its last day.
    setMobileDayIndex((current) => Math.min(current, days.length - 1));
  }, [days.length]);
  const layouts = useMemo(
    () =>
      buildMonthLayout({
        days,
        activities: activitiesQuery.data ?? [],
        expandedIds,
      }),
    [days, activitiesQuery.data, expandedIds]
  );

  const scrollToNow = useCallback(() => {
    const container = scrollRef.current;
    if (container === null) return;
    const target =
      DAY_PANEL_WIDTH + minutesToPx(minuteOfDay(now), geometry) - NOW_SCROLL_MARGIN;
    container.scrollTo({ left: Math.max(target, 0), behavior: "smooth" });
  }, [geometry, now]);

  const toggleExpand = useCallback((activityId: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  }, []);

  const handleCreate = async (input: ActivityCreateInput): Promise<void> => {
    const created = await createActivity.mutateAsync(input);
    // Expand straight away so the sub-bars just entered are visible.
    if (created.sub_activities.length > 0) {
      setExpandedIds((current) => new Set(current).add(created.id));
    }
  };

  /**
   * Applies the parent edit first, then reconciles children.
   *
   * Order matters: growing the parent must land before a child is moved into
   * the new window, and a child is deleted before the parent shrinks past it.
   */
  const handleUpdate = async (
    id: number,
    input: ActivityUpdateInput,
    children: {
      existing: SubActivityDraft[];
      created: SubActivityInput[];
      deletedIds: number[];
    }
  ): Promise<void> => {
    for (const deletedId of children.deletedIds) {
      await removeSubActivity.mutateAsync(deletedId);
    }

    await updateActivity.mutateAsync({ id, input });

    for (const child of children.existing) {
      if (child.id === null) continue;
      await updateSubActivity.mutateAsync({
        id: child.id,
        input: {
          title: child.title.trim(),
          notes: child.notes.trim() === "" ? null : child.notes.trim(),
          start_at: `${child.startDate}T${child.startTime}:00`,
          end_at: `${child.endDate}T${child.endTime}:00`,
        },
      });
    }

    for (const child of children.created) {
      await createSubActivity.mutateAsync({ activityId: id, input: child });
    }
  };

  const handleConfirmDelete = async (target: DeleteTarget): Promise<void> => {
    if (target.kind === "activity") {
      await removeActivity.mutateAsync(target.id);
      setExpandedIds((current) => {
        const next = new Set(current);
        next.delete(target.id);
        return next;
      });
    } else {
      await removeSubActivity.mutateAsync(target.id);
    }
  };

  const openEditSubActivity = (subActivity: SubActivity, parent: Activity) => {
    // Sub-activities are edited in their parent's form, which is where the
    // containment rule is visible and enforceable.
    setFormSeed({ activity: parent });
    setExpandedIds((current) => new Set(current).add(parent.id));
    void subActivity;
  };

  /** One definition, shared by the month grid and the mobile day view. */
  const handlers: DayRowHandlers = {
    onCreateAt: (day, startMinute) => {
      const suggested = new Date(day);
      suggested.setHours(Math.floor(startMinute / 60), startMinute % 60, 0, 0);
      setFormSeed({ activity: null, suggestedStart: suggested });
    },
    onEditActivity: (activity) => setFormSeed({ activity }),
    onDeleteActivity: (activity) =>
      setDeleteTarget({
        kind: "activity",
        id: activity.id,
        title: activity.title,
        childCount: activity.sub_activities.length,
      }),
    onEditSubActivity: openEditSubActivity,
    onDeleteSubActivity: (subActivity) =>
      setDeleteTarget({
        kind: "sub-activity",
        id: subActivity.id,
        title: subActivity.title,
        childCount: 0,
      }),
    onToggleExpand: toggleExpand,
  };

  const isSaving =
    createActivity.isPending ||
    updateActivity.isPending ||
    createSubActivity.isPending ||
    updateSubActivity.isPending ||
    removeSubActivity.isPending;

  if (activitiesQuery.isError) {
    return (
      <main className="flex h-full items-center justify-center bg-sand p-8">
        <ErrorDisplay
          error={activitiesQuery.error}
          title="Could not load the timeline"
          onRetry={() => void activitiesQuery.refetch()}
        />
      </main>
    );
  }

  return (
    <main className="flex h-full flex-col bg-sand">
      {/* The chrome stays in a measured column; the timeline below goes
          full-bleed. Width is a tool here, not a constant. */}
      {/* Chrome is kept deliberately shallow so the timeline gets the height.
          One flex row with ordered wrapping: below `lg` the toolbar drops to
          its own line beneath the brand and account menu; from `lg` up all
          three sit on a single line. Ordering rather than duplicated markup,
          so there is only ever one AccountMenu mounted. */}
      <header className="shrink-0 px-3 pt-2.5 sm:px-5 sm:pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link
            to="/"
            className="display order-1 shrink-0 rounded-lg text-base text-ink outline-none transition-colors hover:text-clay focus-visible:ring-2 focus-visible:ring-clay"
          >
            Productivity&nbsp;Tracker
          </Link>

          <div className="order-3 min-w-0 basis-full lg:order-2 lg:basis-auto lg:flex-1">
            <TimelineToolbar
              month={month}
              zoom={zoom}
              use24Hour={use24Hour}
              isMobile={isMobile}
              onMonthChange={setMonth}
              onStepMonth={(delta) => setMonth((current) => addMonths(current, delta))}
              onZoomChange={setZoom}
              onToggleClockFormat={() => setUse24Hour((current) => !current)}
              onScrollToNow={scrollToNow}
              onAddActivity={() => setFormSeed({ activity: null, suggestedStart: now })}
            />
          </div>

          <div className="order-2 ml-auto flex shrink-0 items-center gap-2 lg:order-3 lg:ml-0 lg:gap-3">
            {activitiesQuery.isFetching && (
              <span className="hidden items-center gap-1.5 text-xs text-ink-muted sm:flex">
                <Spinner />
                Syncing
              </span>
            )}
            <AccountMenu />
          </div>
        </div>

        {/* On a phone the day view already shows a per-day total, so the strip
            drops to the two figures that still say something about the month. */}
        <div className="mt-2.5">
          <MonthSummary stats={statsQuery.data} compact={isMobile} />
        </div>
      </header>

      {categoriesQuery.isError && (
        <p className="mx-3 mt-3 shrink-0 rounded-2xl bg-clay-wash px-4 py-2.5 text-sm text-ink-secondary sm:mx-5">
          Categories could not be loaded, so bars are shown uncategorised.
        </p>
      )}

      <div className="relative min-h-0 flex-1 p-3 pt-2.5 sm:p-5 sm:pt-3">
        {activitiesQuery.isLoading ? (
          <div className="flex h-full items-center justify-center gap-2.5 rounded-2xl border border-rule bg-card text-sm text-ink-muted">
            <Spinner />
            <span className="readout">Loading {monthKey}</span>
          </div>
        ) : isMobile ? (
          <MobileDayView
            layouts={layouts}
            activeIndex={mobileDayIndex}
            onActiveIndexChange={setMobileDayIndex}
            expandedIds={expandedIds}
            use24Hour={use24Hour}
            now={now}
            handlers={handlers}
          />
        ) : (
          <MonthTimeline
            ref={scrollRef}
            month={month}
            layouts={layouts}
            geometry={geometry}
            expandedIds={expandedIds}
            use24Hour={use24Hour}
            now={now}
            handlers={handlers}
          />
        )}
      </div>

      {(activitiesQuery.data ?? []).length === 0 && !activitiesQuery.isLoading && (
        <footer className="hidden shrink-0 items-center justify-center gap-3 px-5 pb-4 text-sm text-ink-secondary sm:flex">
          <span>
            Nothing logged for <span className="readout">{monthKey}</span> yet — click
            any empty slot in the grid, or
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setFormSeed({ activity: null, suggestedStart: now })}
          >
            Log your first activity
          </Button>
        </footer>
      )}

      <ActivityFormDialog
        seed={formSeed}
        categories={categoriesQuery.data ?? []}
        isSaving={isSaving}
        onClose={() => setFormSeed(null)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />

      <DeleteConfirmDialog
        target={deleteTarget}
        isDeleting={removeActivity.isPending || removeSubActivity.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </main>
  );
}
