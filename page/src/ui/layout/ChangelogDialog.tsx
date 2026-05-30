import type React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CHANGELOG } from "@/lib/changelog";

interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Release notes, opened from the version badge in the {@link TopBar}.
 *
 * Reads {@link CHANGELOG} (newest-first) and renders each release as a
 * dated heading followed by grouped bullet sections.
 */
export const ChangelogDialog: React.FC<ChangelogDialogProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>What's new</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {CHANGELOG.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-baseline gap-2 mb-2">
                <h3 className="text-sm font-semibold tracking-tight">
                  v{entry.version}
                </h3>
                {entry.date && (
                  <span className="text-[10px] text-muted-foreground">
                    {entry.date}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {entry.sections.map((section) => (
                  <div key={section.title}>
                    <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      {section.title}
                    </h4>
                    <ul className="space-y-0.5">
                      {section.items.map((item) => (
                        <li
                          key={item}
                          className="text-xs text-foreground flex gap-1.5"
                        >
                          <span className="text-muted-foreground select-none">
                            ·
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
