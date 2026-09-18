import { ClockIcon, CrosshairIcon, PlusIcon } from "lucide-react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { MonthPicker } from "@/components/timeline/month-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ZOOM_LEVELS, type ZoomId } from "@/lib/timeline-geometry";

/**
 * Month navigation and view controls.
 *
 * On mobile the zoom control and the "now" jump are hidden: the day view has
 * one fixed scale and always opens at the current hour, so neither would do
 * anything. Controls that remain get 44px touch targets.
 */
export function TimelineToolbar({
  month,
  zoom,
  use24Hour,
  isMobile,
  onMonthChange,
  onStepMonth,
  onZoomChange,
  onToggleClockFormat,
  onScrollToNow,
  onAddActivity,
}: {
  month: Date;
  zoom: ZoomId;
  use24Hour: boolean;
  isMobile: boolean;
  onMonthChange: (next: Date) => void;
  onStepMonth: (delta: number) => void;
  onZoomChange: (next: ZoomId) => void;
  onToggleClockFormat: () => void;
  onScrollToNow: () => void;
  onAddActivity: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-initial">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Previous month"
          onClick={() => onStepMonth(-1)}
        >
          <ChevronLeftIcon />
        </Button>
        <MonthPicker month={month} onMonthChange={onMonthChange} />
        <Button
          variant="secondary"
          size="icon"
          aria-label="Next month"
          onClick={() => onStepMonth(1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="flex items-center gap-2 sm:ml-auto">
        {!isMobile && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onScrollToNow}
              title="Scroll the timeline to the current time"
            >
              <CrosshairIcon />
              Now
            </Button>

            <Select
              value={zoom}
              onValueChange={(value) => onZoomChange(value as ZoomId)}
            >
              <SelectTrigger aria-label="Timeline zoom" className="h-9 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZOOM_LEVELS.map((level) => (
                  <SelectItem key={level.id} value={level.id}>
                    {level.label} · {level.hourWidth}px/h
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleClockFormat}
          title="Switch between 24-hour and 12-hour labels"
          aria-label={`Switch to ${use24Hour ? "12" : "24"}-hour labels`}
        >
          <ClockIcon />
          {use24Hour ? "24h" : "12h"}
        </Button>

        {/* On mobile the day view carries its own floating add button. */}
        {!isMobile && (
          <Button variant="primary" size="md" onClick={onAddActivity}>
            <PlusIcon />
            Add activity
          </Button>
        )}
      </div>
    </div>
  );
}
