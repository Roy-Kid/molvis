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
  height?: number;
}

type LoadState = "loading" | "ready" | "error";

export const KekuleComposer = forwardRef<
  KekuleComposerRef,
  KekuleComposerProps
>(({ height = 280 }, ref) => {
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
        composer.setDimension("100%", `${Math.round(height / 0.75)}px`);
        composer.appendToElem(containerRef.current);
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
  }, [height, retryKey]);

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

  // Composer renders at full size, CSS scale(0.75) shrinks it.
  // Container clips to the scaled height.
  const scale = 0.75;
  const innerHeight = Math.round(height / scale);
  const innerWidth = `${Math.round(100 / scale)}%`;

  return (
    <div style={{ height, overflow: "hidden" }}>
      {state === "loading" && (
        <div
          className="flex items-center justify-center text-xs text-muted-foreground"
          style={{ height }}
        >
          Loading 2D editor...
        </div>
      )}
      <div
        ref={containerRef}
        className="kekule-container"
        style={{
          width: innerWidth,
          height: innerHeight,
          display: state === "loading" ? "none" : "block",
        }}
      />
    </div>
  );
});

KekuleComposer.displayName = "KekuleComposer";
