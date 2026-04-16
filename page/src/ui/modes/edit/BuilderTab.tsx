import { Button } from "@/components/ui/button";
import {
  Block,
  Frame,
  ModeType,
  type Molvis,
  generate3D,
  parseSMILES,
} from "@molvis/core";
import { AlertCircle, Loader2, MousePointerClick, Wand2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SidebarSection } from "../../layout/SidebarSection";
import { DownloadStructureSection } from "./DownloadStructureSection";
import { KekuleComposer, type KekuleComposerRef } from "./KekuleComposer";
import { SmilesInput } from "./SmilesInput";

interface BuilderTabProps {
  app: Molvis | null;
}

type Status = "idle" | "generating" | "ready" | "error";

interface EditModeWithPending {
  type: ModeType.Edit;
  pendingMolecule: unknown;
}

function isEditMode(mode: unknown): mode is EditModeWithPending {
  if (!mode || typeof mode !== "object") return false;
  return (mode as { type?: unknown }).type === ModeType.Edit;
}

function generateAndPlace(
  app: Molvis,
  frame2d: Frame,
  setStatus: (s: Status) => void,
  setError: (e: string | null) => void,
) {
  try {
    const frame3d = generate3D(frame2d, "fast");
    frame2d.free();

    const mode = app.mode;
    if (isEditMode(mode)) {
      mode.pendingMolecule = frame3d;
      setStatus("ready");
      setError(null);
    } else {
      frame3d.free();
      setError("Switch to Edit mode first");
      setStatus("error");
    }
  } catch (err) {
    console.error("[BuilderTab] generate3D error:", err);
    setError(String(err));
    setStatus("error");
  }
}

export const BuilderTab: React.FC<BuilderTabProps> = ({ app }) => {
  const composerRef = useRef<KekuleComposerRef>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEdit, setIsEdit] = useState(false);

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
      setStatus("generating");
      try {
        const ir = parseSMILES(smiles);
        const frame2d = ir.toFrame();
        ir.free();
        generateAndPlace(app, frame2d, setStatus, setErrorMsg);
      } catch (err) {
        console.error("[BuilderTab] SMILES error:", err);
        setErrorMsg(String(err));
        setStatus("error");
      }
    },
    [app],
  );

  // Path 2: Kekule drawing → extract atoms/bonds → build Frame → generate3D → place
  const handleDrawing = useCallback(() => {
    if (!app) return;

    const data = composerRef.current?.getMoleculeData();
    if (!data || data.atoms.length === 0) {
      setErrorMsg("Draw a molecule first");
      setStatus("error");
      return;
    }

    setStatus("generating");
    try {
      const atomBlock = new Block();
      atomBlock.setColStr(
        "element",
        data.atoms.map((a) => a.element),
      );

      const frame2d = new Frame();
      frame2d.insertBlock("atoms", atomBlock);

      if (data.bonds.length > 0) {
        const bondBlock = new Block();
        bondBlock.setColU32(
          "atomi",
          new Uint32Array(data.bonds.map((b) => b.i)),
        );
        bondBlock.setColU32(
          "atomj",
          new Uint32Array(data.bonds.map((b) => b.j)),
        );
        bondBlock.setColU32(
          "order",
          new Uint32Array(data.bonds.map((b) => b.order)),
        );
        frame2d.insertBlock("bonds", bondBlock);
      }

      generateAndPlace(app, frame2d, setStatus, setErrorMsg);
    } catch (err) {
      console.error("[BuilderTab] drawing error:", err);
      setErrorMsg(String(err));
      setStatus("error");
    }
  }, [app]);

  if (!app || !isEdit) return null;

  const busy = status === "generating";

  return (
    <div className="flex flex-col h-full pointer-events-auto">
      <SidebarSection title="SMILES">
        <SmilesInput onParsed={handleSmiles} disabled={busy} />
      </SidebarSection>

      <DownloadStructureSection
        onSmilesFetched={handleSmiles}
        onError={(msg) => {
          setErrorMsg(msg);
          setStatus("error");
        }}
        disabled={busy}
      />

      <SidebarSection
        title="2D Sketch"
        className="flex-1 min-h-0 flex flex-col"
        contentClassName="flex-1 min-h-0 flex flex-col"
      >
        <KekuleComposer ref={composerRef} />
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-full mt-1 gap-1.5"
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
        </Button>
      </SidebarSection>

      {status === "error" && errorMsg && (
        <p className="flex items-start gap-1 px-2 py-1 text-[10px] text-destructive leading-tight">
          <AlertCircle className="h-3 w-3 shrink-0 mt-px" />
          <span className="truncate">{errorMsg}</span>
        </p>
      )}
      {status === "ready" && (
        <p className="flex items-center gap-1 px-2 py-1 text-[10px] text-emerald-500 leading-tight">
          <MousePointerClick className="h-3 w-3 shrink-0" />
          <span>Click the 3D canvas to place</span>
        </p>
      )}
    </div>
  );
};
