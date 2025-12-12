import type { MolvisApp as Molvis } from "../core/app";
import { command } from "./decorator";

class ViewCommands {
  @command("set_view_mode")
  static set_view_mode(app: Molvis, mode: string) {
    switch (mode) {
      case "persp":
        app.world.setPerspective();
        break;
      case "ortho":
        app.world.setOrthographic();
        break;
      case "front":
        app.world.viewFront();
        break;
      case "back":
        app.world.viewBack();
        break;
      case "left":
        app.world.viewLeft();
        break;
      case "right":
        app.world.viewRight();
        break;
      default:
        break;
    }

    return { success: true, data: { mode }, meshes: [], entities: [] };
  }

  @command("set_theme")
  static set_theme(app: Molvis, theme: string) {
    // TODO: Implement theme setting
    return { success: true, data: { theme }, meshes: [], entities: [] };
  }
}

export const set_view_mode = ViewCommands.set_view_mode;
export const set_theme = ViewCommands.set_theme;

