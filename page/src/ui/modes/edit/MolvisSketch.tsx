import type { Frame } from "@molcrafts/molvis-core/molrs";
import {
  type MoleculeData,
  type SketchBoardState,
  SketchComposer,
} from "@molcrafts/molvis-sketch";
import { ExternalLink, Minimize2 } from "lucide-react";
import {
  forwardRef,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ViewerToolButton } from "@/components/viewer/ViewerToolButton";
import { cn } from "@/lib/utils";

export interface MolvisSketchRef {
  getMoleculeData(): MoleculeData | null;
  toFrame(): Frame | null;
  getState(): SketchBoardState | null;
  toSvg(): string | null;
  toPng(): Promise<Blob | null>;
}

export interface MolvisSketchProps {
  minHeight?: number;
  disabled?: boolean;
  /**
   * Host-only icon actions injected into the sketch common rail `extraSlot`
   * (layout slot — never overlaid on top of chem tools). e.g. generate-3D.
   */
  extraActions?: ReactNode;
  /** Host-specific file sink. Browser downloads are used when omitted. */
  onExportFile?: (blob: Blob, filename: string) => void | Promise<void>;
  /** Whether the editor can move into a page-level modal. Default true. */
  allowPopout?: boolean;
  className?: string;
}

/**
 * React host for `@molcrafts/molvis-sketch` {@link SketchComposer}.
 *
 * - Chrome lives in sketch (`gui: true`); page does not reimplement rails.
 * - Product look: Tailwind maps tokens → `--msk-*` via `.molvis-sketch-host`.
 * - Pop-out / generate-3D: portal into `composer.extraSlot` (common rail end).
 * - Pop-out reparents a stable shell node (no remount, no cover overlay).
 */
export const MolvisSketch = forwardRef<MolvisSketchRef, MolvisSketchProps>(
  (
    {
      minHeight = 240,
      disabled = false,
      extraActions,
      onExportFile,
      allowPopout = true,
      className,
    },
    ref,
  ) => {
    const inlineAnchorRef = useRef<HTMLDivElement>(null);
    const dialogAnchorRef = useRef<HTMLDivElement>(null);
    const onExportFileRef = useRef(onExportFile);
    onExportFileRef.current = onExportFile;

    // Imperative shell so pop-out can reparent without React unmounting the board.
    const shellRef = useRef<HTMLDivElement | null>(null);
    if (shellRef.current === null && typeof document !== "undefined") {
      const shell = document.createElement("div");
      shell.className = "molvis-sketch-host h-full min-h-0 w-full min-w-0";
      shellRef.current = shell;
    }

    const [composer] = useState(
      () =>
        new SketchComposer({
          gui: true,
          onExportFile: (blob, filename) =>
            onExportFileRef.current?.(blob, filename),
        }),
    );
    const [poppedOut, setPoppedOut] = useState(false);
    const [extraSlot, setExtraSlot] = useState<HTMLElement | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        getMoleculeData() {
          const data = composer.board.getMoleculeData();
          if (data.atoms.length === 0) return null;
          return data;
        },
        toFrame() {
          if (composer.board.getMoleculeData().atoms.length === 0) return null;
          return composer.board.toFrame();
        },
        getState() {
          return composer.board.getState();
        },
        toSvg() {
          if (composer.board.getMoleculeData().atoms.length === 0) return null;
          return composer.board.toSvg();
        },
        async toPng() {
          if (composer.board.getMoleculeData().atoms.length === 0) return null;
          return composer.board.toPng();
        },
      }),
      [composer],
    );

    useEffect(() => {
      const shell = shellRef.current;
      if (!shell) return;
      composer.mount(shell);
      setExtraSlot(composer.extraSlot);
      return () => {
        composer.unmount();
        setExtraSlot(null);
      };
    }, [composer]);

    // Keep shell under the active anchor (inline panel vs modal).
    useLayoutEffect(() => {
      const shell = shellRef.current;
      const target = poppedOut
        ? dialogAnchorRef.current
        : inlineAnchorRef.current;
      if (!shell || !target) return;
      if (shell.parentElement !== target) {
        target.appendChild(shell);
      }
    }, [poppedOut]);

    useEffect(() => {
      composer.setDisabled(disabled);
    }, [composer, disabled]);

    const hostActions =
      extraSlot &&
      (allowPopout || extraActions) &&
      createPortal(
        <>
          {allowPopout && (
            <ViewerToolButton
              label={poppedOut ? "Return sketch to panel" : "Pop out sketch"}
              disabled={disabled}
              className="[&_svg]:shrink-0"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setPoppedOut((open) => !open);
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {poppedOut ? <Minimize2 /> : <ExternalLink />}
            </ViewerToolButton>
          )}
          {extraActions}
        </>,
        extraSlot,
      );

    return (
      <Dialog open={poppedOut} onOpenChange={setPoppedOut}>
        {hostActions}
        <div
          ref={inlineAnchorRef}
          className={cn(
            "molvis-sketch-container min-h-0 w-full flex-1 overflow-visible",
            poppedOut && "hidden",
            className,
          )}
          style={{ minHeight: poppedOut ? undefined : minHeight }}
        />
        {poppedOut && (
          <DialogContent
            aria-label="2D molecule sketch"
            className="h-[min(92vh,900px)] w-[min(94vw,1400px)] max-w-none gap-0 overflow-hidden p-0 sm:max-w-none"
            showCloseButton={false}
          >
            <DialogTitle className="sr-only">2D molecule sketch</DialogTitle>
            <div
              ref={dialogAnchorRef}
              className="molvis-sketch-container h-full min-h-0 w-full overflow-visible"
            />
          </DialogContent>
        )}
      </Dialog>
    );
  },
);

MolvisSketch.displayName = "MolvisSketch";
