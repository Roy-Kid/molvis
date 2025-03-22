
class SelectMode extends Mode {
    private selected: AbstractMesh[] = [];
  
    constructor(app: Molvis) {
      super(ModeType.Select, app);
    }
  
    _on_mouse_pick(pointerInfo: PointerInfo): void {
      const pickInfo = pointerInfo.pickInfo;
      if (pickInfo === null) {
          return;
      }
      const picked_mesh = pickInfo.pickedMesh;
      if (picked_mesh) {
        this.selected.push(picked_mesh);
        highlight_mesh(picked_mesh);
      }
    }
  }
  