import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Molvis, exportFrame, inferFormatFromFilename } from "@molvis/core";
import { Download, Loader2 } from "lucide-react";
import type React from "react";
import { useState } from "react";

interface ExportDialogProps {
  app: Molvis | null;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ app }) => {
  const [open, setOpen] = useState(false);
  const [filename, setFilename] = useState("structure.pdb");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!app) return;
    setIsExporting(true);

    try {
      const format = inferFormatFromFilename(filename, "pdb");
      const payload = exportFrame(app.world.sceneIndex, { format, filename });

      if (!payload.content) {
        throw new Error("Export payload is empty");
      }

      const blob = new Blob([payload.content], { type: payload.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.suggestedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setOpen(false);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog modal={false} open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Export">
          <Download className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Export Scene</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="filename" className="text-right">
              File Name
            </Label>
            <Input
              id="filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
