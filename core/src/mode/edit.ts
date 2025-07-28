import {
  Color3,
  type Mesh,
  MeshBuilder,
  type PointerInfo,
  StandardMaterial,
} from '@babylonjs/core';
import type { Atom, Molvis } from '@molvis/core';
import { Pane } from 'tweakpane';
import { System } from '../system';
import { BaseMode, ModeType } from './base';
import { get_vec3_from_screen_with_depth } from './utils';
import { classRegistry } from '../command/base';
import { StageMeshPool, type CommandRecord } from './stage-mesh-pool';

class EditModeMenu {
  private container: HTMLDivElement;
  private pane: Pane;

  constructor(private em: EditMode) {
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    document.body.appendChild(this.container);
    this.pane = new Pane({ container: this.container, title: 'Edit Mode' });
    this.pane.hidden = true;
    this.build();
  }

  private build() {
    this.pane.children.forEach((c) => this.pane.remove(c));
    
    const element = this.pane.addFolder({ title: 'Atom' });
    (element.addBlade({
      view: 'list',
      label: 'Type',
      options: [
        { text: 'Carbon', value: 'C' },
        { text: 'Nitrogen', value: 'N' },
        { text: 'Oxygen', value: 'O' },
        { text: 'Hydrogen', value: 'H' },
        { text: 'Sulfur', value: 'S' },
        { text: 'Phosphorus', value: 'P' },
        { text: 'Fluorine', value: 'F' },
        { text: 'Chlorine', value: 'Cl' },
        { text: 'Bromine', value: 'Br' },
        { text: 'Iodine', value: 'I' }
      ],
      value: this.em.element
    }) as any).on('change', (ev: any) => {
      this.em.element = ev.value;
    });

    const bond = this.pane.addFolder({ title: 'Bond' });
    (bond.addBlade({
      view: 'list',
      label: 'Order',
      options: [
        { text: 'Single', value: 1 },
        { text: 'Double', value: 2 },
        { text: 'Triple', value: 3 }
      ],
      value: this.em.bondOrder
    }) as any).on('change', (ev: any) => {
      this.em.bondOrder = ev.value;
    });
  }

  public show(x: number, y: number) {
    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;
    this.pane.hidden = false;
  }

  public hide() {
    this.pane.hidden = true;
  }
}

class EditMode extends BaseMode {
  private _startAtom: Atom | null = null;
  private _previewAtom: Mesh | null = null;
  private _previewBond: Mesh | null = null;
  private _hoverAtom: Atom | null = null;
  private _pendingAtom = false;
  private _highlightedMesh: any = null;

  private _element = 'C';
  private _bondOrder = 1;
  private menu?: EditModeMenu;
  
  // 编辑状态管理
  private _hasUnsavedChanges = false;
  private _currentFrameIndex = -1;
  
  // 使用StageMeshPool管理mesh
  private _meshPool: StageMeshPool;

  get element(): string {
    return this._element;
  }

  set element(v: string) {
    this._element = v;
  }

  get bondOrder(): number {
    return this._bondOrder;
  }

  set bondOrder(v: number) {
    this._bondOrder = v;
  }

  constructor(app: Molvis) {
    super(ModeType.Edit, app);
    this._meshPool = new StageMeshPool(this.world.scene);
    if (typeof document !== 'undefined') {
      this.menu = new EditModeMenu(this);
    }
    this._initializeEditState();
  }

  private _initializeEditState() {
    this._currentFrameIndex = this.system.current_frame_index;
    this._hasUnsavedChanges = false;
    this._updateTitle();
  }

  private _updateTitle() {
    const originalTitle = document.title.replace(/^\*/, '');
    if (this._hasUnsavedChanges) {
      document.title = `*${originalTitle}`;
    } else {
      document.title = originalTitle;
    }
  }

  private _markAsChanged() {
    this._hasUnsavedChanges = true;
    this._updateTitle();
  }

  // 执行命令并添加到mesh池
  private _executeAndStageCommand(command: string, args: any): CommandRecord {
    const CommandClass = classRegistry.get(command);
    if (!CommandClass) {
      console.error(`Command not found: ${command}`);
      return { command, args, meshes: [], entities: [] };
    }

    const commandInstance = new CommandClass(this.app);
    const result = commandInstance.do(args);
    
    // 处理返回结果
    let meshes: Mesh[] = [];
    let entities: any[] = [];
    
    if (Array.isArray(result) && result.length === 2) {
      meshes = result[0] || [];
      entities = result[1] || [];
    }
    
    // 为mesh添加metadata并添加到池中
    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i];
      const entity = entities[i];
      
      const metadata = this._createMetadata(command, args, entity);
      this._meshPool.addMesh(mesh, metadata);
    }
    
    const record: CommandRecord = { command, args, meshes, entities };
    this._meshPool.addCommand(record);
    this._markAsChanged();
    
    console.log(`Executed and staged command: ${command}`, args);
    return record;
  }

  // 创建metadata
  private _createMetadata(command: string, args: any, entity: any): any {
    if (command === 'draw_atom') {
      return {
        type: 'atom',
        command: command,
        args: args,
        name: args.name,
        element: args.type,
        x: args.x,
        y: args.y,
        z: args.z
      };
    } else if (command === 'draw_bond') {
      return {
        type: 'bond',
        command: command,
        args: args,
        x1: args.x1,
        y1: args.y1,
        z1: args.z1,
        x2: args.x2,
        y2: args.y2,
        z2: args.z2,
        order: args.props?.order || 1
      };
    } else if (command === 'delete_atom') {
      return {
        type: 'deleted_atom',
        command: command,
        args: args,
        atomName: args.atom?.name || args.atomName
      };
    }
    
    return {
      type: 'unknown',
      command: command,
      args: args
    };
  }

  // 撤销操作
  private _undo() {
    const result = this._meshPool.undo();
    if (result) {
      this._markAsChanged();
      console.log('Undo:', result.command);
    }
  }

  // 重做操作
  private _redo() {
    const result = this._meshPool.redo();
    if (result) {
      this._markAsChanged();
      console.log('Redo:', result.command);
    }
  }

  // 保存到当前帧
  private _saveToFrame() {
    if (!this._meshPool.hasStagedContent()) {
      return;
    }

    // 保存到当前帧
    this._meshPool.saveToFrame(this.system.current_frame);
    
    // 清理mesh池
    this._meshPool.clean();
    this._hasUnsavedChanges = false;
    this._updateTitle();
    
    console.log('Changes saved successfully to current frame');
  }

  private _checkFrameChange() {
    const currentIndex = this.system.current_frame_index;
    if (currentIndex !== this._currentFrameIndex) {
      if (this._hasUnsavedChanges) {
        const confirmed = confirm(
          `You have unsaved changes in frame ${this._currentFrameIndex + 1}. ` +
          `Switching to frame ${currentIndex + 1} will discard these changes. Continue?`
        );
        
        if (confirmed) {
          // 清理所有暂存的mesh
          this._meshPool.clean();
          this._hasUnsavedChanges = false;
          this._updateTitle();
        } else {
          // 恢复到原来的帧
          this.system.current_frame_index = this._currentFrameIndex;
          return false;
        }
      }
      
      // 更新当前帧索引
      this._currentFrameIndex = currentIndex;
    }
    return true;
  }

  private highlightAtom(atom: Atom | null, highlight: boolean = true) {
    // Remove previous highlight
    if (this._highlightedMesh) {
      this._highlightedMesh.renderOutline = false;
      this._highlightedMesh = null;
    }

    if (highlight && atom) {
      // Find the mesh for this atom
      let mesh = this.world.scene.getMeshByName(`atom:${atom.name}`);
      if (!mesh) {
        // 在暂存mesh中查找
        const stagedMeshes = this._meshPool.getStagedMeshes();
        mesh = stagedMeshes.find(m => m.metadata?.name === atom.name) || null;
      }
      if (mesh) {
        this._highlightedMesh = mesh;
        this._highlightedMesh.renderOutline = true;
      }
    }
  }

  private clearPreview() {
    if (this._previewAtom) {
      this._previewAtom.dispose();
      this._previewAtom = null;
    }
    if (this._previewBond) {
      this._previewBond.dispose();
      this._previewBond = null;
    }
    if (this._highlightedMesh) {
      this._highlightedMesh.renderOutline = false;
      this._highlightedMesh = null;
    }
  }

  // 查找原子（包括当前帧的和暂存的）
  private _findAtom(name: string): Atom | null {
    // 先在当前帧中查找
    let atom = this.system.current_frame.atoms.find(a => a.name === name);
    if (atom) return atom;
    
    // 在暂存mesh中查找
    const stagedMeshes = this._meshPool.getStagedMeshes();
    const mesh = stagedMeshes.find(m => m.metadata?.name === name);
    if (mesh && mesh.metadata) {
      // 创建临时原子对象
      return {
        name: mesh.metadata.name,
        xyz: { x: mesh.metadata.x, y: mesh.metadata.y, z: mesh.metadata.z },
        get: (key: string) => mesh.metadata[key]
      } as any;
    }
    
    return null;
  }

  protected showContextMenu(x: number, y: number): void {
    this.menu?.show(x, y);
  }

  protected hideContextMenu(): void {
    this.menu?.hide();
  }

  override _on_pointer_down(pointerInfo: PointerInfo) {
    super._on_pointer_down(pointerInfo);
    if (pointerInfo.event.button === 0) this.menu?.hide();
    
    // 检查帧是否改变
    if (!this._checkFrameChange()) {
      return;
    }
    
    if (pointerInfo.event.button === 0) {
      const mesh = this.pick_mesh();
      if (mesh && mesh.name.startsWith('atom:')) {
        const name = mesh.name.substring(5);
        this._startAtom = this._findAtom(name);
        this.world.camera.detachControl();
        this._hoverAtom = null;
      } else {
        this._pendingAtom = true;
      }
    }
  }

  override _on_pointer_move(pointerInfo: PointerInfo) {
    super._on_pointer_move(pointerInfo);
    if (this._startAtom && pointerInfo.event.buttons === 1) {
      const mesh = this.pick_mesh();
      let hover: Atom | null = null;
      if (mesh && mesh.name.startsWith('atom:')) {
        const name = mesh.name.substring(5);
        const atom = this._findAtom(name);
        if (atom && atom !== this._startAtom) {
          hover = atom;
        }
      }

      // 只有当hover状态改变时才更新高亮
      if (hover !== this._hoverAtom) {
        if (hover) {
          // 磁吸效果：立即连接到目标原子
          this._hoverAtom = hover;
          this.highlightAtom(hover, true);
          
          // 立即清除预览原子，只显示键预览
          if (this._previewAtom) {
            this._previewAtom.dispose();
            this._previewAtom = null;
          }
        } else {
          this._hoverAtom = null;
          this.highlightAtom(null, false);
        }
      }

      if (hover) {
        // 显示键预览到目标原子
        const path = [this._startAtom.xyz, hover.xyz];
        if (this._previewBond) {
          MeshBuilder.CreateTube('preview_bond', {
            path,
            instance: this._previewBond,
          });
        } else {
          this._previewBond = MeshBuilder.CreateTube(
            'preview_bond',
            { path, radius: 0.05, updatable: true },
            this.world.scene
          );
          const bmat = new StandardMaterial(
            'preview_bond_mat',
            this.world.scene
          );
          bmat.diffuseColor = new Color3(0.8, 0.8, 0.8);
          this._previewBond.material = bmat;
        }
      } else {
        // 没有目标原子时，显示预览原子
        const xyz = get_vec3_from_screen_with_depth(
          this.world.scene,
          this.world.scene,
          pointerInfo.event.clientX,
          pointerInfo.event.clientY,
          10
        );
        if (!this._previewAtom) {
          this._previewAtom = MeshBuilder.CreateSphere(
            'preview_atom',
            { diameter: 0.5 },
            this.world.scene
          );
          const mat = new StandardMaterial(
            'preview_atom_mat',
            this.world.scene
          );
          mat.diffuseColor = new Color3(0.5, 0.5, 0.5);
          this._previewAtom.material = mat;
        }
        this._previewAtom.position = xyz;
        
        // 显示键预览到预览原子
        const path = [this._startAtom.xyz, xyz];
        if (this._previewBond) {
          MeshBuilder.CreateTube('preview_bond', {
            path,
            instance: this._previewBond,
          });
        } else {
          this._previewBond = MeshBuilder.CreateTube(
            'preview_bond',
            { path, radius: 0.05, updatable: true },
            this.world.scene
          );
          const bmat = new StandardMaterial(
            'preview_bond_mat',
            this.world.scene
          );
          bmat.diffuseColor = new Color3(0.8, 0.8, 0.8);
          this._previewBond.material = bmat;
        }
      }
    }
  }

  override _on_pointer_up(pointerInfo: PointerInfo) {
    super._on_pointer_up(pointerInfo);
    if (pointerInfo.event.button === 0 && this._startAtom) {
      if (this._hoverAtom) {
        // Create bond between two existing atoms
        this._executeAndStageCommand('draw_bond', {
          x1: this._startAtom.xyz.x,
          y1: this._startAtom.xyz.y,
          z1: this._startAtom.xyz.z,
          x2: this._hoverAtom.xyz.x,
          y2: this._hoverAtom.xyz.y,
          z2: this._hoverAtom.xyz.z,
          props: { order: this._bondOrder },
          options: {}
        });
      } else if (this._previewAtom) {
        // Create new atom and bond
        const xyz = this._previewAtom.position;
        const atomName = `a_${System.random_atom_id()}`;
        
        // Add new atom command
        this._executeAndStageCommand('draw_atom', {
          name: atomName,
          x: xyz.x,
          y: xyz.y,
          z: xyz.z,
          type: this._element,
          options: {}
        });
        
        // Add bond command
        this._executeAndStageCommand('draw_bond', {
          x1: this._startAtom.xyz.x,
          y1: this._startAtom.xyz.y,
          z1: this._startAtom.xyz.z,
          x2: xyz.x,
          y2: xyz.y,
          z2: xyz.z,
          props: { order: this._bondOrder },
          options: {}
        });
      }
      
      this.world.camera.attachControl(
        this.world.scene.getEngine().getRenderingCanvas(),
        false
      );
      this.clearPreview();
      this._startAtom = null;
      this._hoverAtom = null;
    } else if (
      pointerInfo.event.button === 0 &&
      this._pendingAtom &&
      !this._is_dragging
    ) {
      const xyz = get_vec3_from_screen_with_depth(
        this.world.scene,
        pointerInfo.event.clientX,
        pointerInfo.event.clientY,
        10
      );
      const atomName = `a_${System.random_atom_id()}`;
      
      this._executeAndStageCommand('draw_atom', {
        name: atomName,
        x: xyz.x,
        y: xyz.y,
        z: xyz.z,
        type: this._element,
        options: {}
      });
      
      this._pendingAtom = false;
    } else if (pointerInfo.event.button === 0 && this._pendingAtom) {
      this._pendingAtom = false;
    } else if (pointerInfo.event.button === 2 && !this._is_dragging) {
      const mesh = this.pick_mesh();
      if (mesh && mesh.name.startsWith('atom:')) {
        const name = mesh.name.substring(5);
        const atom = this._findAtom(name);
        if (atom) {
          this._executeAndStageCommand('delete_atom', { atom });
        }
      } else if (!mesh) {
        pointerInfo.event.preventDefault();
        this.menu?.show(pointerInfo.event.clientX, pointerInfo.event.clientY);
      }
    }
  }

  _on_press_ctrl_z(): void {
    this._undo();
  }

  _on_press_ctrl_y(): void {
    this._redo();
  }

  _on_press_ctrl_s(): void {
    this._saveToFrame();
  }

  public finish() {
    this.clearPreview();
    this._meshPool.clean();
    super.finish();
  }
}

export { EditMode };
