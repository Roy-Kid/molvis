import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Modifier, Molvis } from "@molvis/core";
import { ArrayFrameSource, Frame, readFrame } from "@molvis/core";
import { FileUp, Trash2 } from "lucide-react";
import type React from "react";

interface DataSourceModifierProps {
  modifier: Modifier;
  app: Molvis | null;
  onUpdate: () => void;
}

export const DataSourceModifier: React.FC<DataSourceModifierProps> = ({
  modifier,
  app,
  onUpdate,
}) => {
  const handleChange = (key: string, value: any) => {
    (modifier as any)[key] = value;
    onUpdate();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !app) return;

    try {
      const text = await file.text();
      const ext = (file.name.split(".").pop() || "pdb").toLowerCase();

      console.log(`Reading file ${file.name} as ${ext}`);

      // Clear existing scene and history
      if (app && (app as any).artist) {
        (app as any).artist.clear();
      }
      if (app && (app as any).commandManager) {
        (app as any).commandManager.clearHistory();
      }

      let frame;
      try {
        frame = readFrame(text, file.name);
        console.log("[DataSourceModifier] read returned:", frame);
      } catch (err) {
        console.error("Parse error", err);
        if (app?.events) {
          app.events.emit("status-message", {
            text: `Failed to parse file: ${(err as Error).message}`,
            type: "error",
          });
        }
        return;
      }

      if (frame) {
        // Update Modifier State
        (modifier as any).sourceType = "file";
        (modifier as any).filename = file.name;

        if (
          "setFrame" in modifier &&
          typeof (modifier as any).setFrame === "function"
        ) {
          (modifier as any).setFrame(frame);
        }

        onUpdate();

        // Trigger pipeline update
        app.setMode("view");

        // Force re-compute
        const pipeline = (app as any).modifierPipeline;
        if (pipeline) {
          const dummySource = new ArrayFrameSource([new Frame()]);
          const computed = await (app as any).computeFrame(0, dummySource);
          (app as any).renderFrame(computed);
          onUpdate();
        }

        (app as any).frameCount = 1;
      }
    } catch (e) {
      console.error("Upload failed", e);
      if (app?.events) {
        app.events.emit("status-message", {
          text: `Error: ${(e as Error).message}`,
          type: "error",
        });
      }
    } finally {
      // Reset value to allow re-selection of same file
      e.target.value = "";
    }
  };

  const filename = (modifier as any).filename || "-";
  // Get counts from the modifiers frame if possible, or system frame
  const frame = app?.system?.frame;
  const atomCount = frame?.getBlock("atoms")?.nrows() ?? 0;
  const bondCount = frame?.getBlock("bonds")?.nrows() ?? 0;
  const hasBox = !!frame?.box;

  const showAtoms = (modifier as any).showAtoms ?? true;
  const showBonds = (modifier as any).showBonds ?? true;
  const showBox = (modifier as any).showBox ?? true;

  const triggerUpdate = async () => {
    if (!app) return;
    const dummySource = new ArrayFrameSource([new Frame()]);
    const computed = await (app as any).computeFrame(0, dummySource);
    (app as any).renderFrame(computed);
    onUpdate();
  };

  const handleToggle = (prop: string, checked: boolean) => {
    handleChange(prop, checked);
    triggerUpdate();
  };

  const handleClear = () => {
    if (app && (app as any).artist) (app as any).artist.clear();
    if (app && (app as any).commandManager)
      (app as any).commandManager.clearHistory();

    if ("setFrame" in modifier) (modifier as any).setFrame(null);
    (modifier as any).filename = "";
    onUpdate();
    triggerUpdate();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleFileUpload}
            accept=".pdb,.xyz,.lmp,.lammps"
          />
          <Button variant="outline" size="sm" className="w-full gap-2">
            <FileUp className="h-4 w-4" /> Load File
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          title="Clear Scene"
          className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-[10px] text-muted-foreground truncate px-1">
        Src: <span className="font-mono text-foreground">{filename}</span>
      </div>

      {/* Visibility Table */}
      <div className="border rounded-md overflow-hidden bg-background">
        <table className="w-full text-xs">
          <thead className="bg-muted text-muted-foreground font-medium">
            <tr>
              <th className="px-3 py-2 text-left w-8">Vis</th>
              <th className="px-2 py-2 text-left">Element</th>
              <th className="px-3 py-2 text-right">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr className="hover:bg-muted/50 transition-colors">
              <td className="px-3 py-2">
                <Checkbox
                  checked={showAtoms}
                  onCheckedChange={(c) =>
                    handleToggle("showAtoms", c as boolean)
                  }
                  className="h-3.5 w-3.5"
                />
              </td>
              <td className="px-2 py-2 font-medium">Atoms</td>
              <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                {atomCount}
              </td>
            </tr>
            <tr className="hover:bg-muted/50 transition-colors">
              <td className="px-3 py-2">
                <Checkbox
                  checked={showBonds}
                  onCheckedChange={(c) =>
                    handleToggle("showBonds", c as boolean)
                  }
                  className="h-3.5 w-3.5"
                />
              </td>
              <td className="px-2 py-2 font-medium">Bonds</td>
              <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                {bondCount}
              </td>
            </tr>
            <tr className="hover:bg-muted/50 transition-colors">
              <td className="px-3 py-2">
                <Checkbox
                  checked={showBox}
                  onCheckedChange={(c) => handleToggle("showBox", c as boolean)}
                  className="h-3.5 w-3.5"
                />
              </td>
              <td className="px-2 py-2 font-medium">Box</td>
              <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                {hasBox ? 1 : 0}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
