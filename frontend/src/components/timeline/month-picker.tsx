/**
 * Month selector: a year pager plus a 4x3 grid of months, in a popover.
 *
 * The timeline is always month-scoped, so picking a month is the only calendar
 * interaction needed — a full day-grid calendar would imply day selection that
 * the view does not have.
 */

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MONTH_NAMES, formatMonthKey } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

const MONTH_ABBREVIATIONS = MONTH_NAMES.map((name) => name.slice(0, 3));

export function MonthPicker({
  month,
  onMonthChange,
}: {
  month: Date;
  onMonthChange: (next: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(month.getFullYear());

  // Re-centre the year pager whenever the selection changes from outside.
  useEffect(() => {
    setVisibleYear(month.getFullYear());
  }, [month]);

  const today = new Date();
  const selectedKey = formatMonthKey(month);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" className="min-w-52 justify-between">
          <span className="flex items-center gap-2">
            <CalendarIcon className="text-ink-muted" />
            <span className="display text-sm">
              {MONTH_NAMES[month.getMonth()]}{" "}
              <span className="readout font-normal">{month.getFullYear()}</span>
            </span>
          </span>
          <ChevronRightIcon
            className={cn("text-ink-muted transition-transform", open && "rotate-90")}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72">
        <div className="mb-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous year"
            onClick={() => setVisibleYear((year) => year - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="readout text-sm font-medium text-ink">{visibleYear}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next year"
            onClick={() => setVisibleYear((year) => year + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {MONTH_ABBREVIATIONS.map((abbreviation, index) => {
            const candidate = new Date(visibleYear, index, 1);
            const isSelected = formatMonthKey(candidate) === selectedKey;
            const isCurrent =
              index === today.getMonth() && visibleYear === today.getFullYear();

            return (
              <button
                key={abbreviation}
                type="button"
                aria-current={isSelected ? "true" : undefined}
                onClick={() => {
                  onMonthChange(candidate);
                  setOpen(false);
                }}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-clay",
                  isSelected
                    ? "border-transparent bg-clay text-white shadow-lift-1"
                    : "border-transparent text-ink-secondary hover:bg-card-sunken hover:text-ink",
                  !isSelected && isCurrent && "border-clay/50"
                )}
              >
                {abbreviation}
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full"
          onClick={() => {
            onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));
            setOpen(false);
          }}
        >
          Jump to this month
        </Button>
      </PopoverContent>
    </Popover>
  );
}
