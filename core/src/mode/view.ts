import { BaseMode, ModeType } from "./base";
import { Molvis } from "@molvis/core";
import { PointerInfo } from "@babylonjs/core";

class ViewMode extends BaseMode {

    constructor(app: Molvis) {
      super(ModeType.View, app);
    }
  
    override _on_pointer_move(pointerInfo: PointerInfo) {
        const mesh = this.pick_mesh();
        const name = mesh ? mesh.name : "";
        this.gui.updateInfoText(name);
    }
  
    _on_press_e() {
      const frame = this.system.next_frame();
      this.app.artist.clear();
      this.app.artist.do("draw_frame", frame);
      // this.gui.updateFrameIndicator(
      //   this.system.current_frame_index,
      //   this.system.n_frames,
      // );
    }
  
    _on_press_q() {
      const frame = this.system.prev_frame();
      this.app.artist.clear();
      this.app.artist.do("draw_frame", frame);
      // this.gui.updateFrameIndicator(
      //   this.system.current_frame_index,
      //   this.system.n_frames,
      // );
    }
    
  }
  
export { ViewMode };