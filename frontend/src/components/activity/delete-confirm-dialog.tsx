import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { describeError } from "@/components/ui/error-display";
import { Spinner } from "@/components/ui/spinner";

export interface DeleteTarget {
  kind: "activity" | "sub-activity";
  id: number;
  title: string;
  /** Number of sub-activities that will be removed along with an activity. */
  childCount: number;
}

export function DeleteConfirmDialog({
  target,
  isDeleting,
  onClose,
  onConfirm,
}: {
  target: DeleteTarget | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: (target: DeleteTarget) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  if (target === null) return null;

  const handleConfirm = async () => {
    setError(null);
    try {
      await onConfirm(target);
      onClose();
    } catch (caught) {
      setError(describeError(caught));
    }
  };

  const noun = target.kind === "activity" ? "activity" : "sub-activity";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="w-[min(28rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-4 w-1.5 shrink-0 bg-danger" aria-hidden="true" />
            Delete {noun}?
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-ink">{target.title}</span> will be removed
            permanently.
            {target.kind === "activity" && target.childCount > 0 && (
              <>
                {" "}
                Its {target.childCount}{" "}
                {target.childCount === 1 ? "sub-activity" : "sub-activities"} will be
                deleted too.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {error !== null && (
          <p
            role="alert"
            className="border-l-2 border-danger bg-danger-wash px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => void handleConfirm()}
            disabled={isDeleting}
          >
            {isDeleting && <Spinner />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
