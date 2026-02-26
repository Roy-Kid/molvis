import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  type DataSourceModifier as CoreDataSourceModifier,
  Frame,
  type FrameProvider,
  type Molvis,
  Trajectory,
  ZarrReader,
  readFrame,
} from "@molvis/core";
import { FileUp, FolderUp, Trash2 } from "lucide-react";
import type React from "react";

interface DataSourceModifierProps {
  modifier: CoreDataSourceModifier;
  app: Molvis | null;
  onUpdate: () => void;
}

// Add webkitdirectory to InputHTMLAttributes
declare module "react" {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string | boolean;
    directory?: string | boolean;
  }
}

export const DataSourceModifier: React.FC<DataSourceModifierProps> = ({
  modifier,
  app,
  onUpdate,
}) => {
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !app) return;

    try {
      const text = await file.text();
      const frame = readFrame(text, file.name);

      modifier.sourceType = "file";
      modifier.filename = file.name;
      modifier.setFrame(frame);

      app.loadFrame(frame, frame.simbox);
      app.setMode("view");
      await app.applyPipeline({ fullRebuild: true });
      onUpdate();
    } catch (err) {
      app.events.emit("status-message", {
        text: `Failed to load file: ${err instanceof Error ? err.message : String(err)}`,
        type: "error",
      });
    } finally {
      e.target.value = "";
    }
  };

  const handleZarrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !app) return;

    try {
      const fileMap = new Map<string, Uint8Array>();
      let rootName = "";

      await Promise.all(
        Array.from(files).map(async (file) => {
          const buffer = await file.arrayBuffer();
          const parts = file.webkitRelativePath.split("/");
          if (parts.length > 1) {
            if (!rootName) rootName = parts[0];
            const relPath = parts.slice(1).join("/");
            fileMap.set(relPath, new Uint8Array(buffer));
          } else {
            fileMap.set(file.name, new Uint8Array(buffer));
          }
        }),
      );

      const reader = new ZarrReader(fileMap);
      const frameCount = reader.len();
      if (frameCount <= 0) {
        throw new Error("Zarr archive has no frames");
      }

      const frameCache = new Map<number, Frame>();
      const provider: FrameProvider = {
        length: frameCount,
        get(index: number): Frame {
          if (index < 0 || index >= frameCount) {
            throw new Error(
              `Zarr frame ${index} out of range [0, ${frameCount})`,
            );
          }
          const cached = frameCache.get(index);
          if (cached) {
            return cached;
          }
          const frame = reader.read(index);
          if (!frame) {
            throw new Error(`Failed to read Zarr frame ${index}`);
          }
          frameCache.set(index, frame);
          if (frameCache.size > 16) {
            const oldestKey = frameCache.keys().next().value as
              | number
              | undefined;
            if (oldestKey !== undefined && oldestKey !== index) {
              frameCache.delete(oldestKey);
            }
          }
          return frame;
        },
      };

      // Validate first frame early so users get immediate errors for malformed archives.
      provider.get(0);

      modifier.sourceType = "zarr";
      modifier.filename = rootName || "trajectory.zarr";
      // Trajectory frames come from provider; keep DataSourceModifier pass-through.
      modifier.setFrame(null);
      app.setMode("view");
      app.setTrajectory(Trajectory.fromProvider(provider));
      app.events.emit("status-message", {
        text: `Loaded trajectory: ${modifier.filename} (${frameCount} frames)`,
        type: "info",
      });
      onUpdate();
    } catch (err) {
      app.events.emit("status-message", {
        text: `Failed to load Zarr: ${err instanceof Error ? err.message : String(err)}`,
        type: "error",
      });
    } finally {
      e.target.value = "";
    }
  };

  const filename = modifier.filename === "" ? "-" : modifier.filename;
  const frame = app?.system.frame;
  const atomCount = frame?.getBlock("atoms")?.nrows() ?? 0;
  const bondCount = frame?.getBlock("bonds")?.nrows() ?? 0;
  const hasBox = frame?.simbox !== undefined;

  const handleToggle = (
    prop: "showAtoms" | "showBonds" | "showBox",
    checked: boolean,
  ) => {
    modifier[prop] = checked;
    onUpdate();
    app?.applyPipeline({ fullRebuild: true });
  };

  const handleClear = () => {
    if (!app) return;
    modifier.setFrame(null);
    modifier.filename = "";
    app.loadFrame(new Frame());
    onUpdate();
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
            title="Load single file"
          />
          <Button variant="outline" size="sm" className="w-full gap-2">
            <FileUp className="h-4 w-4" /> Load File
          </Button>
        </div>

        <div className="relative flex-1">
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleZarrUpload}
            webkitdirectory=""
            directory=""
            multiple
            title="Load Zarr directory"
          />
          <Button variant="outline" size="sm" className="w-full gap-2">
            <FolderUp className="h-4 w-4" /> Load Zarr
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
                  checked={modifier.showAtoms}
                  onCheckedChange={(checked) =>
                    handleToggle("showAtoms", checked === true)
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
                  checked={modifier.showBonds}
                  onCheckedChange={(checked) =>
                    handleToggle("showBonds", checked === true)
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
                  checked={modifier.showBox}
                  onCheckedChange={(checked) =>
                    handleToggle("showBox", checked === true)
                  }
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
