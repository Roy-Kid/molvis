
import type { PointerInfo } from "@babylonjs/core";
import type { Molvis } from "@molvis/core";

import { BaseMode, ModeType } from "./base";
import { getPositionFromMatrix, getScaleFromMatrix, highlightAtom } from "./utils";

class SelectMode extends BaseMode {
  // private selected: AbstractMesh[] = [];

  constructor(app: Molvis) {
    super(ModeType.Select, app);
  }

  protected override showContextMenu(x: number, y: number): void {
    
  }

  protected override hideContextMenu(): void {
    
  }

  override _on_pointer_pick(_pointerInfo: PointerInfo): void {
    const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY, undefined, false, this.world.camera);
    const mesh = pickResult.hit ? pickResult.pickedMesh : null;

    if (mesh.name.startsWith("highlight")) {
      mesh.dispose();
    }

    if (mesh?.metadata) {
      const meshType = mesh.metadata.type;

      if (meshType === 'atom') {
        const atomData = mesh.metadata;
        const atomIndex = pickResult.thinInstanceIndex!;
        const m = atomData.matrices as Float32Array;
        const pos = getPositionFromMatrix(m, atomIndex);
        const radius = getScaleFromMatrix(m, atomIndex);
        highlightAtom(pos, radius * 1.2, this.scene);
      } else if (meshType === 'bond') {
      }
    } 
  }
};

export { SelectMode };
