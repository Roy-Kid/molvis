import React, { useState } from 'react';
import { Molvis, writeFrame, inferFormatFromFilename } from '@molvis/core';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2 } from 'lucide-react';

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
      // 1. Get Frame from Scene (snapshot)
      const frame = app.world.sceneIndex.dumpFrame();

      // 2. Infer format
      const format = inferFormatFromFilename(filename, "pdb");

      // 3. Write Frame (WASM)
      // Dynamic import if needed, but we imported from @molvis/core which should handle it if loaded.
      // TopBar used dynamic import, maybe to ensure WASM presence. 
      // Since we are in UI, core should be loaded.
      const payload = writeFrame(frame, { format, filename });

      if (payload && payload.content) {
          const blob = new Blob([payload.content], { type: payload.mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = payload.suggestedName || filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setOpen(false);
      }
    } catch (e) {
      console.error("Export failed:", e);
      // Ideally show toast error
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
