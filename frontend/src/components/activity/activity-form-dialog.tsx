/**
 * Create / edit an activity, including its sub-activities.
 *
 * Times are entered as a date plus a native `time` input stepped to 60s, so any
 * minute is reachable (03:53 included). Client-side checks mirror the backend
 * rules to give instant feedback, but the backend remains the authority and its
 * field errors are surfaced against the matching input.
 */

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Textarea, inputClassName } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { describeError } from "@/components/ui/error-display";
import {
  formatDateKey,
  formatDuration,
  formatLocalDateTime,
  pad,
  parseLocalDateTime,
} from "@/lib/date-utils";
import { MINUTES_PER_DAY, SLOT_MINUTES } from "@/lib/timeline-geometry";
import { cn } from "@/lib/utils";
import type {
  Activity,
  ActivityCreateInput,
  ActivityUpdateInput,
  Category,
  SubActivityInput,
} from "@/types/api";

const UNCATEGORISED_VALUE = "none";

interface SubActivityDraft {
  /** Stable key for React; the server id when editing an existing child. */
  key: string;
  id: number | null;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  notes: string;
}

interface ActivityDraft {
  title: string;
  notes: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  categoryId: string;
  subActivities: SubActivityDraft[];
}

export interface ActivityFormSeed {
  /** Existing activity when editing; `null` when creating. */
  activity: Activity | null;
  /** Pre-filled start for a create, derived from the clicked grid slot. */
  suggestedStart?: Date;
}

function toTimeValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function draftFromSeed(seed: ActivityFormSeed): ActivityDraft {
  if (seed.activity !== null) {
    const start = parseLocalDateTime(seed.activity.start_at);
    const end = parseLocalDateTime(seed.activity.end_at);
    return {
      title: seed.activity.title,
      notes: seed.activity.notes ?? "",
      startDate: formatDateKey(start),
      startTime: toTimeValue(start),
      endDate: formatDateKey(end),
      endTime: toTimeValue(end),
      categoryId:
        seed.activity.category_id === null
          ? UNCATEGORISED_VALUE
          : String(seed.activity.category_id),
      subActivities: seed.activity.sub_activities.map((child) => {
        const childStart = parseLocalDateTime(child.start_at);
        const childEnd = parseLocalDateTime(child.end_at);
        return {
          key: `existing-${child.id}`,
          id: child.id,
          title: child.title,
          startDate: formatDateKey(childStart),
          startTime: toTimeValue(childStart),
          endDate: formatDateKey(childEnd),
          endTime: toTimeValue(childEnd),
          notes: child.notes ?? "",
        };
      }),
    };
  }

  const start = seed.suggestedStart ?? new Date();
  const end = new Date(start.getTime() + 30 * 60_000);
  return {
    title: "",
    notes: "",
    startDate: formatDateKey(start),
    startTime: toTimeValue(start),
    endDate: formatDateKey(end),
    endTime: toTimeValue(end),
    categoryId: UNCATEGORISED_VALUE,
    subActivities: [],
  };
}

function combine(dateValue: string, timeValue: string): Date | null {
  if (dateValue === "" || timeValue === "") return null;
  const parsed = parseLocalDateTime(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type FormErrors = Record<string, string>;

function validate(draft: ActivityDraft): FormErrors {
  const errors: FormErrors = {};

  if (draft.title.trim() === "") errors["title"] = "Give the activity a title.";
  if (draft.title.length > 200)
    errors["title"] = "Keep the title under 200 characters.";
  if (draft.notes.length > 2000)
    errors["notes"] = "Notes are limited to 2000 characters.";

  const start = combine(draft.startDate, draft.startTime);
  const end = combine(draft.endDate, draft.endTime);

  if (start === null) errors["start_at"] = "Pick a start date and time.";
  if (end === null) errors["end_at"] = "Pick an end date and time.";

  if (start !== null && end !== null) {
    if (end <= start) {
      errors["end_at"] = "The end must be after the start.";
    } else if ((end.getTime() - start.getTime()) / 60_000 > MINUTES_PER_DAY) {
      errors["end_at"] = "An activity cannot be longer than 24 hours.";
    }

    draft.subActivities.forEach((child, index) => {
      const prefix = `sub.${index}`;
      if (child.title.trim() === "") {
        errors[`${prefix}.title`] = "Title required.";
      }
      const childStart = combine(child.startDate, child.startTime);
      const childEnd = combine(child.endDate, child.endTime);
      if (childStart === null || childEnd === null) {
        errors[`${prefix}.time`] = "Pick both times.";
        return;
      }
      if (childEnd <= childStart) {
        errors[`${prefix}.time`] = "End must be after start.";
        return;
      }
      if (childStart < start || childEnd > end) {
        errors[`${prefix}.time`] = "Must stay inside the activity's own start and end.";
      }
    });
  }

  return errors;
}

export function ActivityFormDialog({
  seed,
  categories,
  isSaving,
  onClose,
  onCreate,
  onUpdate,
}: {
  seed: ActivityFormSeed | null;
  categories: Category[];
  isSaving: boolean;
  onClose: () => void;
  onCreate: (input: ActivityCreateInput) => Promise<void>;
  onUpdate: (
    id: number,
    input: ActivityUpdateInput,
    subActivities: {
      existing: SubActivityDraft[];
      created: SubActivityInput[];
      deletedIds: number[];
    }
  ) => Promise<void>;
}) {
  const isOpen = seed !== null;
  const isEditing = seed?.activity != null;

  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<FormErrors>({});
  const [showErrors, setShowErrors] = useState(false);

  // Reset the form whenever a different activity (or a new create) is opened.
  useEffect(() => {
    if (seed === null) {
      setDraft(null);
      return;
    }
    setDraft(draftFromSeed(seed));
    setRemovedIds([]);
    setSubmitError(null);
    setServerErrors({});
    setShowErrors(false);
  }, [seed]);

  const clientErrors = useMemo(() => (draft === null ? {} : validate(draft)), [draft]);
  const errors: FormErrors = { ...clientErrors, ...serverErrors };
  const visibleError = (key: string): string | undefined =>
    showErrors ? errors[key] : serverErrors[key];

  const duration = useMemo(() => {
    if (draft === null) return null;
    const start = combine(draft.startDate, draft.startTime);
    const end = combine(draft.endDate, draft.endTime);
    if (start === null || end === null || end <= start) return null;
    return (end.getTime() - start.getTime()) / 60_000;
  }, [draft]);

  const update = (patch: Partial<ActivityDraft>) => {
    setDraft((current) => (current === null ? current : { ...current, ...patch }));
    setServerErrors({});
  };

  const updateChild = (index: number, patch: Partial<SubActivityDraft>) => {
    setDraft((current) => {
      if (current === null) return current;
      const next = [...current.subActivities];
      next[index] = { ...next[index], ...patch };
      return { ...current, subActivities: next };
    });
    setServerErrors({});
  };

  const addChild = () => {
    setDraft((current) => {
      if (current === null) return current;
      // A new child defaults to the parent's own window, which is always valid.
      return {
        ...current,
        subActivities: [
          ...current.subActivities,
          {
            key: `new-${Date.now()}-${current.subActivities.length}`,
            id: null,
            title: "",
            startDate: current.startDate,
            startTime: current.startTime,
            endDate: current.endDate,
            endTime: current.endTime,
            notes: "",
          },
        ],
      };
    });
  };

  const removeChild = (index: number) => {
    setDraft((current) => {
      if (current === null) return current;
      const target = current.subActivities[index];
      if (target.id !== null) {
        setRemovedIds((ids) => [...ids, target.id as number]);
      }
      return {
        ...current,
        subActivities: current.subActivities.filter((_, i) => i !== index),
      };
    });
  };

  const handleSubmit = async () => {
    if (draft === null) return;

    setShowErrors(true);
    if (Object.keys(clientErrors).length > 0) return;

    const start = combine(draft.startDate, draft.startTime);
    const end = combine(draft.endDate, draft.endTime);
    if (start === null || end === null) return;

    const categoryId =
      draft.categoryId === UNCATEGORISED_VALUE ? null : Number(draft.categoryId);
    const notes = draft.notes.trim() === "" ? null : draft.notes.trim();

    setSubmitError(null);
    setServerErrors({});

    try {
      if (seed?.activity != null) {
        const created: SubActivityInput[] = [];
        const existing: SubActivityDraft[] = [];
        for (const child of draft.subActivities) {
          if (child.id === null) {
            created.push(toSubActivityInput(child));
          } else {
            existing.push(child);
          }
        }
        await onUpdate(
          seed.activity.id,
          {
            title: draft.title.trim(),
            notes,
            start_at: formatLocalDateTime(start),
            end_at: formatLocalDateTime(end),
            category_id: categoryId,
          },
          { existing, created, deletedIds: removedIds }
        );
      } else {
        await onCreate({
          title: draft.title.trim(),
          notes,
          start_at: formatLocalDateTime(start),
          end_at: formatLocalDateTime(end),
          category_id: categoryId,
          sub_activities: draft.subActivities.map(toSubActivityInput),
        });
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors.length > 0) {
        setServerErrors(
          Object.fromEntries(
            error.fieldErrors.map((item) => [item.field, item.message])
          )
        );
      }
      setSubmitError(describeError(error));
    }
  };

  if (draft === null) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit activity" : "Add activity"}</DialogTitle>
          <DialogDescription>
            Times are exact to the minute — the {SLOT_MINUTES}-minute grid is only a
            visual guide.
            {duration !== null && ` This block is ${formatDuration(duration)}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Title" htmlFor="activity-title" error={visibleError("title")}>
            <Input
              id="activity-title"
              value={draft.title}
              maxLength={220}
              placeholder="What did you work on?"
              aria-invalid={visibleError("title") !== undefined}
              onChange={(event) => update({ title: event.target.value })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Starts"
              htmlFor="activity-start-date"
              error={visibleError("start_at")}
            >
              <div className="flex gap-2">
                <Input
                  id="activity-start-date"
                  type="date"
                  value={draft.startDate}
                  aria-label="Start date"
                  onChange={(event) => update({ startDate: event.target.value })}
                />
                <Input
                  type="time"
                  step={60}
                  value={draft.startTime}
                  aria-label="Start time"
                  className="w-28"
                  onChange={(event) => update({ startTime: event.target.value })}
                />
              </div>
            </Field>

            <Field
              label="Ends"
              htmlFor="activity-end-date"
              error={visibleError("end_at")}
            >
              <div className="flex gap-2">
                <Input
                  id="activity-end-date"
                  type="date"
                  value={draft.endDate}
                  aria-label="End date"
                  onChange={(event) => update({ endDate: event.target.value })}
                />
                <Input
                  type="time"
                  step={60}
                  value={draft.endTime}
                  aria-label="End time"
                  className="w-28"
                  onChange={(event) => update({ endTime: event.target.value })}
                />
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="activity-category">
              <Select
                value={draft.categoryId}
                onValueChange={(value) => update({ categoryId: value })}
              >
                <SelectTrigger id="activity-category">
                  <SelectValue placeholder="Uncategorised" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNCATEGORISED_VALUE}>Uncategorised</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3 w-1.5 shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Notes" htmlFor="activity-notes" error={visibleError("notes")}>
            <Textarea
              id="activity-notes"
              value={draft.notes}
              maxLength={2100}
              placeholder="Optional detail"
              onChange={(event) => update({ notes: event.target.value })}
            />
          </Field>

          <section className="border border-rule bg-sand p-4">
            <header className="mb-2 flex items-center justify-between">
              <div>
                <h3 className="display text-base text-ink">Sub-activities</h3>
                <p className="mt-1 max-w-[52ch] text-xs text-ink-muted">
                  The detail shown when you expand this bar. Each one must stay inside
                  the activity's window.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={addChild}>
                <PlusIcon />
                Add
              </Button>
            </header>

            {draft.subActivities.length === 0 ? (
              <p className="py-2 text-xs text-ink-muted">
                None yet — add one to break this block down.
              </p>
            ) : (
              <ul className="space-y-2">
                {draft.subActivities.map((child, index) => {
                  const timeError = visibleError(`sub.${index}.time`);
                  const titleError = visibleError(`sub.${index}.title`);
                  return (
                    <li key={child.key} className="border border-rule bg-card p-2.5">
                      <div className="flex flex-wrap items-start gap-2">
                        <input
                          value={child.title}
                          placeholder="What exactly?"
                          aria-label={`Sub-activity ${index + 1} title`}
                          aria-invalid={titleError !== undefined}
                          maxLength={220}
                          className={cn(inputClassName, "h-8 min-w-40 flex-1")}
                          onChange={(event) =>
                            updateChild(index, { title: event.target.value })
                          }
                        />
                        <input
                          type="date"
                          value={child.startDate}
                          aria-label={`Sub-activity ${index + 1} start date`}
                          className={cn(inputClassName, "readout h-8 w-36")}
                          onChange={(event) =>
                            updateChild(index, { startDate: event.target.value })
                          }
                        />
                        <input
                          type="time"
                          step={60}
                          value={child.startTime}
                          aria-label={`Sub-activity ${index + 1} start time`}
                          className={cn(inputClassName, "readout h-8 w-24")}
                          onChange={(event) =>
                            updateChild(index, { startTime: event.target.value })
                          }
                        />
                        <span className="label-soft mb-0 self-center">to</span>
                        <input
                          type="date"
                          value={child.endDate}
                          aria-label={`Sub-activity ${index + 1} end date`}
                          className={cn(inputClassName, "readout h-8 w-36")}
                          onChange={(event) =>
                            updateChild(index, { endDate: event.target.value })
                          }
                        />
                        <input
                          type="time"
                          step={60}
                          value={child.endTime}
                          aria-label={`Sub-activity ${index + 1} end time`}
                          className={cn(inputClassName, "readout h-8 w-24")}
                          onChange={(event) =>
                            updateChild(index, { endTime: event.target.value })
                          }
                        />
                        <Button
                          variant="dangerGhost"
                          size="icon"
                          aria-label={`Remove sub-activity ${index + 1}`}
                          onClick={() => removeChild(index)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                      {(titleError ?? timeError) !== undefined && (
                        <p className="mt-1.5 text-xs text-danger">
                          {titleError ?? timeError}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {submitError !== null && (
            <p
              role="alert"
              className="border-l-2 border-danger bg-danger-wash px-3 py-2 text-sm text-danger"
            >
              {submitError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={isSaving}
          >
            {isSaving && <Spinner />}
            {isEditing ? "Save changes" : "Add activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toSubActivityInput(child: SubActivityDraft): SubActivityInput {
  return {
    title: child.title.trim(),
    notes: child.notes.trim() === "" ? null : child.notes.trim(),
    start_at: `${child.startDate}T${child.startTime}:00`,
    end_at: `${child.endDate}T${child.endTime}:00`,
  };
}

export type { SubActivityDraft };
