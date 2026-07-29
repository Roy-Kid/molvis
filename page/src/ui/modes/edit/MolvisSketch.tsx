import {
  SketchBoard,
  type MoleculeData,
  type SketchTool,
} from "@molcrafts/molvis-sketch";
import type { Frame } from "@molcrafts/molrs";
import {
  Atom,
  Eraser,
  Hexagon,
  Link2,
  MousePointer2,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ViewerIconAction } from "@/components/viewer/ViewerIconAction";
import { ViewerToggleAction } from "@/components/viewer/ViewerToggleAction";
import { cn } from "@/lib/utils";

const ELEMENTS = ["C", "N", "O", "H", "P", "S", "F", "Cl", "Br", "I"];

export interface MolvisSketchRef {
  getMoleculeData(): MoleculeData | null;
  toFrame(): Frame | null;
}

interface MolvisSketchProps {
  minHeight?: number;
  disabled?: boolean;
}

/**
 * React host for `@molcrafts/molvis-sketch` SketchBoard.
 * Imperative ref exposes getMoleculeData / toFrame for Builder generate path.
 */
export const MolvisSketch = forwardRef<MolvisSketchRef, MolvisSketchProps>(
  ({ minHeight = 220, disabled = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const boardRef = useRef<SketchBoard | null>(null);
    const [tool, setTool] = useState<SketchTool>("atom");
    const [element, setElement] = useState("C");
    const [bondOrder, setBondOrder] = useState<1 | 2 | 3>(1);

    useImperativeHandle(ref, () => ({
      getMoleculeData() {
        const data = boardRef.current?.getMoleculeData();
        if (!data || data.atoms.length === 0) return null;
        return data;
      },
      toFrame() {
        const board = boardRef.current;
        if (!board) return null;
        const data = board.getMoleculeData();
        if (data.atoms.length === 0) return null;
        return board.toFrame();
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const board = new SketchBoard();
      boardRef.current = board;
      board.mount(canvas);

      const applyTheme = () => {
        const styles = getComputedStyle(container);
        const bg =
          styles.getPropertyValue("--molvis-panel").trim() ||
          styles.getPropertyValue("--background").trim() ||
          "#f7f8fa";
        const fg =
          styles.getPropertyValue("--molvis-foreground").trim() ||
          styles.getPropertyValue("--foreground").trim() ||
          "#111";
        board.setTheme({
          background: bg.startsWith("oklch") ? "#f7f8fa" : bg || "#f7f8fa",
          labelFill: fg.startsWith("oklch") ? "#111111" : fg || "#111",
          bondStroke: fg.startsWith("oklch") ? "#222222" : fg || "#222",
          selectionStroke: "#2563eb",
        });
      };
      applyTheme();

      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        board.resize(Math.max(1, width), Math.max(1, height));
      });
      ro.observe(container);

      return () => {
        ro.disconnect();
        board.unmount();
        boardRef.current = null;
      };
    }, []);

    useEffect(() => {
      boardRef.current?.setTool(tool);
    }, [tool]);

    useEffect(() => {
      boardRef.current?.setElement(element);
    }, [element]);

    useEffect(() => {
      boardRef.current?.setBondOrder(bondOrder);
    }, [bondOrder]);

    const tools: Array<{ id: SketchTool; label: string; icon: ReactNode }> = [

        { id: "atom", label: "Atom", icon: <Atom className="h-3.5 w-3.5" /> },
        { id: "bond", label: "Bond", icon: <Link2 className="h-3.5 w-3.5" /> },
        {
          id: "select",
          label: "Select",
          icon: <MousePointer2 className="h-3.5 w-3.5" />,
        },
        {
          id: "erase",
          label: "Erase",
          icon: <Eraser className="h-3.5 w-3.5" />,
        },
        {
          id: "ring",
          label: "Ring",
          icon: <Hexagon className="h-3.5 w-3.5" />,
        },
      ];

    return (
      <div
        aria-disabled={disabled}
        className={cn(
          "flex min-h-0 w-full flex-1 flex-col gap-1",
          disabled && "pointer-events-none opacity-60",
        )}
        style={{ minHeight }}
      >
        <div className="flex flex-wrap items-center gap-1 px-0.5">
          {tools.map((t) => (
            <ViewerToggleAction
              key={t.id}
              selected={tool === t.id}
              onClick={() => {
                setTool(t.id);
                if (t.id === "ring") {
                  boardRef.current?.setRingTemplate(6, "benzene");
                }
              }}
              title={t.label}
              aria-label={t.label}
            >
              {t.icon}
            </ViewerToggleAction>
          ))}
          <Select value={element} onValueChange={setElement}>
            <SelectTrigger
              className="h-control-compact w-14 px-1 text-xs"
              aria-label="Element"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ELEMENTS.map((el) => (
                <SelectItem key={el} value={el}>
                  <span className="font-mono">{el}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-0.5">
            {([1, 2, 3] as const).map((o) => (
              <ViewerToggleAction
                key={o}
                selected={bondOrder === o}
                onClick={() => setBondOrder(o)}
                title={`Bond order ${o}`}
                aria-label={`Bond order ${o}`}
              >
                <span className="font-mono text-xs">{o}</span>
              </ViewerToggleAction>
            ))}
          </div>
          <ViewerIconAction
            icon={<Undo2 />}
            label="Undo"
            onClick={() => boardRef.current?.undo()}
          />
          <ViewerIconAction
            icon={<Redo2 />}
            label="Redo"
            onClick={() => boardRef.current?.redo()}
          />
          <ViewerIconAction
            icon={<Trash2 />}
            label="Clear"
            onClick={() => boardRef.current?.clear()}
          />
        </div>
        <div
          ref={containerRef}
          className="molvis-sketch-container relative min-h-0 w-full flex-1 overflow-hidden rounded-md border bg-background"
        >
          <canvas
            ref={canvasRef}
            aria-label="2D molecule sketch"
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    );
  },
);

MolvisSketch.displayName = "MolvisSketch";
