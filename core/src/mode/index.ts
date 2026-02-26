import { KeyboardEventTypes, type KeyboardInfo } from "@babylonjs/core";
import { Frame, type Box } from "@molcrafts/molrs";
import type { MolvisApp } from "../core/app";
import { syncSceneToFrame } from "../core/scene_sync";

import type { BaseMode } from "./base";
import { ModeType } from "./base";
import { ViewMode } from "./view";

import { EditMode } from "./edit";
import { ManipulateMode } from "./manipulate";
import { MeasureMode } from "./measure";
import { SelectMode } from "./select";

class ModeManager {
  private _app: MolvisApp;
  private _mode: BaseMode | null = null;
  private _editSessionSnapshot: { frame: Frame; box?: Box } | null = null;

  constructor(app: MolvisApp) {
    this._app = app;
    this.switch_mode(ModeType.View);
    this._register_keyboard_events();
  }

  private get _scene() {
    return this._app.world.scene;
  }

  private _register_keyboard_events = () => {
    this._scene.onKeyboardObservable.add((kbInfo: KeyboardInfo) => {
      switch (kbInfo.type) {
        case KeyboardEventTypes.KEYDOWN:
          switch (kbInfo.event.key) {
            case "1":
              this.switch_mode(ModeType.View);
              break;
            case "2":
              this.switch_mode(ModeType.Select);
              break;

            case "3":
              this.switch_mode(ModeType.Edit);
              break;

            case "4":
              this.switch_mode(ModeType.Measure);
              break;
            case "5":
              this.switch_mode(ModeType.Manipulate);
              break;
          }
          break;
      }
    });
  };

  private snapshotSceneForEditSession(): { frame: Frame; box?: Box } {
    const frame = new Frame();
    syncSceneToFrame(this._app.world.sceneIndex, frame, { markSaved: false });
    const box = this._app.system.box;
    if (box) {
      frame.simbox = box;
    }
    return { frame, box };
  }

  private beginEditSession(): void {
    this._editSessionSnapshot = this.snapshotSceneForEditSession();
    this._app.world.sceneIndex.markAllSaved();
  }

  private confirmKeepEditChanges(): boolean {
    if (typeof window === "undefined" || typeof window.confirm !== "function") {
      return true;
    }
    return window.confirm(
      "Edit mode has unsaved changes. Keep them and apply to frame?",
    );
  }

  private finalizeEditSession(): void {
    const snapshot = this._editSessionSnapshot;
    const sceneIndex = this._app.world.sceneIndex;
    const currentBox = this._app.system.box;

    let frameToRender: Frame | null = null;
    let boxToRender: Box | undefined = snapshot?.box ?? currentBox;

    if (sceneIndex.hasUnsavedChanges) {
      const keepChanges = this.confirmKeepEditChanges();
      if (keepChanges) {
        const mergedFrame = new Frame();
        syncSceneToFrame(sceneIndex, mergedFrame);
        if (currentBox) {
          mergedFrame.simbox = currentBox;
        }
        frameToRender = mergedFrame;
      } else {
        frameToRender = snapshot?.frame ?? null;
      }
    } else {
      frameToRender = snapshot?.frame ?? null;
    }

    if (!frameToRender && this._app.system.frame) {
      frameToRender = this._app.system.frame;
    }

    if (frameToRender) {
      this._app.renderFrame(frameToRender, boxToRender);
    }

    sceneIndex.markAllSaved();
    this._editSessionSnapshot = null;
  }

  public switch_mode = (mode: ModeType) => {
    if (this._mode?.name === mode) return;

    const prevMode = this._mode?.name;
    if (this._mode) this._mode.finish();

    if (prevMode === ModeType.Edit && mode !== ModeType.Edit) {
      this.finalizeEditSession();
    }

    if (mode === ModeType.Edit) {
      this.beginEditSession();
    }

    switch (mode) {
      case ModeType.View:
        this._mode = new ViewMode(this._app);
        break;
      case ModeType.Select:
        this._mode = new SelectMode(this._app);
        break;
      case ModeType.Edit:
        this._mode = new EditMode(this._app);
        break;
      case ModeType.Measure:
        this._mode = new MeasureMode(this._app);
        break;
      case ModeType.Manipulate:
        this._mode = new ManipulateMode(this._app);
        break;

      default:
        throw new Error(`unknown mode: ${mode}`);
    }

    this._mode?.start();
    this._app.events?.emit("mode-change", mode);
  };

  public get currentMode(): BaseMode | null {
    return this._mode;
  }

  public get currentModeName(): string {
    return this._mode?.name || ModeType.View;
  }
}

export { ModeManager, ModeType };
