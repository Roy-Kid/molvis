import {
  type GeometryOptimizeMethod,
  type Molvis,
  runStructureOptimize,
  UnsavedSceneError,
} from "@molvis/stage";
import { FlaskConical } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { NumberField } from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  sceneHasUnsavedEdits,
  UnsavedSceneDialog,
} from "@/components/unsaved-scene-dialog";
import { ViewerAction } from "@/components/viewer/ViewerAction";
import { useSelectedAtoms } from "@/hooks/useSelectedAtoms";
import { reportStatus } from "@/lib/status-report";
import { AnalysisPanelShell } from "./analysis/AnalysisPanelShell";
import { AnalysisRunBar } from "./analysis/AnalysisRunBar";
import { ParamStack } from "./analysis/ParamStack";
import { ResultSection } from "./analysis/ResultSection";

interface StructureOptimizePanelProps {
  app: Molvis | null;
}

const METHODS: Array<{ id: GeometryOptimizeMethod; label: string }> = [
  { id: "uff", label: "UFF" },
  { id: "mmff94", label: "MMFF94" },
  { id: "mmff94s", label: "MMFF94s" },
  { id: "soft", label: "Soft" },
];

const MENU_TRIGGER =
  "w-full min-w-0 border-0 bg-transparent px-2 shadow-none hover:bg-interactive focus-visible:border-0 focus-visible:ring-0";

interface OptimizeResult {
  method: GeometryOptimizeMethod;
  steps: number;
  energy: number;
  maxForce: number;
  converged: boolean;
  fixedCount: number;
  atomCount: number;
}

export const StructureOptimizePanel: React.FC<StructureOptimizePanelProps> = ({
  app,
}) => {
  const selectedAtoms = useSelectedAtoms(app);
  const [method, setMethod] = useState<GeometryOptimizeMethod>("uff");
  const [fixedIndices, setFixedIndices] = useState<number[]>([]);
  const [maxSteps, setMaxSteps] = useState(200);
  const [forceTol, setForceTol] = useState(0.05);
  const [addHydrogens, setAddHydrogens] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [sceneDirty, setSceneDirty] = useState(() => sceneHasUnsavedEdits(app));
  const cancelRef = useRef(false);

  const hasApp = app !== null;
  const selectionCount = selectedAtoms.length;
  const fixedCount = fixedIndices.length;

  useEffect(() => {
    if (!app) {
      setSceneDirty(false);
      return;
    }
    setSceneDirty(app.world.sceneIndex.hasUnsavedChanges);
    return app.events.on("dirty-change", (isDirty) => {
      setSceneDirty(isDirty);
    });
  }, [app]);

  const emitStatus = useCallback(
    (text: string, type: "info" | "error" | "success" = "info") => {
      if (app?.events?.emit) {
        app.events.emit("status-message", { text, type });
      } else {
        reportStatus(text, type);
      }
    },
    [app],
  );

  const handleUseSelectionAsFixed = useCallback(() => {
    if (selectionCount === 0) return;
    setFixedIndices([...selectedAtoms]);
  }, [selectedAtoms, selectionCount]);

  const handleClearFixed = useCallback(() => {
    setFixedIndices([]);
  }, []);

  const runOptimize = useCallback(async () => {
    if (!app || running) return;
    cancelRef.current = false;
    setRunning(true);
    setResult(null);
    setProgress({ completed: 0, total: maxSteps });
    emitStatus("Optimizing structure…", "info");

    try {
      const outcome = await runStructureOptimize(app, {
        method,
        maxSteps,
        forceTol,
        fixedIndices,
        addHydrogens,
        shouldCancel: () => cancelRef.current,
        onProgress: ({ step, maxSteps: total }) => {
          setProgress({ completed: step, total });
        },
      });

      setResult({
        method: outcome.method,
        steps: outcome.steps,
        energy: outcome.energy,
        maxForce: outcome.maxForce,
        converged: outcome.converged,
        fixedCount: outcome.fixedCount,
        atomCount: outcome.atomCount,
      });

      const hNote =
        outcome.hydrogensAdded > 0 ? ` · +${outcome.hydrogensAdded} H` : "";
      if (outcome.cancelled) {
        emitStatus("Optimization cancelled", "info");
      } else if (outcome.converged) {
        emitStatus(
          `Optimized in ${outcome.steps} steps · max |F| ${outcome.maxForce.toFixed(3)}${hNote}`,
          "success",
        );
      } else {
        emitStatus(
          `Optimization stopped at max steps (${outcome.steps})${hNote}`,
          "info",
        );
      }
    } catch (err) {
      if (err instanceof UnsavedSceneError) {
        setSavePromptOpen(true);
        emitStatus("Save scene before optimizing", "info");
      } else {
        const message = err instanceof Error ? err.message : String(err);
        emitStatus(message, "error");
      }
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [
    addHydrogens,
    app,
    emitStatus,
    fixedIndices,
    forceTol,
    maxSteps,
    method,
    running,
  ]);

  /** Run click: never silent-commit — ask first when dirty. */
  const handleRun = useCallback(() => {
    if (!app || running) return;
    if (sceneHasUnsavedEdits(app)) {
      setSavePromptOpen(true);
      return;
    }
    void runOptimize();
  }, [app, runOptimize, running]);

  const handleSaveAndRun = useCallback(() => {
    if (!app) return;
    setSavePromptOpen(false);
    app.commitScene();
    emitStatus("Scene saved", "success");
    void runOptimize();
  }, [app, emitStatus, runOptimize]);

  const handlePromptCancel = useCallback(() => {
    setSavePromptOpen(false);
    emitStatus("Optimization cancelled", "info");
  }, [emitStatus]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  if (!hasApp) {
    return (
      <EmptyState
        density="compact"
        className="min-h-0 flex-1 justify-center"
        icon={<FlaskConical className="h-8 w-8" />}
        title="Viewer not ready"
        description="Wait for the canvas to initialize."
      />
    );
  }

  const methodLabel = METHODS.find((m) => m.id === method)?.label ?? method;
  const summary = running
    ? progress
      ? `Step ${progress.completed}/${progress.total}`
      : "Relaxing…"
    : sceneDirty
      ? "Unsaved scene *"
      : `${methodLabel}${fixedCount > 0 ? ` · ${fixedCount} fixed` : ""}`;

  return (
    <>
      <AnalysisPanelShell
        footer={
          <div className="space-y-1">
            {running && (
              <div className="px-2">
                <ViewerAction
                  purpose="dismiss"
                  className="w-full border-0"
                  onClick={handleCancel}
                >
                  Cancel
                </ViewerAction>
              </div>
            )}
            <AnalysisRunBar
              onRun={handleRun}
              running={running}
              progress={progress}
              label="Run optimization"
              summary={summary}
            />
          </div>
        }
      >
        <div className="space-y-3 p-2">
          {sceneDirty && (
            <p className="text-micro text-muted-foreground">
              Unsaved canvas edits (*). Optimization will ask to save before
              running.
            </p>
          )}

          <ParamStack label="Method">
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as GeometryOptimizeMethod)}
              disabled={running}
            >
              <SelectTrigger
                size="sm"
                className={MENU_TRIGGER}
                aria-label="Force field"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-0 shadow-overlay">
                {METHODS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ParamStack>

          <ParamStack label="Fixed">
            <div className="flex min-w-0 items-center gap-1">
              <span className="min-w-0 flex-1 truncate text-body-lg tabular-nums">
                {fixedCount === 0 ? "None" : `${fixedCount}`}
              </span>
              <ViewerAction
                purpose="dismiss"
                disabled={running || selectionCount === 0}
                onClick={handleUseSelectionAsFixed}
                className="border-0 bg-transparent shadow-none hover:bg-interactive"
                title={
                  selectionCount === 0
                    ? "Select atoms on the canvas first"
                    : `Fix ${selectionCount} selected atom${selectionCount === 1 ? "" : "s"}`
                }
              >
                Use selection
              </ViewerAction>
              {fixedCount > 0 && (
                <ViewerAction
                  purpose="dismiss"
                  disabled={running}
                  onClick={handleClearFixed}
                  className="border-0 bg-transparent shadow-none hover:bg-interactive"
                >
                  Clear
                </ViewerAction>
              )}
            </div>
          </ParamStack>

          <div className="grid grid-cols-2 gap-2">
            <ParamStack label="Max steps">
              <NumberField
                aria-label="Max steps"
                value={maxSteps}
                min={10}
                max={5000}
                step={10}
                onChange={setMaxSteps}
                disabled={running}
                className="w-full"
              />
            </ParamStack>
            <ParamStack label="Force tol">
              <NumberField
                aria-label="Force tolerance"
                value={forceTol}
                min={0.0001}
                max={1}
                step={0.001}
                onChange={setForceTol}
                disabled={running}
                className="w-full"
              />
            </ParamStack>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-micro text-muted-foreground">
              Add hydrogens
            </span>
            <Switch
              aria-label="Add hydrogens"
              checked={addHydrogens}
              onCheckedChange={setAddHydrogens}
              disabled={running}
            />
          </div>

          {result && (
            <ResultSection defaultOpen>
              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-micro tabular-nums">
                <span className="text-muted-foreground">Method</span>
                <span className="text-right">
                  {METHODS.find((m) => m.id === result.method)?.label}
                </span>
                <span className="text-muted-foreground">Atoms</span>
                <span className="text-right">{result.atomCount}</span>
                <span className="text-muted-foreground">Steps</span>
                <span className="text-right">{result.steps}</span>
                <span className="text-muted-foreground">Energy</span>
                <span className="text-right">{result.energy.toFixed(3)}</span>
                <span className="text-muted-foreground">Max |F|</span>
                <span className="text-right">{result.maxForce.toFixed(4)}</span>
                <span className="text-muted-foreground">Status</span>
                <span className="text-right text-success-foreground">
                  {result.converged ? "Converged" : "Max steps"}
                </span>
              </div>
            </ResultSection>
          )}
        </div>
      </AnalysisPanelShell>

      <UnsavedSceneDialog
        open={savePromptOpen}
        title="Save before optimize?"
        description="Optimization runs on the committed structure (DataSource). Save canvas edits first, or cancel."
        saveLabel="Save and run"
        onSave={handleSaveAndRun}
        onCancel={handlePromptCancel}
      />
    </>
  );
};
