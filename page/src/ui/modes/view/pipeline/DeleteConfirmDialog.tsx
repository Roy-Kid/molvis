import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Modifier } from "@molvis/core";
import type React from "react";

interface DeleteConfirmDialogProps {
  open: boolean;
  modifier: Modifier;
  descendants: Modifier[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  modifier,
  descendants,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {modifier.name}?</DialogTitle>
          <DialogDescription>
            This will also delete the following dependent modifiers:
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc pl-5 text-sm space-y-1">
          {descendants.map((desc) => (
            <li key={desc.id} className="text-muted-foreground">
              {desc.name}
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            Delete All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
