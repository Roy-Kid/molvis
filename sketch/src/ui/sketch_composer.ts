import {
  defineMolvisElementPicker,
  type MolvisElementPickerElement,
} from "@molcrafts/molvis-core/element-picker";
import { isCtrlOrMeta } from "@molcrafts/molvis-core/platform";
import { showImageExportDialog } from "@molcrafts/ui-web-components/image-export";
import { saveBlob } from "@molcrafts/ui-web-components/save-file";
import {
  ANNOTATION_CORNERS,
  type AnnotationCorner,
  annotationLabel,
  annotationText,
  type BracketVariant,
  DEFAULT_ANNOTATION_STROKE,
  DEFAULT_BRACKET_LABEL,
  DEFAULT_TEXT_ANNOTATION,
  measureAnnotationText,
  type SketchAnnotation,
  type SketchDocument,
  withAnnotationLabel,
} from "../annotations";
import {
  SketchBoard,
  type SketchBoardOptions,
  type SketchTool,
} from "../board/sketch_board";
import {
  DEFAULT_THEME,
  type SketchRenderTheme,
} from "../board/sketch_renderer";
import { fragmentPreviewSvg } from "../geometry/fragment_preview";
import {
  DEFAULT_FRAGMENT_ID,
  type FragmentTemplate,
  listFragmentCategories,
} from "../geometry/fragment_templates";
import { depictionInk } from "../style/depiction-tokens";
import { colorForElement } from "../style/element_colors";
import { showAnnotationDialog } from "./annotation_dialog";
import {
  BRACKET_CHOICES,
  bondOrderIcon,
  chargeDeltaIcon,
  ICONS,
  parseSvgMarkup,
  ringSizeIcon,
  stereoModeIcon,
} from "./icons";
import { ensureComposerStyles } from "./styles";
import {
  cssColorToHex,
  readCanvasThemeFromHost,
  readCustomDefaultFromHost,
} from "./theme_bridge";

/** `edit` is the editor; `readonly` is a preview that cannot change the molecule. */
export type SketchMode = "readonly" | "edit";

export interface SketchComposerOptions {
  /**
   * When `true` (default), mount icon toolbars around the canvas — same role as
   * stage's `gui` flag. When `false`, only the canvas fills the container
   * (host supplies its own chrome, or headless/embed use).
   */
  gui?: boolean;
  /**
   * Required, so a host always says which it means. `edit` is the editor:
   * common rail, chem tools, drawing. `readonly` is a preview: the MolCrafts
   * preview header (reset view, zoom, fullscreen, PNG / SVG export), no chem
   * tools, and a board that pans and zooms but does not draw.
   */
  mode: SketchMode;
  board?: SketchBoardOptions;
  theme?: Partial<SketchRenderTheme>;
  /** Set to false when the enclosing document provides undo and redo controls. */
  showHistoryActions?: boolean;
  /** Let the host provide fit and zoom controls. */
  showViewActions?: boolean;
  /** Place toolbars over a full-size canvas, preserving the artwork's bounds. */
  overlayTools?: boolean;
  /** Host-specific file sink. Browser download is used when omitted. */
  onExportFile?: (blob: Blob, filename: string) => void | Promise<void>;
}

const TOOL_HELP: Record<SketchTool, string> = {
  select:
    "Click to select; click a selected bond to cycle its order. Double-click a label to edit.",
  pan: "Drag to move the canvas.",
  erase: "Click an atom, bond, or figure object to remove it.",
  annotation: "Choose a figure object, then click or drag on the canvas.",
  bond: "Drag to draw a bond and snap to text or atoms. Click to select; click again to cycle.",
  atom: "Choose an element, then click paper or an existing atom.",
  ring: "Click paper, an atom, or a bond to place or fuse a ring.",
  chain:
    "Press and drag from an atom or empty paper; farther makes more bonds.",
  charge: "Choose + or −, then click an atom.",
  stereo: "Choose a wedge style, then click a single bond.",
  fragment:
    "Pick a fragment template, then click paper or an atom to place it.",
};

/** Quick picks in the atom-tool assoc rail (full table stays on the picker). */
const COMMON_ELEMENTS = [
  "C",
  "H",
  "N",
  "O",
  "S",
  "P",
  "F",
  "Cl",
  "Br",
  "I",
  "*",
] as const;

const CHEM_TOOLS = [
  { id: "bond", label: "Bond", icon: "bond" },
  { id: "atom", label: "Atom", icon: "atom" },
  { id: "ring", label: "Ring", icon: "ring" },
  { id: "fragment", label: "Fragment templates", icon: "fragment" },
  { id: "chain", label: "Chain", icon: "chain" },
  { id: "charge", label: "Charge", icon: "charge" },
  { id: "stereo", label: "Stereo", icon: "stereo" },
] as const;

const FIGURE_TOOLS = [
  {
    kind: "text",
    name: "Text",
    preset: DEFAULT_TEXT_ANNOTATION,
  },
  {
    kind: "rectangle",
    name: "Rectangle",
    preset: { kind: "rectangle", x: 0, y: 0, width: 4, height: 2.5 },
  },
  {
    kind: "ellipse",
    name: "Circle or ellipse",
    preset: {
      kind: "ellipse",
      x: 0,
      y: 0,
      width: 1.4,
      height: 1.4,
    },
  },
  {
    kind: "bracket",
    name: "Repeat brackets",
    preset: {
      kind: "bracket",
      x: 0,
      y: 0,
      width: 2.5,
      height: 1.6,
      variant: "square",
    },
  },
] as const satisfies ReadonlyArray<{
  kind: SketchAnnotation["kind"];
  name: string;
  preset: SketchAnnotation;
}>;

const FIGURE_SHORTCUTS: Partial<Record<SketchAnnotation["kind"], string>> = {
  rectangle: "r",
  ellipse: "o",
  text: "t",
};

const FIGURE_VARIANTS = {
  rectangle: [
    { id: "sharp", name: "Rectangle", icon: "rectanglePlain" },
    { id: "rounded", name: "Rounded rectangle", icon: "rectangle" },
  ],
  ellipse: [
    { id: "ellipse", name: "Ellipse", icon: "ellipse" },
    { id: "circle", name: "Circle", icon: "circle" },
  ],
  bracket: BRACKET_CHOICES,
} as const;

type FigureVariantKind = keyof typeof FIGURE_VARIANTS;
const FIGURE_HOLD_MS = 450;

const CORNER_NAMES: Record<AnnotationCorner, string> = {
  topLeft: "top-left",
  topRight: "top-right",
  bottomRight: "bottom-right",
  bottomLeft: "bottom-left",
};
const FIGURE_HOLD_SLOP_PX = 8;

interface DrawingToolSection {
  group: HTMLElement;
  tools: HTMLElement;
  trigger: HTMLButtonElement;
  compact: boolean;
}

/**
 * Host shell for {@link SketchBoard}: optional top common, left drawing-tool,
 * and bottom option rails controlled by the `gui` flag.
 *
 * Hosts that need product-only actions (e.g. pop-out, generate-3D) inject into
 * {@link extraSlot}.
 */
export class SketchComposer {
  readonly board: SketchBoard;
  /** Root element with class `molvis-sketch-composer`. */
  readonly root: HTMLElement;
  /**
   * Common-rail slot for host-only actions (React portals, generate-3D, …).
   * Empty when `gui: false`.
   */
  readonly extraSlot: HTMLElement;

  private readonly gui: boolean;
  private readonly readonlyMode: boolean;
  private readonly showHistoryActions: boolean;
  private readonly showViewActions: boolean;
  /**
   * Read-only only: the empty row above the board where a host mounts the
   * MolCrafts preview header (`@molcrafts/ui/preview`). `null` otherwise.
   */
  readonly previewSlot: HTMLElement | null = null;
  private readonly onExportFile?: SketchComposerOptions["onExportFile"];
  /** Explicit theme from options — CSS host bridge must not clobber these. */
  private readonly explicitTheme: Partial<SketchRenderTheme>;
  private canvas: HTMLCanvasElement;
  private stage: HTMLElement;
  private commonBar: HTMLElement | null = null;
  private chemBar: HTMLElement | null = null;
  private assocBar: HTMLElement | null = null;
  private inlineTextEditor: HTMLTextAreaElement | null = null;
  private imageExportDialog: HTMLDialogElement | null = null;
  private bracketCorner: AnnotationCorner = "bottomRight";
  private readonly bracketCornerButtons = new Map<
    AnnotationCorner,
    HTMLButtonElement
  >();
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private unsubscribe: (() => void) | null = null;
  private toolButtons = new Map<SketchTool, HTMLButtonElement>();
  private viewButtons: HTMLButtonElement[] = [];
  private orderButtons = new Map<1 | 2 | 3, HTMLButtonElement>();
  private elementPicker: MolvisElementPickerElement | null = null;
  private renderedAssocTool: SketchTool | null = null;
  private renderedAnnotationSelection = 0;
  private renderedDisabled = false;
  private figureKind: SketchAnnotation["kind"] = "text";
  private readonly figurePresets = new Map<
    SketchAnnotation["kind"],
    SketchAnnotation
  >(FIGURE_TOOLS.map(({ kind, preset }) => [kind, preset]));
  private exportMenu: HTMLElement | null = null;
  private exportButton: HTMLButtonElement | null = null;
  private fragmentMenu: HTMLElement | null = null;
  private fragmentButton: HTMLButtonElement | null = null;
  private readonly toolSections: DrawingToolSection[] = [];
  private openToolSection: DrawingToolSection | null = null;
  private figureLockButton: HTMLButtonElement | null = null;
  private circleTool = false;
  private figureVariantPopup: {
    button: HTMLButtonElement;
    menu: HTMLElement;
  } | null = null;
  private figureHold: {
    button: HTMLButtonElement;
    pointerId: number;
    x: number;
    y: number;
    timer: number;
  } | null = null;
  private suppressFigureClick: HTMLButtonElement | null = null;
  private readonly figureTools = new Map<
    SketchAnnotation["kind"],
    HTMLButtonElement
  >();
  private openSubmenuId: string | null = null;
  /** Wide-mode icon cluster in the common rail. */
  private commonInline: HTMLElement | null = null;
  private commonOverflowBtn: HTMLButtonElement | null = null;
  private commonOverflowMenu: HTMLElement | null = null;
  private commonRailObserver: ResizeObserver | null = null;
  private extraSlotObserver: MutationObserver | null = null;
  /** Cancels in-flight multi-frame compact remeasures. */
  private compactRemeasureToken = 0;
  private readonly onHostThemeChange = (): void => {
    this.syncCanvasThemeFromHost(false);
  };
  private readonly onDocPointerDown = (event: PointerEvent) => {
    this.suppressFigureClick = null;
    const target = event.target as Node | null;
    if (
      this.exportMenu &&
      this.exportButton &&
      target &&
      !this.exportMenu.contains(target) &&
      !this.exportButton.contains(target)
    ) {
      this.setExportMenuOpen(false);
    }
    if (
      this.commonOverflowMenu &&
      this.commonOverflowBtn &&
      target &&
      !this.commonOverflowMenu.contains(target) &&
      !this.commonOverflowBtn.contains(target)
    ) {
      this.setCommonOverflowOpen(false);
    }
    const variants = this.figureVariantPopup;
    if (
      variants &&
      !variants.menu.contains(target) &&
      !variants.button.contains(target)
    ) {
      this.closeFigureVariants();
    }
    if (
      this.openToolSection &&
      !this.openToolSection.group.contains(target) &&
      !this.figureVariantPopup?.menu.contains(target)
    ) {
      this.setToolSectionOpen(null);
    }
    if (
      this.fragmentMenu &&
      this.fragmentButton &&
      target &&
      !this.fragmentMenu.contains(target) &&
      !this.fragmentButton.contains(target)
    ) {
      this.setFragmentMenuOpen(false);
    }
  };
  private readonly onDocKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      const variants = this.figureVariantPopup;
      if (variants) {
        event.preventDefault();
        this.closeFigureVariants();
        variants.button.focus({ preventScroll: true });
        return;
      }
      const activeSection = this.openToolSection;
      if (activeSection) {
        this.setToolSectionOpen(null);
        activeSection.trigger.focus({ preventScroll: true });
      }
      this.setExportMenuOpen(false);
      this.setCommonOverflowOpen(false);
      this.setFragmentMenuOpen(false);
    }
  };

  constructor(options: SketchComposerOptions) {
    this.gui = options.gui !== false;
    if (options.mode !== "readonly" && options.mode !== "edit") {
      throw new Error(
        `SketchComposer mode must be "readonly" or "edit", got ${JSON.stringify(options.mode)}`,
      );
    }
    this.readonlyMode = options.mode === "readonly";
    this.showHistoryActions = options.showHistoryActions !== false;
    this.showViewActions = options.showViewActions !== false;
    this.onExportFile = options.onExportFile;
    this.explicitTheme = options.theme ?? {};
    this.board = new SketchBoard({
      ...options.board,
      onPlaceText:
        this.gui && !this.readonlyMode
          ? (item) =>
              this.editAnnotationText({
                ...item,
                label: { ...item.label, text: "" },
              })
          : options.board?.onPlaceText,
      onPaint: () => {
        this.positionBracketCorners();
        options.board?.onPaint?.();
      },
    });
    this.board.setTheme({
      ...DEFAULT_THEME,
      ...this.explicitTheme,
    });
    this.board.setRingTemplate(6, "benzene");
    this.board.setFragmentTemplate(DEFAULT_FRAGMENT_ID);
    this.board.setTool("select");

    ensureComposerStyles();
    if (this.gui) {
      defineMolvisElementPicker();
    }

    this.root = document.createElement("section");
    this.root.className = "molvis-sketch-composer";
    this.root.setAttribute("aria-label", "Molecule sketch composer");
    this.root.dataset.gui = this.gui ? "true" : "false";
    this.root.dataset.readonly = this.readonlyMode ? "true" : "false";
    if (options.overlayTools) this.root.dataset.overlayTools = "true";

    this.extraSlot = document.createElement("div");
    this.extraSlot.className = "msk-extra-slot";

    this.stage = document.createElement("div");
    this.stage.className = "molvis-sketch-composer__stage";

    this.canvas = document.createElement("canvas");
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute("aria-label", "2D molecule sketch");
    this.stage.appendChild(this.canvas);

    const showEditor = this.gui && !this.readonlyMode;
    if (showEditor) {
      this.commonBar = document.createElement("div");
      this.commonBar.className = "molvis-sketch-composer__common";
      this.commonBar.setAttribute("role", "toolbar");
      this.commonBar.setAttribute("aria-label", "Edit");

      this.chemBar = document.createElement("div");
      this.chemBar.className = "molvis-sketch-composer__chem";
      this.chemBar.setAttribute("role", "toolbar");
      this.chemBar.setAttribute("aria-label", "Drawing tools");
      this.chemBar.setAttribute("aria-orientation", "vertical");

      this.assocBar = document.createElement("div");
      this.assocBar.className = "molvis-sketch-composer__assoc";
      this.assocBar.setAttribute("role", "toolbar");
      this.assocBar.setAttribute("aria-label", "Tool options");
    }
    if (showEditor && this.commonBar && this.chemBar && this.assocBar) {
      this.root.append(this.commonBar, this.chemBar, this.stage, this.assocBar);
      this.buildCommonRail();
      this.buildChemRail();
      for (const corner of ANNOTATION_CORNERS) {
        const label = `Edit ${CORNER_NAMES[corner]} label`;
        const button = this.iconBtn(
          label,
          "text",
          () => {
            this.inlineTextEditor?.blur();
            const selection = this.board.getSelectedAnnotation();
            if (selection?.item.kind === "bracket")
              this.editAnnotationText(selection.item, selection.index, corner);
          },
          { className: "msk-bracket-label" },
        );
        button.hidden = true;
        this.bracketCornerButtons.set(corner, button);
        this.stage.append(button);
      }
      this.canvas.addEventListener("dblclick", (event) => {
        if (event.button !== 0 || this.board.getTool() !== "select") return;
        const rect = this.canvas.getBoundingClientRect();
        const point = this.board.viewport.screenToDoc(
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
        const hit = this.board.hitAt(point);
        const selection = this.board.getSelectedAnnotation();
        if (hit.kind === "atom") {
          this.editAtomText(hit.index);
        } else if (
          hit.kind === "annotation" &&
          selection?.index === hit.index
        ) {
          this.editAnnotationText(selection.item, selection.index);
        } else if (hit.kind === "none") {
          const preset = this.figurePresets.get("text");
          if (preset?.kind === "text")
            this.editAnnotationText({
              ...preset,
              ...point,
              label: { ...preset.label, text: "" },
            });
        }
      });
      this.canvas.addEventListener("wheel", () =>
        this.inlineTextEditor?.blur(),
      );
      this.canvas.addEventListener("keydown", (event) =>
        this.handleFigureShortcut(event),
      );
    } else if (this.gui) {
      // Read-only: a slot for the shared preview header, not a hand-built rail.
      const header = document.createElement("div");
      header.className = "molvis-sketch-composer__preview";
      this.root.append(header, this.stage);
      this.previewSlot = header;
    } else {
      this.root.appendChild(this.stage);
    }
  }

  /**
   * Mount into a host container (fills it).
   * Re-parenting to a new host (e.g. pop-out) keeps the board and chrome
   * instance — including portal targets — without a full teardown.
   */
  mount(container: HTMLElement): void {
    if (this.container === container && this.root.parentElement === container) {
      return;
    }

    if (this.container) {
      this.cancelFigureHold();
      this.closeFigureVariants();
      this.setToolSectionOpen(null);
      // Reparent only: board + listeners stay live.
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.commonRailObserver?.disconnect();
      this.commonRailObserver = null;
      container.appendChild(this.root);
      this.container = container;
      this.observeStageSize();
      this.observeCommonRailWidth();
      // Host CSS tokens may differ after pop-out / reparent.
      this.syncCanvasThemeFromHost(false);
      return;
    }

    this.container = container;
    container.appendChild(this.root);
    this.board.mount(this.canvas);
    if (this.readonlyMode) this.board.setReadonly(true);
    this.observeStageSize();
    this.observeCommonRailWidth();
    this.syncCanvasThemeFromHost(true);
    if (typeof window !== "undefined") {
      window.addEventListener("molvis:theme-change", this.onHostThemeChange);
    }

    if (this.gui) {
      this.unsubscribe = this.board.subscribe(() => this.syncUi());
      document.addEventListener("pointerdown", this.onDocPointerDown, true);
      document.addEventListener("keydown", this.onDocKeyDown);
      this.syncUi();
    }
  }

  unmount(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.compactRemeasureToken += 1;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.commonRailObserver?.disconnect();
    this.commonRailObserver = null;
    this.extraSlotObserver?.disconnect();
    this.extraSlotObserver = null;
    if (typeof window !== "undefined") {
      window.removeEventListener("molvis:theme-change", this.onHostThemeChange);
    }
    document.removeEventListener("pointerdown", this.onDocPointerDown, true);
    document.removeEventListener("keydown", this.onDocKeyDown);
    this.cancelFigureHold();
    this.closeFigureVariants();
    this.setToolSectionOpen(null);
    this.closeInlineTextEditor();
    this.imageExportDialog?.close();
    this.imageExportDialog = null;
    this.root.querySelector("dialog.msk-figure-dialog")?.remove();
    this.board.unmount();
    this.root.remove();
    this.container = null;
  }

  /**
   * Resolve full canvas theme from `--msk-*` tokens after mount.
   * Explicit `options.theme` fields always win over the host bridge.
   *
   * @param syncCustomDefault - set once on first mount so the color picker
   *   tracks `--msk-custom-default`; later theme changes leave the user's swatch.
   */
  private syncCanvasThemeFromHost(syncCustomDefault = false): void {
    this.board.setTheme({
      ...readCanvasThemeFromHost(this.root, DEFAULT_THEME),
      ...this.explicitTheme,
    });
    if (syncCustomDefault) {
      this.board.setCustomColor(readCustomDefaultFromHost(this.root));
    }
  }

  private observeStageSize(): void {
    const resize = () => {
      const { width, height } = this.stage.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      this.inlineTextEditor?.blur();
      this.board.resize(width, height);
      this.updateDrawingRail();
    };
    resize();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(resize);
      this.resizeObserver.observe(this.stage);
      if (this.chemBar) this.resizeObserver.observe(this.chemBar);
    }
  }

  setDisabled(disabled: boolean): void {
    this.board.setDisabled(disabled);
    if (disabled) {
      this.root
        .querySelector<HTMLDialogElement>("dialog.msk-figure-dialog")
        ?.close();
      this.imageExportDialog?.close();
    }
    this.root.dataset.disabled = disabled ? "true" : "false";
    this.syncUi();
  }

  setGui(gui: boolean): void {
    if (gui === this.gui) return;
    // Dynamic toggle would rebuild rails; keep mount-time only for v1.
    throw new Error(
      "SketchComposer gui is fixed at construction; remount with { gui } to change",
    );
  }

  getGui(): boolean {
    return this.gui;
  }

  private iconBtn(
    label: string,
    iconKey: string | null,
    onClick: () => void,
    opts?: { icon?: SVGSVGElement | HTMLElement; className?: string },
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = opts?.className ? `msk-btn ${opts.className}` : "msk-btn";
    btn.title = label;
    btn.setAttribute("aria-label", label);
    if (opts?.icon) {
      btn.appendChild(opts.icon);
    } else if (iconKey && ICONS[iconKey]) {
      btn.appendChild(ICONS[iconKey]());
    }
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    return btn;
  }

  private sep(parent: HTMLElement): void {
    const el = document.createElement("div");
    el.className = "msk-sep";
    el.setAttribute("role", "separator");
    parent.appendChild(el);
  }

  private buildCommonRail(): void {
    const bar = this.commonBar;
    if (!bar) return;

    // Wide: icon cluster. Narrow: hidden; actions live in the ⋯ menu.
    const inline = document.createElement("div");
    inline.className = "msk-common-inline";
    this.commonInline = inline;

    if (this.showHistoryActions) {
      inline.appendChild(this.iconBtn("Undo", "undo", () => this.board.undo()));
      inline.appendChild(this.iconBtn("Redo", "redo", () => this.board.redo()));
      this.sep(inline);
    }
    inline.appendChild(
      this.iconBtn("Clear", "clear", () => {
        this.board.clear();
      }),
    );
    this.sep(inline);

    const exportControl = document.createElement("div");
    exportControl.className = "msk-export";
    this.exportMenu = document.createElement("div");
    this.exportMenu.className = "msk-menu msk-icon-menu";
    this.exportMenu.hidden = true;
    this.exportMenu.setAttribute("role", "menu");
    this.exportMenu.setAttribute("aria-label", "Sketch file actions");

    this.exportButton = this.iconBtn("Sketch files", "file", () => {
      this.setCommonOverflowOpen(false);
      this.setExportMenuOpen(!!this.exportMenu?.hidden);
    });
    this.exportButton.setAttribute("aria-haspopup", "menu");
    this.exportButton.setAttribute("aria-expanded", "false");

    const fileActions = [
      {
        key: "open-document",
        label: "Open Sketch document…",
        icon: "folder",
        run: () => this.openSketchDocument(),
      },
      {
        key: "save-document",
        label: "Save Sketch document",
        icon: "save",
        run: () => this.saveSketchDocument(),
      },
      {
        key: "export-image",
        label: "Export image…",
        icon: "export",
        run: () => this.openImageExport(),
      },
    ];
    const runFileAction = async (
      run: () => void | Promise<void>,
    ): Promise<void> => {
      try {
        await run();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        window.alert(error instanceof Error ? error.message : String(error));
      }
    };
    for (const { key, label, icon, run } of fileActions) {
      const option = this.menuOption(label, icon, () => {
        this.setExportMenuOpen(false);
        void runFileAction(run);
      });
      option.dataset.commonAction = key;
      this.exportMenu.append(option);
    }
    exportControl.append(this.exportButton, this.exportMenu);
    inline.appendChild(exportControl);

    // Narrow: single ⋯ menu with the same actions.
    const overflow = document.createElement("div");
    overflow.className = "msk-common-overflow";

    this.commonOverflowMenu = document.createElement("div");
    this.commonOverflowMenu.className =
      "msk-menu msk-icon-menu msk-common-overflow-menu";
    this.commonOverflowMenu.hidden = true;
    this.commonOverflowMenu.setAttribute("role", "menu");
    this.commonOverflowMenu.setAttribute("aria-label", "Edit actions");

    const addOverflowItem = (
      label: string,
      iconKey: string,
      action: () => void,
      dataKey: string,
    ) => {
      const item = this.menuOption(label, iconKey, () => {
        this.setCommonOverflowOpen(false);
        action();
      });
      item.dataset.commonAction = dataKey;
      this.commonOverflowMenu?.appendChild(item);
    };
    if (this.showHistoryActions) {
      addOverflowItem("Undo", "undo", () => this.board.undo(), "undo");
      addOverflowItem("Redo", "redo", () => this.board.redo(), "redo");
    }
    addOverflowItem("Clear", "clear", () => this.board.clear(), "clear");
    for (const { key, label, icon, run } of fileActions)
      addOverflowItem(label, icon, () => void runFileAction(run), key);

    this.commonOverflowBtn = this.iconBtn("Edit actions", "more", () => {
      this.setExportMenuOpen(false);
      this.setCommonOverflowOpen(!!this.commonOverflowMenu?.hidden);
    });
    this.commonOverflowBtn.setAttribute("aria-haspopup", "menu");
    this.commonOverflowBtn.setAttribute("aria-expanded", "false");

    overflow.append(this.commonOverflowBtn, this.commonOverflowMenu);

    bar.append(inline, overflow, this.extraSlot);
  }

  private setCommonOverflowOpen(open: boolean): void {
    if (!this.commonOverflowMenu || !this.commonOverflowBtn) return;
    this.commonOverflowMenu.hidden = !open;
    this.commonOverflowBtn.setAttribute(
      "aria-expanded",
      open ? "true" : "false",
    );
    if (open) {
      this.syncFileActionsDisabled();
      // Pin menu under the ⋯ button in viewport coords (survives overflow:hidden).
      const r = this.commonOverflowBtn.getBoundingClientRect();
      const menu = this.commonOverflowMenu;
      menu.style.position = "fixed";
      menu.style.top = `${r.bottom + 3}px`;
      menu.style.left = `${Math.max(8, r.left)}px`;
      menu.style.right = "auto";
      menu.style.zIndex = "50";
    }
  }

  private syncFileActionsDisabled(): void {
    const state = this.board.getState();
    for (const item of this.root.querySelectorAll<HTMLButtonElement>(
      "[data-common-action]",
    )) {
      const key = item.dataset.commonAction ?? "";
      if (key === "undo") item.disabled = state.disabled || !state.canUndo;
      else if (key === "redo") item.disabled = state.disabled || !state.canRedo;
      else if (
        key === "clear" ||
        key === "save-document" ||
        key === "export-image"
      ) {
        item.disabled = state.disabled || !this.board.hasContent();
      } else {
        item.disabled = state.disabled;
      }
    }
  }

  /**
   * When the common rail is too narrow for the icon cluster, switch to a
   * single ⋯ dropdown. Host {@link extraSlot} always stays visible.
   *
   * Measurement rules that previously failed on first open in a narrow drawer:
   * - `avail > 0` was required → a 0-width pre-layout pass locked expanded.
   * - Only `commonBar` was observed → host portals into `extraSlot` after mount
   *   (pop-out / generate-3D) never remeasured, so icons stayed expanded and
   *   clipped instead of collapsing to ⋯.
   */
  private updateCommonCompact(): void {
    const bar = this.commonBar;
    const inline = this.commonInline;
    if (!bar || !inline) return;

    // Measure icon cluster while forced expanded so content width is honest.
    bar.dataset.compact = "false";
    // Force a layout read so offsetWidth reflects the expanded state.
    void bar.offsetWidth;

    // Prefer sum of children — more reliable than scrollWidth under
    // overflow:hidden ancestors that have not finished flex assignment.
    let need = 0;
    const kids = inline.children;
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i] as HTMLElement;
      need += el.offsetWidth || el.getBoundingClientRect().width;
    }
    if (kids.length > 1) {
      // Matches `.msk-common-inline { gap: 1px }`
      need += kids.length - 1;
    }
    if (need < 1) need = inline.scrollWidth;

    const barW = bar.clientWidth || bar.getBoundingClientRect().width;
    if (barW < 1) {
      // Host not laid out yet (accordion just opened / drawer animating).
      // Stay expanded for this frame and retry — do not lock a false "wide".
      this.scheduleCommonCompactRemeasure(6);
      return;
    }

    const extra = this.extraSlot.offsetWidth || 0;
    // Leave a small gutter so ⋯ does not fight the host extra cluster.
    const avail = barW - extra - 8;
    const compact = need > avail;
    bar.dataset.compact = compact ? "true" : "false";
    if (!compact) {
      this.setCommonOverflowOpen(false);
    }
  }

  /** Multi-rAF remeasure after mount / portal inject / reparent. */
  private scheduleCommonCompactRemeasure(frames = 4): void {
    const token = ++this.compactRemeasureToken;
    let left = frames;
    const tick = () => {
      if (token !== this.compactRemeasureToken) return;
      this.updateCommonCompact();
      if (--left > 0) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private observeCommonRailWidth(): void {
    if (!this.commonBar) return;

    this.commonRailObserver?.disconnect();
    this.extraSlotObserver?.disconnect();

    if (typeof ResizeObserver !== "undefined") {
      this.commonRailObserver = new ResizeObserver(() => {
        this.updateCommonCompact();
      });
      // Bar, root, and host slot — any of these can change usable width.
      this.commonRailObserver.observe(this.commonBar);
      this.commonRailObserver.observe(this.root);
      this.commonRailObserver.observe(this.extraSlot);
      if (this.container) {
        this.commonRailObserver.observe(this.container);
      }
    }

    // React portals into extraSlot after mount (pop-out, generate-3D) change
    // `extra` width without always resizing the bar — remeasure on DOM mutations.
    if (typeof MutationObserver !== "undefined") {
      this.extraSlotObserver = new MutationObserver(() => {
        this.scheduleCommonCompactRemeasure(3);
      });
      this.extraSlotObserver.observe(this.extraSlot, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }

    this.scheduleCommonCompactRemeasure(6);
  }

  private menuOption(
    label: string,
    iconKey: string,
    onSelect: () => void,
  ): HTMLButtonElement {
    const option = this.iconBtn(label, iconKey, onSelect);
    option.setAttribute("role", "menuitem");
    return option;
  }

  private setExportMenuOpen(open: boolean): void {
    if (!this.exportMenu || !this.exportButton) return;
    this.exportMenu.hidden = !open;
    this.exportButton.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      this.syncFileActionsDisabled();
      const anchor = this.exportButton.getBoundingClientRect();
      const menu = this.exportMenu;
      menu.style.top = `${anchor.bottom + 3}px`;
      menu.style.left = `${Math.max(4, Math.min(anchor.left, window.innerWidth - menu.offsetWidth - 4))}px`;
    }
  }

  private setFragmentMenuOpen(
    open: boolean,
    anchor = this.fragmentButton,
  ): void {
    if (
      !this.fragmentMenu ||
      !this.fragmentButton ||
      this.fragmentMenu.hidden === !open
    )
      return;
    this.fragmentMenu.hidden = !open;
    this.fragmentButton.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      this.positionDrawingMenu(
        this.fragmentMenu,
        anchor ?? this.fragmentButton,
      );
    } else {
      this.openSubmenuId = null;
      for (const fly of this.fragmentMenu.querySelectorAll<HTMLElement>(
        ".msk-menu--flyout",
      )) {
        fly.hidden = true;
      }
      for (const row of this.fragmentMenu.querySelectorAll<HTMLElement>(
        ".msk-category-row",
      )) {
        row.setAttribute("aria-expanded", "false");
      }
    }
  }

  private buildChemRail(): void {
    const bar = this.chemBar;
    if (!bar) return;

    const addSection = (label: string, icon: string) => {
      const group = document.createElement("div");
      group.className = "msk-tool-section";
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", label);
      const tools = document.createElement("div");
      tools.className = "msk-section-tools";
      const trigger = this.iconBtn(label, icon, () => {
        this.setToolSectionOpen(
          this.openToolSection === section ? null : section,
        );
      });
      trigger.classList.add("msk-section-trigger");
      trigger.setAttribute("aria-expanded", "false");
      trigger.hidden = true;
      const chevron = ICONS.chevron();
      chevron.classList.add("msk-section-chevron");
      trigger.append(chevron);
      const section = { group, tools, trigger, compact: false };
      tools.addEventListener("focusout", (event) => {
        if (
          this.openToolSection === section &&
          !group.contains(event.relatedTarget as Node | null) &&
          !this.figureVariantPopup?.menu.contains(
            event.relatedTarget as Node | null,
          )
        ) {
          this.setToolSectionOpen(null);
        }
      });
      tools.addEventListener("keydown", (event) => {
        if (section.compact) this.navigateToolMenu(event, tools);
      });
      group.append(trigger, tools);
      bar.append(group);
      this.toolSections.push(section);
      return tools;
    };

    const addTool = (
      target: HTMLElement,
      id: SketchTool,
      label: string,
      icon: string,
    ) => {
      const button = this.iconBtn(label, icon, () => {
        const fromMenu = this.openToolSection !== null;
        this.setToolSectionOpen(null);
        this.board.setTool(id);
        if (id === "ring") this.board.setRingTemplate(6, "benzene");
        if (id === "charge") this.board.setChargeDelta(1);
        if (id === "stereo") this.board.setStereoMode("up");
        if (fromMenu) this.canvas.focus({ preventScroll: true });
      });
      button.title = `${label}: ${TOOL_HELP[id]}`;
      target.append(button);
      this.toolButtons.set(id, button);
    };

    const view = addSection("View", "view");
    addTool(view, "select", "Select", "select");
    addTool(view, "pan", "Pan", "pan");
    const viewActions = [
      ["Fit", "fit", () => this.board.fitToView()],
      ["Zoom in", "zoomIn", () => this.board.zoomBy(1.25)],
      ["Zoom out", "zoomOut", () => this.board.zoomBy(0.8)],
    ] as const;
    this.viewButtons = this.showViewActions
      ? viewActions.map(([label, icon, run]) =>
          this.iconBtn(label, icon, () => {
            const fromMenu = this.openToolSection !== null;
            this.setToolSectionOpen(null);
            run();
            if (fromMenu) this.canvas.focus({ preventScroll: true });
          }),
        )
      : [];
    view.append(...this.viewButtons);

    const molecule = addSection("Molecule", "molecule");
    for (const { id, label, icon } of CHEM_TOOLS) {
      if (id === "fragment") this.buildFragmentControl(molecule);
      else addTool(molecule, id, label, icon);
    }

    const figure = addSection("Figure", "figure");
    for (const { kind, name } of FIGURE_TOOLS) {
      const button = this.iconBtn(name, kind, () =>
        this.selectFigureTool(kind),
      );
      const shortcut = FIGURE_SHORTCUTS[kind];
      if (shortcut) {
        button.title = `${name} (${shortcut.toUpperCase()})`;
        button.setAttribute("aria-keyshortcuts", shortcut.toUpperCase());
      }
      this.figureTools.set(kind, button);
      if (kind !== "text") this.bindFigureVariants(button, kind);
      figure.append(button);
    }
    addTool(figure, "erase", "Erase", "erase");
    this.figureLockButton = this.iconBtn(
      "Keep figure tool active",
      "lock",
      () => {
        const fromMenu = this.openToolSection !== null;
        this.setToolSectionOpen(null);
        this.board.setFigureToolLocked(!this.board.getState().figureToolLocked);
        if (fromMenu) this.canvas.focus({ preventScroll: true });
      },
    );
    this.figureLockButton.title = "Keep figure tool active (Q)";
    this.figureLockButton.setAttribute("aria-keyshortcuts", "Q");
    figure.append(this.figureLockButton);
  }

  private navigateToolMenu(event: KeyboardEvent, menu: HTMLElement): void {
    const buttons = [
      ...menu.querySelectorAll<HTMLButtonElement>("button:enabled"),
    ];
    if (!buttons.length) return;
    const focused = document.activeElement;
    const index =
      focused instanceof HTMLButtonElement ? buttons.indexOf(focused) : -1;
    const last = buttons.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        next = (index + 1) % buttons.length;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        next = index <= 0 ? last : index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    buttons[next].focus();
  }

  private currentFigureVariant(preset: SketchAnnotation): string {
    if (preset.kind === "bracket") return preset.variant;
    if (preset.kind === "rectangle")
      return preset.radius === 0 ? "sharp" : "rounded";
    return this.circleTool ? "circle" : "ellipse";
  }

  private syncFigureVariantButton(kind: SketchAnnotation["kind"]): void {
    if (kind === "text") return;
    const preset = this.figurePresets.get(kind);
    const button = this.figureTools.get(kind);
    if (!preset || !button) return;
    const variant = FIGURE_VARIANTS[kind].find(
      ({ id }) => id === this.currentFigureVariant(preset),
    );
    if (!variant || button.dataset.variant === variant.id) return;
    button.dataset.variant = variant.id;
    button.firstElementChild?.replaceWith(ICONS[variant.icon]());
    const shortcut = FIGURE_SHORTCUTS[kind]?.toUpperCase();
    button.title = `${variant.name}${shortcut ? ` (${shortcut})` : ""} · hold for variants`;
  }

  private bindFigureVariants(
    button: HTMLButtonElement,
    kind: FigureVariantKind,
  ): void {
    button.classList.add("msk-figure-variant-trigger");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    const shortcut = button.getAttribute("aria-keyshortcuts");
    button.setAttribute(
      "aria-keyshortcuts",
      shortcut ? `${shortcut} Alt+ArrowDown` : "Alt+ArrowDown",
    );
    const chevron = ICONS.chevron();
    chevron.classList.add("msk-figure-variant-chevron");
    button.append(chevron);
    this.syncFigureVariantButton(kind);

    button.addEventListener("pointerdown", (event) => {
      if (button.disabled || !event.isPrimary || event.button !== 0) return;
      this.cancelFigureHold();
      const timer = window.setTimeout(() => {
        this.figureHold = null;
        if (
          button.disabled ||
          !button.isConnected ||
          !button.getClientRects().length
        )
          return;
        this.suppressFigureClick = button;
        this.openFigureVariants(button, kind);
      }, FIGURE_HOLD_MS);
      this.figureHold = {
        button,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        timer,
      };
    });
    button.addEventListener("pointermove", (event) => {
      const hold = this.figureHold;
      if (
        hold?.button === button &&
        hold.pointerId === event.pointerId &&
        Math.hypot(event.clientX - hold.x, event.clientY - hold.y) >
          FIGURE_HOLD_SLOP_PX
      )
        this.cancelFigureHold();
    });
    for (const name of [
      "pointerup",
      "pointercancel",
      "pointerleave",
    ] as const) {
      button.addEventListener(name, (event) => {
        if (
          this.figureHold?.button === button &&
          this.figureHold.pointerId === event.pointerId
        )
          this.cancelFigureHold();
      });
    }
    button.addEventListener(
      "click",
      (event) => {
        if (this.consumeFigureHoldClick(event, button)) return;
        if (event.target instanceof Element && chevron.contains(event.target)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (this.figureVariantPopup?.button === button)
            this.closeFigureVariants();
          else this.openFigureVariants(button, kind);
        }
      },
      true,
    );
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (this.figureHold?.button === button) this.suppressFigureClick = button;
      this.openFigureVariants(button, kind);
    });
    button.addEventListener("keydown", (event) => {
      if (
        !(event.altKey && event.key === "ArrowDown") &&
        event.key !== "ContextMenu" &&
        !(event.shiftKey && event.key === "F10")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      this.openFigureVariants(button, kind);
    });
  }

  private consumeFigureHoldClick(
    event: MouseEvent,
    button: HTMLButtonElement,
  ): boolean {
    if (!event.detail || this.suppressFigureClick !== button) return false;
    this.suppressFigureClick = null;
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }

  private cancelFigureHold(): void {
    if (!this.figureHold) return;
    window.clearTimeout(this.figureHold.timer);
    this.figureHold = null;
  }

  private openFigureVariants(
    button: HTMLButtonElement,
    kind: FigureVariantKind,
  ): void {
    this.cancelFigureHold();
    const preset = this.figurePresets.get(kind);
    if (
      !preset ||
      button.disabled ||
      this.figureVariantPopup?.button === button
    )
      return;
    this.closeFigureVariants();
    this.setFragmentMenuOpen(false);
    const menu = document.createElement("div");
    menu.className = "msk-menu msk-icon-menu msk-figure-variant-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute(
      "aria-label",
      `${button.getAttribute("aria-label")} variants`,
    );
    const current = this.currentFigureVariant(preset);
    const choices = FIGURE_VARIANTS[kind].map(({ id, name, icon }) => {
      const option = this.menuOption(name, icon, () => {
        const previous = this.figurePresets.get(kind);
        if (!previous) return;
        if (previous.kind === "rectangle") {
          const radius = id === "sharp" ? 0 : previous.radius || undefined;
          this.figurePresets.set(kind, { ...previous, radius });
        } else if (previous.kind === "ellipse") {
          this.circleTool = id === "circle";
        } else if (previous.kind === "bracket") {
          this.figurePresets.set(kind, {
            ...previous,
            variant: id as BracketVariant,
          });
        }
        this.syncFigureVariantButton(kind);
        this.closeFigureVariants();
        this.selectFigureTool(kind);
      });
      option.setAttribute("role", "menuitemradio");
      option.setAttribute("aria-checked", String(id === current));
      return option;
    });
    menu.append(...choices);
    // A touch release can click a row where a popup now covers the held button.
    menu.addEventListener(
      "click",
      (event) => this.consumeFigureHoldClick(event, button),
      true,
    );
    menu.addEventListener("keydown", (event) =>
      this.navigateToolMenu(event, menu),
    );
    menu.addEventListener("focusout", (event) => {
      const target = event.relatedTarget as Node | null;
      if (!menu.contains(target) && !button.contains(target))
        this.closeFigureVariants();
    });
    this.figureVariantPopup = { button, menu };
    this.root.append(menu);
    button.setAttribute("aria-expanded", "true");
    this.positionFigureVariants();
    (
      choices.find(
        (choice) => choice.getAttribute("aria-checked") === "true",
      ) ?? choices[0]
    ).focus({ preventScroll: true });
  }

  private positionFigureVariants(): void {
    const popup = this.figureVariantPopup;
    if (!popup) return;
    const section = this.openToolSection;
    popup.menu.style.maxHeight = `${Math.max(0, this.root.clientHeight - 8)}px`;
    this.positionDrawingMenu(
      popup.menu,
      popup.button,
      section?.tools.getBoundingClientRect().right,
    );
  }

  private closeFigureVariants(): void {
    const popup = this.figureVariantPopup;
    if (!popup) return;
    this.figureVariantPopup = null;
    popup.button.setAttribute("aria-expanded", "false");
    popup.menu.remove();
  }

  private selectFigureTool(kind: SketchAnnotation["kind"]): void {
    const preset = this.figurePresets.get(kind);
    if (!preset) return;
    this.closeFigureVariants();
    this.setToolSectionOpen(null);
    this.figureKind = kind;
    this.board.setAnnotationTemplate(
      preset,
      kind === "ellipse" && this.circleTool,
    );
    this.renderedAssocTool = null;
    this.board.setTool("annotation");
    this.syncUi();
    this.canvas.focus({ preventScroll: true });
  }

  private handleFigureShortcut(event: KeyboardEvent): void {
    const state = this.board.getState();
    if (state.disabled || event.isComposing || event.altKey) return;
    const key = event.key.toLowerCase();
    const mod = isCtrlOrMeta(event);
    if (mod && key === "d" && state.selectedAnnotationCount) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.board.duplicateSelectedAnnotations();
      return;
    }
    if (event.ctrlKey || event.metaKey) return;
    const canUseShapeKeys =
      state.tool === "select" ||
      state.tool === "pan" ||
      state.tool === "annotation" ||
      state.tool === "erase";
    const kind = FIGURE_TOOLS.find(
      ({ kind }) => FIGURE_SHORTCUTS[kind] === key,
    )?.kind;
    if (kind && (canUseShapeKeys || kind === "text")) {
      this.selectFigureTool(kind);
    } else if (key === "v" || key === "e" || (key === "h" && canUseShapeKeys)) {
      this.board.setTool(
        key === "v" ? "select" : key === "e" ? "erase" : "pan",
      );
    } else if (key === "q") {
      this.board.setFigureToolLocked(!state.figureToolLocked);
    } else if (
      this.showViewActions &&
      (key === "!" || (key === "1" && event.shiftKey))
    ) {
      this.board.fitToView();
    } else if (key === "enter" && state.tool === "select") {
      const selected = this.board.getSelectedAnnotation();
      if (selected) {
        this.editAnnotationText(
          selected.item,
          selected.index,
          this.bracketCorner,
        );
      } else {
        const atoms = this.board.selectedAtomIndices();
        if (atoms.length !== 1 || state.selectedBondCount) return;
        this.editAtomText(atoms[0]);
      }
    } else {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  private updateDrawingRail(): void {
    const bar = this.chemBar;
    if (!bar?.clientHeight) return;
    const control = [
      ...bar.querySelectorAll<HTMLButtonElement>(".msk-btn"),
    ].find((button) => button.offsetHeight > 0);
    if (!control) return;
    const buttonHeight = control.offsetHeight;
    const style = getComputedStyle(bar);
    const metrics = this.toolSections.map((section) => {
      const gap =
        Number.parseFloat(getComputedStyle(section.tools).rowGap) || 0;
      const count = section.tools.childElementCount;
      const cost = (count - 1) * (buttonHeight + gap);
      const controlsHeight = section.compact
        ? section.trigger.offsetHeight
        : section.tools.offsetHeight;
      return {
        section,
        cost,
        collapsedHeight:
          section.group.offsetHeight - controlsHeight + buttonHeight,
      };
    });
    const padding =
      Number.parseFloat(style.paddingTop) +
      Number.parseFloat(style.paddingBottom);
    let free =
      bar.clientHeight -
      padding -
      metrics.reduce((height, item) => height + item.collapsedHeight, 0);
    const [view, molecule, figure] = metrics;
    // Expand molecular tools first, then navigation, then the figure tools.
    let canExpand = true;
    for (const { section, cost } of [molecule, view, figure]) {
      canExpand = canExpand && cost <= free;
      const compact = !canExpand;
      if (canExpand) free -= cost;
      if (section.compact === compact) continue;
      const focus = document.activeElement;
      const focusWasInSection = section.group.contains(focus);
      if (section.tools.contains(this.figureVariantPopup?.button ?? null))
        this.closeFigureVariants();
      if (this.openToolSection === section) this.setToolSectionOpen(null);
      if (section.tools.contains(this.fragmentButton))
        this.setFragmentMenuOpen(false);
      section.compact = compact;
      section.trigger.hidden = !compact;
      section.tools.classList.toggle("msk-menu", compact);
      section.tools.hidden = compact;
      if (!compact) section.tools.removeAttribute("style");
      if (focusWasInSection) {
        const next = compact
          ? section.trigger
          : (section.tools.querySelector<HTMLButtonElement>(
              ".active:enabled",
            ) ??
            section.tools.querySelector<HTMLButtonElement>("button:enabled"));
        next?.focus({ preventScroll: true });
      }
    }
    if (this.openToolSection) this.positionSectionMenu(this.openToolSection);
    this.positionFigureVariants();
  }

  private setToolSectionOpen(section: DrawingToolSection | null): void {
    if (
      this.openToolSection === section ||
      (section && (!section.compact || section.trigger.disabled))
    )
      return;
    const previous = this.openToolSection;
    this.openToolSection = section;
    if (previous) {
      if (previous.tools.contains(this.figureVariantPopup?.button ?? null))
        this.closeFigureVariants();
      previous.tools.hidden = true;
      previous.trigger.setAttribute("aria-expanded", "false");
    }
    if (!section) return;
    this.setExportMenuOpen(false);
    this.setCommonOverflowOpen(false);
    this.setFragmentMenuOpen(false);
    section.tools.hidden = false;
    section.trigger.setAttribute("aria-expanded", "true");
    this.positionSectionMenu(section);
    const option =
      section.tools.querySelector<HTMLButtonElement>(".active:enabled") ??
      section.tools.querySelector<HTMLButtonElement>("button:enabled");
    option?.focus({ preventScroll: true });
  }

  private positionSectionMenu(section: DrawingToolSection): void {
    section.tools.style.maxHeight = `${Math.max(0, this.root.clientHeight - 8)}px`;
    this.positionDrawingMenu(section.tools, section.trigger);
  }

  private positionDrawingMenu(
    menu: HTMLElement,
    anchor: HTMLElement,
    beside?: number,
  ): void {
    // Menus are siblings of the scrolling toolbar. Keep them inside the editor.
    const frame = this.root.getBoundingClientRect();
    const button = anchor.getBoundingClientRect();
    const gap = 4;
    const railRight =
      this.chemBar?.getBoundingClientRect().right ?? button.right;
    const edge =
      beside !== undefined && frame.right - beside >= menu.offsetWidth + gap * 2
        ? beside
        : railRight;
    const left = edge - frame.left - this.root.clientLeft + gap;
    menu.style.left = `${left}px`;
    menu.style.maxWidth = `${Math.max(0, this.root.clientWidth - left - gap)}px`;
    const top = Math.min(
      button.top - frame.top - this.root.clientTop,
      this.root.clientHeight - menu.offsetHeight - gap,
    );
    menu.style.top = `${Math.max(gap, top)}px`;
  }

  private buildFragmentControl(bar: HTMLElement): void {
    this.fragmentButton = this.iconBtn("Fragment templates", "fragment", () => {
      this.setFragmentMenuOpen(!!this.fragmentMenu?.hidden);
      if (this.fragmentMenu?.hidden === false) this.setToolSectionOpen(null);
    });
    this.fragmentButton.title = `Fragments: ${TOOL_HELP.fragment}`;
    this.fragmentButton.setAttribute("aria-haspopup", "menu");
    this.fragmentButton.setAttribute("aria-expanded", "false");
    this.toolButtons.set("fragment", this.fragmentButton);

    this.fragmentMenu = document.createElement("div");
    this.fragmentMenu.className = "msk-menu msk-fragment-menu";
    this.fragmentMenu.hidden = true;
    this.fragmentMenu.setAttribute("role", "menu");
    this.fragmentMenu.setAttribute("aria-label", "Fragment templates");

    for (const category of listFragmentCategories()) {
      const rowWrap = document.createElement("div");
      rowWrap.className = "msk-submenu";

      const row = document.createElement("button");
      row.type = "button";
      row.className = "msk-category-row";
      row.setAttribute("aria-label", category.label);
      row.setAttribute("aria-haspopup", "menu");
      row.setAttribute("aria-expanded", "false");
      row.title = category.label;

      // Structure-only category cue — name lives in aria-label / title, not chrome text.
      const lead = category.templates[0];
      if (lead) {
        const preview = document.createElement("span");
        preview.className = "msk-category-preview";
        preview.setAttribute("aria-hidden", "true");
        preview.appendChild(
          parseSvgMarkup(
            fragmentPreviewSvg(lead, { width: 32, height: 32, padding: 2 }),
          ),
        );
        row.appendChild(preview);
      }
      const chevron = ICONS.chevron();
      chevron.classList.add("msk-chevron");
      chevron.setAttribute("aria-hidden", "true");
      row.appendChild(chevron);

      const flyout = document.createElement("div");
      flyout.className = "msk-menu msk-menu--flyout";
      flyout.hidden = true;
      flyout.setAttribute("role", "menu");
      flyout.setAttribute("aria-label", category.label);

      for (const template of category.templates) {
        flyout.appendChild(this.fragmentPreviewButton(template));
      }

      row.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const open = this.openSubmenuId !== category.id;
        this.openSubmenuId = open ? category.id : null;
        const menu = this.fragmentMenu;
        if (!menu) return;
        for (const other of menu.querySelectorAll<HTMLElement>(
          ".msk-menu--flyout",
        )) {
          other.hidden = true;
        }
        for (const otherRow of menu.querySelectorAll<HTMLElement>(
          ".msk-category-row",
        )) {
          otherRow.setAttribute("aria-expanded", "false");
        }
        flyout.hidden = !open;
        row.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) {
          // Fixed-position flyout next to the row (survives chem rail scroll).
          const r = row.getBoundingClientRect();
          const gap = 4;
          const maxW = Math.min(window.innerWidth * 0.9, 320);
          let left = r.right + gap;
          if (left + maxW > window.innerWidth - 8) {
            left = Math.max(8, r.left - maxW - gap);
          }
          const maxH = Math.min(window.innerHeight * 0.7, 420);
          let top = r.top;
          if (top + maxH > window.innerHeight - 8) {
            top = Math.max(8, window.innerHeight - maxH - 8);
          }
          flyout.style.top = `${top}px`;
          flyout.style.left = `${left}px`;
        }
      });
      row.addEventListener("pointerdown", (e) => e.stopPropagation());

      rowWrap.append(row, flyout);
      this.fragmentMenu.appendChild(rowWrap);
    }

    bar.append(this.fragmentButton);
    this.root.append(this.fragmentMenu);
  }

  private fragmentPreviewButton(template: FragmentTemplate): HTMLButtonElement {
    const svg = parseSvgMarkup(
      fragmentPreviewSvg(template, { width: 48, height: 48, padding: 4 }),
    );
    const btn = this.iconBtn(
      template.label,
      null,
      () => {
        this.board.setFragmentTemplate(template.id);
        this.board.setTool("fragment");
        this.setFragmentMenuOpen(false);
      },
      { icon: svg, className: "msk-btn--preview" },
    );
    btn.setAttribute("role", "menuitem");
    // Structure diagram only — label is aria/title, not visible text.
    btn.title = template.label;
    return btn;
  }

  private rebuildAssoc(): void {
    const bar = this.assocBar;
    if (!bar) return;
    bar.replaceChildren();
    this.elementPicker = null;
    this.orderButtons.clear();

    const tool = this.board.getTool();
    const state = this.board.getState();
    const disabled = state.disabled;
    if (tool === "pan") return;

    if (tool === "atom") {
      const current = this.board.getElement();
      for (const symbol of COMMON_ELEMENTS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "msk-btn msk-element-chip";
        btn.textContent = symbol;
        const label =
          symbol === "*" ? "Attachment point (*)" : `Element ${symbol}`;
        btn.title = label;
        btn.setAttribute("aria-label", label);
        btn.dataset.element = symbol;
        btn.disabled = disabled;
        const selected = current === symbol;
        btn.classList.toggle("active", selected);
        btn.setAttribute("aria-pressed", selected ? "true" : "false");
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.board.setElement(symbol);
          this.board.setTool("atom");
          this.syncUi();
        });
        btn.addEventListener("pointerdown", (e) => e.stopPropagation());
        bar.appendChild(btn);
      }
      this.sep(bar);
      // Full periodic table for less-common elements.
      const picker = document.createElement(
        "molvis-element-picker",
      ) as MolvisElementPickerElement;
      picker.setAttribute("compact", "");
      picker.value = current;
      picker.disabled = disabled;
      picker.title = "More elements";
      picker.setAttribute("aria-label", "More elements");
      picker.addEventListener("input", () => {
        this.board.setElement(picker.value);
        this.board.setTool("atom");
        this.syncUi();
      });
      bar.appendChild(picker);
      this.elementPicker = picker;
    }

    if (tool === "bond") {
      for (const o of [1, 2, 3] as const) {
        const btn = this.iconBtn(
          `Bond order ${o}`,
          null,
          () => {
            this.board.setBondOrder(o);
          },
          { icon: bondOrderIcon(o) },
        );
        btn.disabled = disabled;
        bar.appendChild(btn);
        this.orderButtons.set(o, btn);
      }
    }

    if (tool === "ring") {
      for (const size of [3, 4, 5, 6, 7, 8] as const) {
        const btn = this.iconBtn(
          `${size}-membered ring`,
          null,
          () => {
            this.board.setRingTemplate(size, "aliphatic");
            this.board.setTool("ring");
          },
          { icon: ringSizeIcon(size) },
        );
        btn.disabled = disabled;
        const selected =
          state.ringKind === "aliphatic" && state.ringSize === size;
        btn.classList.toggle("active", selected);
        btn.setAttribute("aria-pressed", selected ? "true" : "false");
        bar.appendChild(btn);
      }
      const bz = this.iconBtn(
        "Benzene",
        null,
        () => {
          this.board.setRingTemplate(6, "benzene");
          this.board.setTool("ring");
        },
        { icon: ringSizeIcon(6, true) },
      );
      bz.disabled = disabled;
      const benzeneSelected =
        state.ringKind === "benzene" && state.ringSize === 6;
      bz.classList.toggle("active", benzeneSelected);
      bz.setAttribute("aria-pressed", benzeneSelected ? "true" : "false");
      bar.appendChild(bz);
    }

    if (tool === "fragment") {
      // Show selected fragment structure in context rail (structure only).
      const template = this.board.getFragmentTemplate();
      const preview = this.iconBtn(
        template.label,
        null,
        () => {
          this.setFragmentMenuOpen(true, preview);
        },
        {
          icon: parseSvgMarkup(
            fragmentPreviewSvg(template, {
              width: 48,
              height: 48,
              padding: 4,
            }),
          ),
          className: "msk-btn--preview",
        },
      );
      preview.disabled = disabled;
      preview.classList.add("active");
      bar.appendChild(preview);
    }

    if (tool === "charge") {
      for (const delta of [-1, 1] as const) {
        const btn = this.iconBtn(
          delta < 0 ? "Decrease formal charge" : "Increase formal charge",
          null,
          () => {
            this.board.setChargeDelta(delta);
            this.board.setTool("charge");
          },
          { icon: chargeDeltaIcon(delta) },
        );
        btn.disabled = disabled;
        const selected = state.chargeDelta === delta;
        btn.classList.toggle("active", selected);
        btn.setAttribute("aria-pressed", selected ? "true" : "false");
        bar.appendChild(btn);
      }
    }

    if (tool === "stereo") {
      for (const mode of ["up", "down", "none"] as const) {
        const btn = this.iconBtn(
          mode === "up"
            ? "Solid wedge"
            : mode === "down"
              ? "Hashed wedge"
              : "Clear stereochemistry",
          null,
          () => {
            this.board.setStereoMode(mode);
            this.board.setTool("stereo");
          },
          { icon: stereoModeIcon(mode) },
        );
        btn.disabled = disabled;
        const selected = state.stereoMode === mode;
        btn.classList.toggle("active", selected);
        btn.setAttribute("aria-pressed", selected ? "true" : "false");
        bar.appendChild(btn);
      }
    }

    if (tool === "annotation") {
      const preset = this.figurePresets.get(this.figureKind);
      if (preset) {
        this.buildFigureStyleControls(bar, preset, disabled, (item) => {
          this.board.setAnnotationTemplate(
            item,
            item.kind === "ellipse" && this.circleTool,
          );
          this.figurePresets.set(item.kind, item);
          this.syncFigureVariantButton(item.kind);
          this.rebuildAssoc();
        });
      }
      return;
    }

    if (tool === "select" && state.selectedAnnotationCount > 0) {
      const selection = this.board.getSelectedAnnotation();
      if (selection) {
        this.buildFigureStyleControls(
          bar,
          selection.item,
          disabled,
          (item) => {
            this.board.updateAnnotation(selection.index, item);
          },
          selection.index,
        );
      }
      const duplicate = this.iconBtn(
        "Duplicate figure objects",
        "duplicate",
        () => this.board.duplicateSelectedAnnotations(),
      );
      const lower = this.iconBtn("Send figure objects to back", "lower", () =>
        this.board.sendSelectedAnnotationsToBack(),
      );
      duplicate.disabled = lower.disabled = disabled;
      bar.append(duplicate, lower);
      if (!state.selectedAtomCount && !state.selectedBondCount) return;
    }

    const colorControls = document.createElement("div");
    colorControls.className = "msk-assoc-color-controls";
    if (bar.childElementCount > 0) this.sep(colorControls);

    const colorToggle = this.iconBtn("Color override", "color", () => {
      const next = !state.colorOverrideEnabled;
      this.board.setColorOverrideEnabled(next);
      if (state.selectedAtomCount + state.selectedBondCount > 0) {
        this.board.applyColorToSelection(next ? state.customColor : null);
      }
      this.renderedAssocTool = null;
      this.syncUi();
    });
    colorToggle.title = state.colorOverrideEnabled
      ? "Color override on: use default colors"
      : "Color override off: override new and selected content";
    colorToggle.disabled = disabled;
    colorToggle.classList.toggle("active", state.colorOverrideEnabled);
    colorToggle.setAttribute(
      "aria-pressed",
      state.colorOverrideEnabled ? "true" : "false",
    );
    colorControls.appendChild(colorToggle);

    const colorInput = document.createElement("input");
    colorInput.className = "msk-assoc-color";
    colorInput.type = "color";
    colorInput.title = "Choose override color";
    colorInput.setAttribute("aria-label", "Choose override color");
    colorInput.value = state.customColor;
    colorInput.disabled = disabled || !state.colorOverrideEnabled;
    colorInput.addEventListener("input", () => {
      this.board.setCustomColor(colorInput.value);
      if (
        state.colorOverrideEnabled &&
        state.selectedAtomCount + state.selectedBondCount > 0
      ) {
        this.board.applyColorToSelection(colorInput.value);
      }
    });
    colorControls.appendChild(colorInput);
    bar.appendChild(colorControls);
  }

  private buildFigureStyleControls(
    bar: HTMLElement,
    item: SketchAnnotation,
    disabled: boolean,
    apply: (item: SketchAnnotation) => void,
    index?: number,
  ): void {
    const theme = this.board.renderer.getTheme();
    const group = document.createElement("div");
    group.className = "msk-figure-style";
    const control = (label: string, icon: string, input: HTMLInputElement) => {
      input.disabled = disabled;
      input.title = label;
      input.setAttribute("aria-label", label);
      const row = document.createElement("label");
      row.title = label;
      row.append(ICONS[icon](), input);
      group.append(row);
    };
    const color = (
      label: string,
      icon: string,
      value: string,
      update: (value: string) => SketchAnnotation,
    ) => {
      const input = document.createElement("input");
      input.type = "color";
      input.value = value;
      if (index !== undefined) {
        input.addEventListener("input", () =>
          this.board.setAnnotationDraft({ index, item: update(input.value) }),
        );
        input.addEventListener("blur", () =>
          this.board.setAnnotationDraft(null),
        );
      }
      input.addEventListener("change", () => {
        this.board.setAnnotationDraft(null);
        apply(update(input.value));
      });
      control(label, icon, input);
    };
    const number = (
      label: string,
      icon: string,
      value: number,
      minimum: number,
      update: (value: number) => SketchAnnotation,
    ) => {
      const input = document.createElement("input");
      input.type = "number";
      input.step = "0.05";
      input.min = String(minimum);
      input.value = String(Number(value.toFixed(3)));
      input.addEventListener("change", () => {
        const next = input.valueAsNumber;
        if (Number.isFinite(next) && next >= minimum) apply(update(next));
        else input.value = String(Number(value.toFixed(3)));
      });
      control(label, icon, input);
    };
    if (item.kind !== "text") {
      color(
        "Stroke color",
        "strokeColor",
        item.stroke ?? cssColorToHex(theme.bondStroke) ?? "#151515",
        (stroke) => ({ ...item, stroke }),
      );
      number(
        "Stroke width",
        "strokeWidth",
        item.strokeWidth ?? DEFAULT_ANNOTATION_STROKE,
        0,
        (strokeWidth) => ({ ...item, strokeWidth }),
      );
      if (index !== undefined) {
        const rotate = this.iconBtn(
          "Rotate 90° clockwise",
          "rotate",
          () => {
            apply({ ...item, rotation: (item.rotation ?? 0) + 90 });
            bar
              .querySelector<HTMLButtonElement>(".msk-rotate-shape")
              ?.focus({ preventScroll: true });
          },
          { className: "msk-rotate-shape" },
        );
        rotate.disabled = disabled;
        group.append(rotate);
      }
    }
    if (item.kind === "rectangle" || item.kind === "ellipse") {
      const fill = item.fill ?? "#e6e6e6";
      color("Fill color", "fillColor", fill, (fill) => ({ ...item, fill }));
      const toggle = this.iconBtn("Shape fill", "fill", () =>
        apply({ ...item, fill: item.fill ? undefined : fill }),
      );
      toggle.title = item.fill ? "Remove fill" : "Add fill";
      toggle.classList.toggle("active", !!item.fill);
      toggle.setAttribute("aria-pressed", String(!!item.fill));
      toggle.disabled = disabled;
      group.append(toggle);
    }
    if (item.kind === "bracket" && index !== undefined) {
      const variants = document.createElement("div");
      variants.className = "msk-figure-choices";
      variants.setAttribute("role", "group");
      variants.setAttribute("aria-label", "Brackets");
      for (const { id, name, icon } of BRACKET_CHOICES) {
        const selected = item.variant === id;
        const button = this.iconBtn(name, icon, () => {
          if (!selected) {
            apply({ ...item, variant: id });
            this.root
              .querySelector<HTMLButtonElement>(
                '.msk-figure-choices [aria-pressed="true"]',
              )
              ?.focus({ preventScroll: true });
          }
        });
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
        button.disabled = disabled;
        variants.append(button);
      }
      group.append(variants);
    }
    const label = annotationLabel(item, this.bracketCorner);
    if (label) {
      color(
        "Text color",
        "textColor",
        label.color ?? cssColorToHex(theme.labelFill) ?? "#151515",
        (color) =>
          withAnnotationLabel(item, { ...label, color }, this.bracketCorner),
      );
      number("Font size", "fontSize", label.size, 0.01, (size) =>
        withAnnotationLabel(item, { ...label, size }, this.bracketCorner),
      );
    }
    const properties = this.iconBtn("More figure properties", "more", () => {
      showAnnotationDialog(
        this.root,
        item,
        index !== undefined,
        theme,
        apply,
        this.bracketCorner,
      );
    });
    properties.disabled = disabled;
    group.append(properties);
    bar.append(group);
  }

  private positionBracketCorners(): void {
    if (!this.bracketCornerButtons.size) return;
    const state = this.board.getState();
    const selected =
      !state.disabled &&
      state.tool === "select" &&
      !state.selectedAtomCount &&
      !state.selectedBondCount
        ? this.board.getSelectedAnnotation()?.item
        : undefined;
    const context = this.canvas.getContext("2d");
    for (const [corner, button] of this.bracketCornerButtons) {
      if (
        selected?.kind !== "bracket" ||
        !context ||
        (this.inlineTextEditor && corner === this.bracketCorner)
      ) {
        button.hidden = true;
        continue;
      }
      const label = annotationLabel(selected, corner);
      const filled = Boolean(label?.text.trim());
      const text = annotationText(selected, corner, {
        ...DEFAULT_BRACKET_LABEL,
        ...label,
        text: filled ? (label?.text ?? "") : " ",
      });
      if (!text) continue;
      const { x, y, textWidth, height } = this.annotationTextMetrics(
        context,
        text,
      );
      const width = Math.max(20, textWidth);
      const left = text.align === "right" ? x - width : x;
      const offset = filled ? 0 : text.align === "right" ? -7 : 7;
      const cornerHeight = Math.max(20, height);
      const verticalOffset = filled ? 0 : text.y >= selected.y ? -5 : 5;
      button.style.left = `${left + offset}px`;
      button.style.top = `${y + verticalOffset - cornerHeight / 2}px`;
      button.style.width = `${width}px`;
      button.style.height = `${cornerHeight}px`;
      button.classList.toggle("msk-bracket-label--filled", filled);
      button.hidden = false;
    }
  }

  private annotationTextMetrics(
    context: CanvasRenderingContext2D,
    text: NonNullable<ReturnType<typeof annotationText>>,
  ) {
    const viewport = this.board.viewport;
    const scale = viewport.getScale();
    const anchor = viewport.docToScreen(text.x, text.y);
    const { font, width: textWidth } = measureAnnotationText(
      context,
      text,
      scale,
    );
    const lineHeight = text.step * scale;
    return {
      ...anchor,
      font,
      textWidth,
      lineHeight,
      height: text.lines.length * lineHeight,
    };
  }

  private editAnnotationText(
    item: SketchAnnotation,
    index?: number,
    corner: AnnotationCorner = "bottomRight",
  ): void {
    if (this.board.getState().disabled || this.inlineTextEditor) return;
    const context = this.canvas.getContext("2d");
    if (!context) return;
    if (item.kind === "bracket") this.bracketCorner = corner;
    const initial = {
      ...(item.kind === "bracket"
        ? DEFAULT_BRACKET_LABEL
        : DEFAULT_TEXT_ANNOTATION.label),
      text: "",
      ...annotationLabel(item, corner),
    };
    const original = initial.text;
    const updatePreview = (editor: HTMLTextAreaElement) => {
      const label = { ...initial, text: editor.value };
      const text = annotationText(item, corner, {
        ...label,
        text: label.text || " ",
      });
      if (!text) return;
      const { x, y, font, textWidth, lineHeight, height } =
        this.annotationTextMetrics(context, text);
      const width = Math.ceil(
        textWidth + Math.max(2, label.size * this.board.viewport.getScale()),
      );
      const offset =
        text.align === "center"
          ? width / 2
          : text.align === "right"
            ? width - 1
            : 1;
      editor.style.font = font;
      editor.style.lineHeight = `${lineHeight}px`;
      editor.style.caretColor =
        label.color ?? this.board.renderer.getTheme().labelFill;
      editor.style.textAlign = text.align;
      editor.style.left = `${x - offset}px`;
      editor.style.top = `${y - height / 2}px`;
      editor.style.width = `${width}px`;
      editor.style.height = `${height}px`;
      this.board.setAnnotationDraft({
        index,
        item: withAnnotationLabel(item, label, corner),
      });
    };

    const commit = (value: string) => {
      const label = { ...initial, text: value };
      if (index === undefined) {
        if (item.kind === "text" && label.text.trim())
          this.board.placeAnnotation({ ...item, label });
        else if (
          this.board.getTool() === "annotation" &&
          !this.board.getState().figureToolLocked
        )
          this.board.setTool("select");
      } else if (label.text !== original) {
        if (item.kind === "text") {
          if (label.text.trim())
            this.board.updateAnnotation(index, { ...item, label });
          else this.board.removeAnnotation(index);
        } else {
          this.board.updateAnnotation(
            index,
            withAnnotationLabel(item, label, corner),
          );
        }
      }
    };
    this.openInlineTextEditor({
      accessibleName:
        item.kind === "bracket"
          ? `${CORNER_NAMES[corner]} label`
          : "Figure text",
      original,
      multiline: true,
      updatePreview,
      commit,
    });
  }

  private editAtomText(index: number): void {
    const context = this.canvas.getContext("2d");
    if (!context) return;
    const atom = this.board.graph.getAtom(index);
    const original = atom.label ?? atom.element;
    const viewport = this.board.viewport;
    const { x, y } = viewport.docToScreen(atom.x, atom.y);
    const ink = depictionInk(viewport.getScale());
    const font = `${ink.labelWeight} ${ink.fontPx}px ${ink.fontFamily}`;
    const lineHeight = ink.fontPx * 1.25;
    this.openInlineTextEditor({
      accessibleName: "Atom label",
      original,
      multiline: false,
      updatePreview: (editor) => {
        context.save();
        context.font = font;
        const width = Math.ceil(
          context.measureText(editor.value).width + ink.fontPx,
        );
        context.restore();
        editor.style.font = font;
        editor.style.lineHeight = `${lineHeight}px`;
        editor.style.caretColor = atom.color ?? colorForElement(atom.element);
        editor.style.textAlign = "center";
        editor.style.left = `${x - width / 2}px`;
        editor.style.top = `${y + ink.baselineNudgePx - lineHeight / 2}px`;
        editor.style.width = `${width}px`;
        editor.style.height = `${lineHeight}px`;
        this.board.setAtomLabelDraft({ index, text: editor.value });
      },
      commit: (value) => this.board.updateAtomLabel(index, value),
    });
  }

  private openInlineTextEditor({
    accessibleName,
    original,
    multiline,
    updatePreview,
    commit,
  }: {
    accessibleName: string;
    original: string;
    multiline: boolean;
    updatePreview: (editor: HTMLTextAreaElement) => void;
    commit: (value: string) => void;
  }): void {
    if (this.board.getState().disabled || this.inlineTextEditor) return;
    const editor = document.createElement("textarea");
    editor.className = "msk-inline-text-editor";
    editor.setAttribute("aria-label", accessibleName);
    editor.value = original;
    editor.wrap = "off";
    editor.spellcheck = false;
    this.stage.append(editor);
    this.inlineTextEditor = editor;

    const finish = (save: boolean) => {
      if (this.inlineTextEditor !== editor) return;
      this.closeInlineTextEditor();
      if (save) commit(editor.value);
    };
    editor.addEventListener("keydown", (event) => {
      const submit =
        event.key === "Enter" && (!multiline || isCtrlOrMeta(event));
      if (event.isComposing || (!submit && event.key !== "Escape")) return;
      event.preventDefault();
      event.stopPropagation();
      finish(submit || multiline);
      this.canvas.focus({ preventScroll: true });
    });
    editor.addEventListener("blur", () => finish(true), { once: true });
    editor.addEventListener("input", () => {
      if (!multiline) editor.value = editor.value.replace(/[\r\n]+/g, " ");
      updatePreview(editor);
    });
    updatePreview(editor);
    editor.focus({ preventScroll: true });
    editor.select();
  }

  private closeInlineTextEditor(): void {
    const editor = this.inlineTextEditor;
    if (!editor) return;
    this.inlineTextEditor = null;
    this.board.setAnnotationDraft(null);
    this.board.setAtomLabelDraft(null);
    editor.remove();
  }

  private syncUi(): void {
    if (!this.gui) return;
    this.closeInlineTextEditor();
    const state = this.board.getState();
    const current = state.tool;

    for (const [id, btn] of this.toolButtons) {
      btn.classList.toggle("active", id === current);
      btn.setAttribute("aria-pressed", id === current ? "true" : "false");
      btn.disabled = state.disabled;
    }

    for (const button of this.viewButtons)
      button.disabled = state.disabled || !this.board.hasContent();

    for (const [kind, button] of this.figureTools) {
      const active = current === "annotation" && kind === this.figureKind;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.disabled = state.disabled;
    }
    if (this.figureLockButton) {
      this.figureLockButton.disabled = state.disabled;
      this.figureLockButton.classList.toggle("active", state.figureToolLocked);
      this.figureLockButton.setAttribute(
        "aria-pressed",
        String(state.figureToolLocked),
      );
    }
    if (state.disabled) {
      this.cancelFigureHold();
      this.closeFigureVariants();
      this.setToolSectionOpen(null);
    }
    for (const section of this.toolSections) {
      section.trigger.disabled = state.disabled;
      section.trigger.classList.toggle(
        "active",
        section.tools.querySelector(".active") !== null,
      );
    }

    if (
      this.renderedAssocTool !== current ||
      this.renderedDisabled !== state.disabled ||
      (current === "select" &&
        this.renderedAnnotationSelection !== state.selectedAnnotationCount)
    ) {
      this.rebuildAssoc();
      this.renderedAssocTool = current;
      this.renderedAnnotationSelection = state.selectedAnnotationCount;
      this.renderedDisabled = state.disabled;
    } else if (
      (current === "select" && state.selectedAnnotationCount === 1) ||
      current === "ring" ||
      current === "fragment" ||
      current === "charge" ||
      current === "stereo"
    ) {
      // Refresh selection highlights without full rebuild when cheap.
      this.rebuildAssoc();
    }

    if (this.elementPicker) {
      this.elementPicker.value = this.board.getElement();
      this.elementPicker.disabled = state.disabled;
    }
    // Atom-tool quick chips (keyboard element shortcuts update these).
    if (this.assocBar && this.board.getTool() === "atom") {
      const el = this.board.getElement();
      for (const btn of this.assocBar.querySelectorAll<HTMLButtonElement>(
        ".msk-element-chip",
      )) {
        const selected = btn.dataset.element === el;
        btn.classList.toggle("active", selected);
        btn.setAttribute("aria-pressed", selected ? "true" : "false");
        btn.disabled = state.disabled;
      }
    }
    const order = this.board.getBondOrder();
    for (const [o, btn] of this.orderButtons) {
      btn.classList.toggle("active", o === order);
      btn.disabled = state.disabled;
    }

    // Common rail: undo, redo, clear and file actions.
    if (this.commonInline) {
      const buttons = this.commonInline.querySelectorAll<HTMLButtonElement>(
        ":scope > .msk-btn, :scope > .msk-export > .msk-btn",
      );
      for (const btn of buttons) {
        const label = btn.getAttribute("aria-label") ?? "";
        if (label === "Undo") btn.disabled = state.disabled || !state.canUndo;
        else if (label === "Redo")
          btn.disabled = state.disabled || !state.canRedo;
        else if (label === "Clear") {
          btn.disabled = state.disabled || !this.board.hasContent();
        } else {
          btn.disabled = state.disabled;
        }
      }
    }
    if (this.commonOverflowBtn) {
      this.commonOverflowBtn.disabled = state.disabled;
    }
    if (
      this.commonOverflowMenu?.hidden === false ||
      this.exportMenu?.hidden === false
    ) {
      this.syncFileActionsDisabled();
    }
  }

  /** The canvas host, for a notice a preview host lays over the board. */
  get stageElement(): HTMLElement {
    return this.stage;
  }

  /** Atom and bond counts on the board. */
  counts(): { atoms: number; bonds: number } {
    const { atoms, bonds } = this.board.getMoleculeData();
    return { atoms: atoms.length, bonds: bonds.length };
  }

  /** Preview and crop an image of the full drawing before saving it. */
  openImageExport(filename = "molvis-sketch.png"): void {
    if (
      !this.container ||
      this.imageExportDialog?.open ||
      !this.board.hasContent() ||
      this.board.getState().disabled
    )
      return;
    this.imageExportDialog = showImageExportDialog(this.root, {
      filename,
      autoCrop: true,
      transparent: false,
      capture: () => ({
        kind: "svg",
        markup: this.board.toSvg({ background: "transparent" }),
      }),
      save: this.onExportFile,
    });
  }

  /** Save the board as `filename` (the host's file sink, else a download). Empty boards save nothing. */
  async exportImage(
    format: "svg" | "png",
    filename = `molvis-sketch.${format}`,
  ): Promise<void> {
    if (!this.board.hasContent()) return;
    const blob =
      format === "svg"
        ? new Blob([this.board.toSvg()], {
            type: "image/svg+xml;charset=utf-8",
          })
        : await this.board.toPng();
    await this.saveFile(blob, filename);
  }

  private async saveSketchDocument(): Promise<void> {
    const blob = new Blob(
      [`${JSON.stringify(this.board.getSketchDocument(), null, 2)}\n`],
      { type: "application/json" },
    );
    await this.saveFile(blob, "drawing.molvis-sketch.json");
  }

  private openSketchDocument(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener(
      "change",
      async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const data = JSON.parse(await file.text()) as SketchDocument;
          if (!this.container || this.board.getState().disabled) return;
          this.board.updateSketchDocument(data);
          this.board.fitToView();
        } catch (error) {
          window.alert(
            error instanceof Error
              ? `Could not open Sketch document. ${error.message}`
              : "Could not open Sketch document.",
          );
        }
      },
      { once: true },
    );
    input.click();
  }

  private async saveFile(blob: Blob, filename: string): Promise<void> {
    if (this.onExportFile) await this.onExportFile(blob, filename);
    else await saveBlob(blob, filename);
  }
}
