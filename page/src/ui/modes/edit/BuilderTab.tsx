import { Frame, generate3D, ModeType, type Molvis, parseSMILES } from "@molvis/core";
import { Loader2, Wand2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ViewerAction } from "@/components/viewer/ViewerAction";
import { ViewerOperationState } from "@/components/viewer/ViewerOperationState";
import { useViewerOperation } from "@/hooks/useViewerOperation";
import { SidebarSection } from "../../layout/SidebarSection";
import { DownloadStructureSection } from "./DownloadStructureSection";
import { MolvisSketch, type MolvisSketchRef } from "./MolvisSketch";
import { SmilesInput } from "./SmilesInput";

interface BuilderTabProps {
  app: Molvis | null;
}

interface EditModeWithPending {
  type: ModeType.Edit;
  pendingMolecule: unknown;
}

function isEditMode(mode: unknown): mode is EditModeWithPending {
  if (!mode || typeof mode !== "object") return false;
  return (mode as { type?: unknown }).type === ModeType.Edit;
}

function placeFrame(app: Molvis, frame3d: Frame) {
  const mode = app.mode;
  if (isEditMode(mode)) {
    mode.pendingMolecule = frame3d;
  } else {
    frame3d.free();
    throw new Error("Switch to Edit mode first");
  }
}

function generateAndPlace(app: Molvis, frame2d: Frame) {
  let frame3d: Frame;
  try {
    frame3d = generate3D(frame2d, "fast");
  } finally {
    frame2d.free();
  }
  placeFrame(app, frame3d);
}

const GENERATE_COPY = {
  running: "Generating a 3D structure…",
  success: "3D structure ready",
  successDetail: "Click the 3D canvas to place it.",
  error: "Could not generate the 3D structure",
};

export const BuilderTab: React.FC<BuilderTabProps> = ({ app }) => {
  const sketchRef = useRef<MolvisSketchRef>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const {
    feedback,
    running: generating,
    run: runGeneration,
    retry: retryGeneration,
    reset: resetGeneration,
  } = useViewerOperation();

  useEffect(() => {
    if (!app) return;
    const update = () => setIsEdit(isEditMode(app.mode));
    update();
    app.events.on("mode-change", update);
    return () => {
      app.events.off("mode-change", update);
    };
  }, [app]);

  // Path 1: SMILES → molrs parseSMILES → generate3D → place
  const handleSmiles = useCallback(
    (smiles: string) => {
      if (!app) return;
      void runGeneration(() => {
        const ir = parseSMILES(smiles);
        let frame2d: Frame;
        try {
          frame2d = ir.toFrame();
        } finally {
          ir.free();
        }
        generateAndPlace(app, frame2d);
      }, GENERATE_COPY);
    },
    [app, runGeneration],
  );

  // Path 2: sketch board → toFrame → generate3D → place
  const handleDrawing = useCallback(() => {
    if (!app) return;
    void runGeneration(() => {
      const frame2d = sketchRef.current?.toFrame();
      if (!frame2d) {
        throw new Error("Draw a molecule first");
      }
      generateAndPlace(app, frame2d);
    }, GENERATE_COPY);
  }, [app, runGeneration]);

  const handleDownloadBusyChange = useCallback(
    (next: boolean) => {
      setDownloadBusy(next);
      if (next) resetGeneration();
    },
    [resetGeneration],
  );

  if (!app || !isEdit) return null;

  const busy = generating || downloadBusy;

  return (
    <div aria-busy={busy} className="flex h-full flex-col pointer-events-auto">
      <SidebarSection title="SMILES">
        <SmilesInput onParsed={handleSmiles} disabled={busy} />
      </SidebarSection>

      <DownloadStructureSection
        onFrameFetched={(frame) => {
          if (!app) {
            frame.free();
            return;
          }
          placeFrame(app, frame);
        }}
        disabled={generating}
        onBusyChange={handleDownloadBusyChange}
      />

      <SidebarSection
        title="2D Sketch"
        className="flex-1 min-h-0 flex flex-col"
        contentClassName="flex-1 min-h-0 flex flex-col"
      >
        <MolvisSketch ref={sketchRef} disabled={busy} />
        <ViewerAction
          purpose="dismiss"
          className="mt-1 w-full"
          onClick={handleDrawing}
          disabled={busy}
          title="Generate 3D from sketch & place"
          aria-label="Generate 3D from sketch & place"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wand2 className="h-3.5 w-3.5" />
          )}
        </ViewerAction>
      </SidebarSection>

      {feedback && (
        <div className="p-2">
          <ViewerOperationState
            {...feedback}
            action={
              feedback.phase === "error" ? (
                <ViewerAction
                  purpose="dismiss"
                  onClick={() => void retryGeneration()}
                >
                  Retry
                </ViewerAction>
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  );
};
