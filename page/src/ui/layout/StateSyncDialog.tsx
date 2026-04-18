import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type React from "react";

export interface StateSyncDialogProps {
  open: boolean;
  summary: { nModifiers: number; nFrames: number } | null;
  onKeepLocal(): void;
  onApplyBackend(): void;
}

/**
 * Prompt the user when the backend hands over a non-empty state but
 * the local pipeline is also non-empty. Two choices — no merge: either
 * keep what's currently on the canvas, or drop it and apply the
 * backend's snapshot.
 */
export const StateSyncDialog: React.FC<StateSyncDialogProps> = ({
  open,
  summary,
  onKeepLocal,
  onApplyBackend,
}) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onKeepLocal();
      }}
    >
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Backend has pending state</DialogTitle>
          <DialogDescription>
            The Python controller sent a scene snapshot that differs from what's
            currently on the canvas. Pick one — there is no merge.
          </DialogDescription>
        </DialogHeader>

        {summary && (
          <div className="rounded border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            backend snapshot · {summary.nModifiers} modifier
            {summary.nModifiers === 1 ? "" : "s"} · {summary.nFrames} frame
            {summary.nFrames === 1 ? "" : "s"}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onKeepLocal}>
            Keep local
          </Button>
          <Button onClick={onApplyBackend}>Apply backend</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
