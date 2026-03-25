import {
  Block,
  Frame,
  ModeType,
  type Molvis,
  generate3D,
  parseSMILES,
} from "@molvis/core";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SidebarSection } from "../../layout/SidebarSection";
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
        "symbol",
        data.atoms.map((a) => a.element),
      );

      const frame2d = new Frame();
      frame2d.insertBlock("atoms", atomBlock);

      if (data.bonds.length > 0) {
        const bondBlock = new Block();
        bondBlock.setColU32("i", new Uint32Array(data.bonds.map((b) => b.i)));
        bondBlock.setColU32("j", new Uint32Array(data.bonds.map((b) => b.j)));
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

  return (
    <div className="flex flex-col h-full pointer-events-auto">
      <SidebarSection title="SMILES">
        <SmilesInput
          onParsed={handleSmiles}
          disabled={status === "generating"}
        />
      </SidebarSection>

      <SidebarSection title="2D Drawing">
        <KekuleComposer ref={composerRef} height={260} />
        <button
          type="button"
          className="w-full h-7 mt-1 rounded border text-[10px] font-medium transition-colors hover:bg-muted/30 disabled:opacity-50"
          onClick={handleDrawing}
          disabled={status === "generating"}
        >
          Place
        </button>
      </SidebarSection>

      {status === "error" && errorMsg && (
        <p className="px-2 text-[10px] text-destructive leading-tight mt-1">
          {errorMsg}
        </p>
      )}
      {status === "ready" && (
        <p className="px-2 text-[10px] text-emerald-500 leading-tight mt-1">
          Click on the 3D canvas to place
        </p>
      )}
    </div>
  );
};
