import { loadKekule } from "@/lib/kekule-loader";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import "./kekule-overrides.css";

export interface KekuleAtomData {
  element: string;
  x: number;
  y: number;
}

export interface KekuleBondData {
  i: number;
  j: number;
  order: number;
}

export interface KekuleComposerRef {
  getMoleculeData(): {
    atoms: KekuleAtomData[];
    bonds: KekuleBondData[];
  } | null;
}

interface KekuleComposerProps {
  /** Minimum height so the composer never collapses below a usable size. */
  minHeight?: number;
}

type LoadState = "loading" | "ready" | "error";

export const KekuleComposer = forwardRef<
  KekuleComposerRef,
  KekuleComposerProps
>(({ minHeight = 220 }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<Kekule.Editor.Composer | null>(null);
  const kekuleRef = useRef<typeof Kekule | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useImperativeHandle(ref, () => ({
    getMoleculeData() {
      const K = kekuleRef.current;
      const composer = composerRef.current;
      if (!K || !composer) return null;

      try {
        const mols = composer.exportObjs(K.Molecule);
        const mol = mols[0];
        if (!mol) return null;

        const nAtoms = mol.getNodeCount();
        if (nAtoms === 0) return null;

        const atoms: KekuleAtomData[] = [];
        for (let i = 0; i < nAtoms; i++) {
          const node = mol.getNodeAt(i);
          const coord = node.getCoord2D() ?? { x: 0, y: 0 };
          atoms.push({
            element: node.getSymbol() || "C",
            x: coord.x ?? 0,
            y: coord.y ?? 0,
          });
        }

        const nBonds = mol.getConnectorCount();
        const bonds: KekuleBondData[] = [];
        for (let b = 0; b < nBonds; b++) {
          const conn = mol.getConnectorAt(b);
          const a1 = conn.getConnectedObjAt(0);
          const a2 = conn.getConnectedObjAt(1);
          const i = mol.indexOfNode(a1);
          const j = mol.indexOfNode(a2);
          if (i >= 0 && j >= 0) {
            bonds.push({ i, j, order: conn.getBondOrder() || 1 });
          }
        }

        return { atoms, bonds };
      } catch (err) {
        console.error("[KekuleComposer] getMoleculeData:", err);
        return null;
      }
    },
  }));

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryKey triggers reload
  useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        const K = await loadKekule();
        if (disposed || !containerRef.current) return;
        kekuleRef.current = K;

        const composer = new K.Editor.Composer(document);
        // Fill the container and let Composer's built-in ResizeObserver
        // (setObserveElemResize in composers.js) relayout toolbars + canvas
        // when the sidebar resizes. Container owns the explicit pixel height.
        composer.setDimension("100%", "100%");
        composer.appendToElem(containerRef.current);
        // Editor starts without a ChemObj and silently drops clicks; create
        // an empty Molecule so atom/bond tools have something to draw into.
        composer.newDoc();
        composerRef.current = composer;
        setState("ready");
      } catch (err) {
        if (disposed) return;
        setErrorMsg(String(err));
        setState("error");
      }
    })();

    return () => {
      disposed = true;
      try {
        composerRef.current?.finalize();
      } catch {
        /* */
      }
      composerRef.current = null;
      kekuleRef.current = null;
    };
  }, [retryKey]);

  if (state === "error") {
    return (
      <div className="p-4 text-xs text-muted-foreground text-center">
        <p>Failed to load 2D editor</p>
        <p className="text-[10px] text-destructive mt-1">{errorMsg}</p>
        <button
          type="button"
          className="text-[10px] underline mt-1"
          onClick={() => {
            setState("loading");
            setRetryKey((k) => k + 1);
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full" style={{ minHeight }}>
      {state === "loading" && (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
          Loading 2D editor...
        </div>
      )}
      <div
        ref={containerRef}
        className="kekule-container flex-1 min-h-0 w-full"
        style={{ display: state === "loading" ? "none" : "block" }}
      />
    </div>
  );
});

KekuleComposer.displayName = "KekuleComposer";
