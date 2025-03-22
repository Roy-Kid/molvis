class EditMode extends Mode {
    private _draggingAtomMesh: Mesh | undefined = undefined;
    private _draggingBondMesh: Mesh | undefined = undefined;
    private _startAtom: Atom | undefined = undefined;
    private _draggingAtom: Atom | undefined = undefined;
    private _draggingBond: Bond | undefined = undefined;
  
    constructor(app: Molvis) {
      super(ModeType.Edit, app);
    }
  
    override _on_mouse_down(pointerInfo: PointerInfo) {
      if (pointerInfo.event.button !== 0) {
        return;
      }
      this._pos_on_mouse_down = this.get_pointer_xy();
      const mesh = this._pick_mesh(pointerInfo)
      if (mesh) {
        if (mesh.name.startsWith("atom:")) {
          const atomName = mesh.name.split(":")[1];
          this._startAtom = this._system.current_frame.get_atom(
            (atom: Atom) => atom.name === atomName,
          );
        }
      } else {
        const xyz = get_vec3_from_screen_with_depth(
          this._scene,
          pointerInfo.event.clientX,
          pointerInfo.event.clientY,
          10,
        );
  
        const atomData = new Map<string, ItemProp>([
          ["name", `atom_${Date.now()}`],
          ["type", "C"],
          ["x", xyz.x],
          ["y", xyz.y],
          ["z", xyz.z],
        ]);
  
        this._startAtom = this._app.draw_atom(atomData);
      }
    }
  
    override _on_mouse_move(pointerInfo: PointerInfo) {
      if (!this._startAtom || !this._pos_on_mouse_down) return;
  
      const xyz = get_vec3_from_screen_with_depth(
        this._scene,
        pointerInfo.event.clientX,
        pointerInfo.event.clientY,
        10,
      );
  
      if (this._is_dragging && !this._draggingAtomMesh) {
        const atomData = new Map<string, ItemProp>([
          ["name", `atom_${Date.now()}`],
          ["type", "C"],
          ["x", xyz.x],
          ["y", xyz.y],
          ["z", xyz.z],
        ]);
  
        // 创建临时原子，但不添加到系统中
        this._draggingAtom = new Atom(atomData);
        this._draggingBond = new Bond(this._draggingAtom, this._startAtom);
        this._draggingAtomMesh = this._world.artist.draw_atom(this._draggingAtom);
        this._draggingBondMesh = this._world.artist.draw_bond(this._draggingBond);
      } else if (this._draggingAtomMesh) {
        // 只更新网格位置，不更新系统数据
        this._draggingAtom!.xyz = xyz;
        this._draggingAtomMesh.position = xyz;
  
        // 更新键的位置和方向
        if (this._draggingBondMesh) {
          this._world.artist.draw_bond(this._draggingBond!, {
            instance: this._draggingBondMesh,
          });
        }
      }
    }
  
    override _on_mouse_up(pointerInfo: PointerInfo) {
      if (this._draggingAtomMesh && this._draggingAtom) {
        // 鼠标释放时才将数据同步到系统中
        const xyz = this._draggingAtomMesh.position;
        const atomData = new Map<string, ItemProp>([
          ["name", this._draggingAtom.name],
          ["type", "C"],
          ["x", xyz.x],
          ["y", xyz.y],
          ["z", xyz.z],
        ]);
  
        // 添加原子到系统
        const newAtom = this._app.draw_atom(atomData);
  
        // 添加键到系统
        if (this._startAtom) {
          this._app.draw_bond(this._startAtom, newAtom);
        }
  
        // 清除临时网格
        if (this._draggingBondMesh) {
          this._draggingBondMesh.dispose();
        }
        this._draggingAtomMesh.dispose();
      }
  
      // 重置所有临时变量
      this._draggingAtomMesh = undefined;
      this._startAtom = undefined;
      this._draggingBondMesh = undefined;
      this._draggingAtom = undefined;
      this._pos_on_mouse_down = this.get_pointer_xy();
      this._pos_on_mouse_down = this.get_pointer_xy();
    }
  }
  
  // class ManupulateMode extends Mode {
  //   constructor(app: Molvis) {
  //     super(ModeType.Manupulate, app);
  //   }
  
  //   override _on_mouse_down(pointerInfo: PointerInfo) {}
  
  //   override _on_mouse_up(pointerInfo: PointerInfo) {}
  
  //   override _on_mouse_move(pointerInfo: PointerInfo) {}
  
  //   override _on_mouse_wheel(pointerInfo: PointerInfo) {}
  
  //   override _on_mouse_pick(pointerInfo: PointerInfo) {}
  
  //   override _on_mouse_tap(pointerInfo: PointerInfo) {}
  
  //   override _on_mouse_double_tap(pointerInfo: PointerInfo) {}
  // }
  

