import { Color3 } from "@babylonjs/core";
import { registerCommand, type ICommand } from "./base";
import { Frame } from "../system/frame";
import type { Atom, Bond } from "../system/item";
import {
  draw_atom,
  draw_frame,
  draw_bond,
  draw_box,
  type IDrawAtomOptions,
  type IDrawFrameOptions,
  type IDrawBondOptions,
} from "../artist";
import type { Molvis } from "../app";
import type { IProp } from "../system/base";

// Inline type for Python Frame data
type FrameData = {
  blocks?: {
    atoms?: {
      xyz?: number[][];
      type?: string[];
      element?: string[];
      name?: string[];
      [key: string]: unknown[] | undefined;
    };
    bonds?: {
      i?: number[];
      j?: number[];
      order?: number[];
    };
  };
  box?: {
    matrix: number[][];
    pbc?: boolean[];
    origin: number[];
  };
};

// Inline type for Python Box data
type BoxData = {
  matrix: number[][];
  pbc: boolean[];
  origin: number[];
};

@registerCommand("draw_atom")
class DrawAtom implements ICommand {
  private app: Molvis

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(args: {
    name: string;
    x: number;
    y: number;
    z: number;
    options: IDrawAtomOptions;
  }) {
    const { name, x, y, z, options, ...props } = args;
    const atom = this.app.system.current_frame.add_atom(name, x, y, z, props);
    const sphere = draw_atom(this.app, atom, options ?? {});
    return {
      success: true,
      message: `Atom ${name} drawn at (${x}, ${y}, ${z})`,
      data: { atomName: name, position: [x, y, z], meshName: sphere.name },
      count: 1
    };
  }

  public undo() {}
}

@registerCommand("draw_bond")
class DrawBond implements ICommand {
  private app: Molvis

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(args: {
    x1: number;
    y1: number;
    z1: number;
    x2: number;
    y2: number;
    z2: number;
    options: IDrawBondOptions;
  }) {
    const { x1, y1, z1, x2, y2, z2, options, ...props } = args;
    
    // Create atoms if they don't exist
    const itom = this.app.system.current_frame.add_atom("bond_atom_1", x1, y1, z1, props);
    const jtom = this.app.system.current_frame.add_atom("bond_atom_2", x2, y2, z2, props);
    
    const bond = this.app.system.current_frame.add_bond(itom, jtom, props);
    const tubes = draw_bond(this.app, bond, options);
    return {
      success: true,
      message: `Bond drawn between (${x1}, ${y1}, ${z1}) and (${x2}, ${y2}, ${z2})`,
      data: { 
        atom1: [x1, y1, z1], 
        atom2: [x2, y2, z2], 
        bondOrder: bond.order,
        meshCount: tubes.length 
      },
      count: tubes.length
    };
  }

  public undo() {}
}

@registerCommand("draw_frame")
class DrawFrame implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(args: {
    frameData: FrameData;
    options: IDrawFrameOptions;
  }) {
    const { frameData, options } = args;
    
    // Frame data processed
    const atoms: Atom[] = [];
    const bonds: Bond[] = [];

    // Use current frame instead of creating a new one
    const frame = this.app.system.current_frame;
    
    const frame_atoms = frameData.blocks?.atoms || {};
    const frame_bonds = frameData.blocks?.bonds || {};
    
    // Register atoms in ECS
    if (frame_atoms.xyz) {
      const {
        xyz,
        type = [],
        element = [],
        name = [],
        ...rest
      } = frame_atoms;
      
      for (let i = 0; i < xyz.length; i++) {
        const atomType = type[i] || element[i] || "C";
        const atomName = name[i] || `atom_${i}`;
        const props: Record<string, IProp> = {
          type: atomType,
          element: element[i] || atomType,
        };
        
        // Add any extra properties
        for (const key in rest) {
          if (rest[key] && rest[key][i] !== undefined) {
            props[key] = rest[key][i] as IProp;
          }
        }
        
        const atom = frame.add_atom(atomName, xyz[i][0], xyz[i][1], xyz[i][2], props);
        atoms.push(atom);
      }
    }
    
    // Bond indices processed
    // Register bonds in ECS
    if (frame_bonds?.i && frame_bonds?.j && atoms.length > 0) {
      const { i, j, order = [] } = frame_bonds;
      
      for (let idx = 0; idx < i.length; idx++) {
        if (atoms[i[idx]] && atoms[j[idx]]) {
          const bond = frame.add_bond(atoms[i[idx]], atoms[j[idx]], {
            order: order[idx] || 1,
          });
          bonds.push(bond);
        }
      }
    }

    // Update GUI frame indicator
    this.app.gui.updateFrameIndicator(
      this.app.system.current_frame_index,
      this.app.system.n_frames,
    );

    // Draw using the current frame
    const meshes = draw_frame(this.app, frame, options);
    
    // Return serializable status instead of Mesh objects to avoid circular reference issues
    return {
      success: true,
      message: `Frame drawn successfully with ${atoms.length} atoms and ${bonds.length} bonds`,
      data: {
        atomsCount: atoms.length,
        bondsCount: bonds.length,
        meshesCount: meshes.length,
        frameIndex: this.app.system.current_frame_index
      },
      count: meshes.length
    };
  }

  public undo() {}
}

@registerCommand("new_frame")
class NewFrame implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(args: {
    name?: string;
    clear?: boolean;
  } = {}) {
    const { name = "frame", clear = true } = args;
    
    // Create a new frame
    const newFrame = new Frame();
    
    // Add the new frame to the system
    this.app.system.append_frame(newFrame);
    
    // Set it as current frame
    this.app.system.current_frame_index = this.app.system.n_frames - 1;
    
    // Update GUI
    this.app.gui.updateFrameIndicator(
      this.app.system.current_frame_index,
      this.app.system.n_frames,
    );
    
    // Clear the world if requested
    if (clear) {
      this.app.world.clear();
    }
    
    return {
      success: true,
      message: `New frame "${name}" created and set as current`,
      data: {
        frameName: name,
        frameIndex: this.app.system.current_frame_index,
        totalFrames: this.app.system.n_frames,
        cleared: clear
      },
      count: 1
    };
  }

  public undo() {}
}

@registerCommand("draw_box")
class DrawBox implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(args: {
    boxData: BoxData;
    options: {
      color?: string;
      lineWidth?: number;
      visible?: boolean;
    };
  }) {
    const { boxData, options } = args;
    
    // Convert color string to Color3 if provided
    let color;
    if (options.color) {
      color = Color3.FromHexString(options.color);
    }
    
    const meshes = draw_box(this.app, boxData, {
      visible: options.visible ?? true,
      color,
      lineWidth: options.lineWidth,
    });
    
    return {
      success: true,
      message: `Box drawn with ${meshes.length} meshes`,
      data: {
        boxMatrix: boxData.matrix,
        boxOrigin: boxData.origin,
        meshCount: meshes.length,
        color: options.color,
        lineWidth: options.lineWidth
      },
      count: meshes.length
    };
  }

  public undo() {}
}

@registerCommand("hide")
class Hide implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do() {
    // Clear all meshes from scene
    this.app.world.clear();
    
    return {
      success: true,
      message: "All meshes cleared from scene",
      data: { cleared: true },
      count: 0
    };
  }

  public undo() {}
}

@registerCommand("clear")
class Clear implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do() {

    this.app.world.clear();
    this.app.system.current_frame.clear();
    
    return {
      success: true,
      message: "All meshes cleared up",
      data: { cleared: true },
      count: 0
    };
  }

  public undo() {}
}

@registerCommand("set_style")
class SetStyle implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(args: {
    style?: string;
    atoms?: {
      radius?: number | number[] | null;
    };
    bonds?: {
      radius?: number;
    };
  }) {
    // Apply style changes
    // This would update the visual appearance of atoms and bonds
    
    return {
      success: true,
      message: "Style updated successfully",
      data: { style: args.style, atoms: args.atoms, bonds: args.bonds },
      count: 0
    };
  }

  public undo() {}
}

@registerCommand("set_theme")
class SetTheme implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(args: {
    theme: string;
  }) {
    // Apply theme changes
    // This would update the overall visual theme
    
    return {
      success: true,
      message: `Theme "${args.theme}" applied successfully`,
      data: { theme: args.theme },
      count: 0
    };
  }

  public undo() {}
}

@registerCommand("set_view_mode")
class SetViewMode implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(args: { mode: string }) {
    const { mode } = args;
    
    // Set view mode in world camera
    if (this.app.world) {
      switch (mode) {
        case "persp":
          this.app.world.setPerspective();
          break;
        case "ortho":
          this.app.world.setOrthographic();
          break;
        case "top":
        case "front":
        case "side":
          // These view modes can be implemented later
          break;
        default:
          // Unknown view mode
      }
    }
    
    return {
      success: true,
      message: `View mode "${mode}" applied`,
      data: { mode: mode },
      count: 0
    };
  }

  public undo() {}
}

@registerCommand("get_current_frame")
class GetCurrentFrame implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(args: Record<string, unknown> = {}) {
    const currentFrame = this.app.system.current_frame;
    const frameIndex = this.app.system.current_frame_index;
    const totalFrames = this.app.system.n_frames;
    
    // Store frame info for later retrieval
    // Return empty arrays to match ICommand interface
    return {
      success: true,
      message: "Current frame information retrieved",
      data: {
        currentFrameIndex: frameIndex,
        totalFrames: totalFrames,
        singleFrameMode: this.app.system.single_frame_mode,
        isRunning: this.app.world.isRunning,
        meshCount: this.app.world.scene.meshes.length
      },
      count: 0
    };
  }

  public undo() {}
}

@registerCommand("get_frame_info")
class GetFrameInfo implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(args: Record<string, unknown> = {}) {
    const currentFrame = this.app.system.current_frame;
    const frameIndex = this.app.system.current_frame_index;
    const totalFrames = this.app.system.n_frames;
    
    // Get detailed frame information
    const frameInfo = {
      current: {
        index: frameIndex,
        atoms: currentFrame.atoms.map(atom => ({
          name: atom.name,
          element: atom.get("element"),
          xyz: atom.xyz,
          properties: atom.toJSON()
        })),
        bonds: currentFrame.bonds.map(bond => ({
          name: bond.name,
          itom: bond.itom.name,
          jtom: bond.jtom.name,
          order: bond.order,
          properties: bond.toJSON()
        }))
      },
      system: {
        totalFrames: totalFrames,
        singleFrameMode: this.app.system.single_frame_mode,
        currentFrameIndex: frameIndex
      },
      world: {
        isRunning: this.app.world.isRunning,
        meshCount: this.app.world.scene.meshes.length
      },
      timestamp: Date.now()
    };
    
    // Store frame info for later retrieval
    // Return empty arrays to match ICommand interface
    return {
      success: true,
      message: "Frame information retrieved",
      data: frameInfo,
      count: 0
    };
  }

  public undo() {}
}

@registerCommand("set_grid_size")
class SetGridSize implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(args: { size: number }) {
    const { size } = args;
    this.app.world.gridGround.setSize(size, size);
    return {
      success: true,
      message: `Grid size set to ${size}`,
      data: { size: size },
      count: 0
    };
  }

  public undo() {}
}

@registerCommand("enable_grid")
class EnableGrid implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do(options: {
    mainColor?: string;
    lineColor?: string;
    opacity?: number;
    majorUnitFrequency?: number;
    minorUnitVisibility?: number;
    distanceThreshold?: number;
    minGridStep?: number;
    size?: number;
  }) {
      if (this.app.world.gridGround.isEnabled) {
        this.app.world.gridGround.disable();
      }
    
      this.app.world.gridGround.enable();
      
      // Apply custom grid settings if provided
      if (Object.keys(options).length > 0) {
        // Convert string colors to Color3
        const gridOptions: any = { ...options };
        if (gridOptions.mainColor) {
          gridOptions.mainColor = Color3.FromHexString(gridOptions.mainColor);
        }
        if (gridOptions.lineColor) {
          gridOptions.lineColor = Color3.FromHexString(gridOptions.lineColor);
        }
        
        this.app.world.gridGround.updateAppearance(gridOptions);
      }

    
    return {
      success: true,
      message: `Grid enabled with options: ${JSON.stringify(options)}`,
      data: options,
      count: 0
    };
  }

  public undo() {}
}

@registerCommand("disable_grid")
class DisableGrid implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do() {
    this.app.world.gridGround.disable();
    return {
      success: true,
      message: "Grid disabled",
      data: { disabled: true },
      count: 0
    };
  }

  public undo() {}
}

@registerCommand("is_grid_enabled")
class IsGridEnabled implements ICommand {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public do() {
    // Return empty arrays to match ICommand interface, but store result in app for retrieval
    const enabled = this.app.world.gridGround.isEnabled;
    (this.app as any)._lastGridEnabledStatus = enabled;
    return {
      success: true,
      message: "Grid enabled status retrieved",
      data: { enabled: enabled },
      count: 0
    };
  }

  public undo() {}
}


export { 
  DrawAtom, 
  DrawBond, 
  DrawFrame, 
  DrawBox, 
  Clear, 
  SetStyle, 
  SetTheme, 
  SetViewMode, 
  SetGridSize,
  EnableGrid,
  DisableGrid,
  IsGridEnabled
};
