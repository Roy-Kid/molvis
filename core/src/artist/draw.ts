import {
    Color3,
    MeshBuilder,
    StandardMaterial,
    Vector3,
    type Mesh,
    TransformNode,
    Scene,
} from "@babylonjs/core";
import type { Atom, Bond } from "../system/item";
import type { Molvis } from "../app";
import { molecularPalette } from "./palette";

export interface IDrawAtomOptions {
  radius?: number | number[] | null;
}
export interface IDrawBondOptions {
  radius?: number;
  update?: boolean;
  order?: number;
}
export interface IDrawBoxOptions {
  visible?: boolean;
  color?: Color3;
  lineWidth?: number;
}
export interface IDrawFrameOptions {
  atoms: IDrawAtomOptions;
  bonds: IDrawBondOptions;
  box?: IDrawBoxOptions;
}

export interface GridOptions {
    spacing?: number;
    size?: number;
    color?: string;
    alpha?: number;
}

export function draw_grid(
    scene: Scene,
    gridOptions: GridOptions = {}
): void {
    const { spacing = 1.0, size = 10.0, color = "#888888", alpha = 0.3 } = gridOptions;
    
    // 不再清除现有网格！让用户手动调用clear()
    // const existingGrid = scene.getMeshByName("grid");
    // if (existingGrid) {
    //     existingGrid.dispose();
    // }
    
    // 为每次调用创建唯一的网格组
    const gridId = `grid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const gridGroup = new TransformNode(gridId, scene);
    
    // Create material for grid lines
    const gridMaterial = new StandardMaterial(`gridMaterial_${gridId}`, scene);
    gridMaterial.emissiveColor = Color3.FromHexString(color);
    gridMaterial.alpha = alpha;
    
    // Draw XY planes (parallel to XY, varying Z)
    for (let z = -size; z <= size; z += spacing) {
        // Create a plane mesh for this Z level
        const plane = MeshBuilder.CreatePlane(`xy_plane_${gridId}_${z}`, { width: size * 2, height: size * 2 }, scene);
        plane.position = new Vector3(0, 0, z);
        plane.material = gridMaterial;
        plane.parent = gridGroup;
        
        // Make it wireframe-like by using a very thin plane
        plane.scaling = new Vector3(1, 1, 0.001);
    }
    
    // Draw XZ planes (parallel to XZ, varying Y)
    for (let y = -size; y <= size; y += spacing) {
        const plane = MeshBuilder.CreatePlane(`xz_plane_${gridId}_${y}`, { width: size * 2, height: size * 2 }, scene);
        plane.position = new Vector3(0, y, 0);
        plane.rotation = new Vector3(Math.PI / 2, 0, 0);
        plane.material = gridMaterial;
        plane.parent = gridGroup;
        plane.scaling = new Vector3(1, 1, 0.001);
    }
    
    // Draw YZ planes (parallel to YZ, varying X)
    for (let x = -size; x <= size; x += spacing) {
        const plane = MeshBuilder.CreatePlane(`yz_plane_${gridId}_${x}`, { width: size * 2, height: size * 2 }, scene);
        plane.position = new Vector3(x, 0, 0);
        plane.rotation = new Vector3(0, Math.PI / 2, 0);
        plane.material = gridMaterial;
        plane.parent = gridGroup;
        plane.scaling = new Vector3(1, 1, 0.001);
    }
}

export const draw_atom = (
    app: Molvis,
    atom: Atom,
    options: IDrawAtomOptions = {}
): Mesh => {
    
    const atype = atom.get("element") || "C";
    
    // Handle different radius types
    let radius: number;
    const elementRadius = molecularPalette.getRadius(atype as string);
    
    if (options.radius === null || options.radius === undefined) {
        radius = elementRadius;
    } else if (typeof options.radius === "string") {
        radius = molecularPalette.getRadius(options.radius);
    } else if (Array.isArray(options.radius)) {
        // Use specific radius for this atom if available
        radius = elementRadius;
    } else {
        radius = options.radius;
    }
    
    // Get color with potential gradient mapping
    const color = molecularPalette.getColor(atype as string);
    
    const sphere = MeshBuilder.CreateSphere(
        `atom:${atom.name}`,
        { diameter: radius * 2 },
        app.scene
    );
    
    // Use the Vector3 xyz property directly
    sphere.position = atom.xyz;
    
    const material = new StandardMaterial(`atom_material:${atom.name}`, app.scene);
    material.diffuseColor = Color3.FromHexString(color);
    sphere.material = material;
    
    return sphere;
};

export const draw_frame = (
  app: Molvis,
  atoms: Atom[],
  bonds: Bond[],
  options: IDrawFrameOptions = { atoms: {}, bonds: {} }
): Mesh[] => {
  // Always draw without clearing - use clear() command to clear content
  const spheres = atoms.map((atom: Atom, index: number) => {
        const atomOptions = options.atoms || {};
        // Handle array radius case
        if (Array.isArray(atomOptions.radius) && atomOptions.radius[index] !== undefined) {
            atomOptions.radius = atomOptions.radius[index];
        }
        
        const sphere = draw_atom(app, atom, atomOptions);
        return sphere;
    });
    
  const tubes = bonds.flatMap((bond: Bond) => {
        const bondTubes = draw_bond(app, bond, options.bonds);
        return bondTubes;
    });
    
    const allMeshes = [...spheres, ...tubes];
    
    return allMeshes;
};

export const draw_bond = (
  app: Molvis,
  bond: Bond,
  options: IDrawBondOptions,
) => {
  const start = bond.itom.xyz;
  const end = bond.jtom.xyz;
  const order = bond.order ?? 1;
  const radius = options.radius ?? 0.1;

  const createTube = (name: string, path: Vector3[], instance?: Mesh) => {
    let tube: Mesh;
    
    if (options.update && instance) {
      tube = MeshBuilder.CreateTube(name, { path, radius, instance });
    } else {
      tube = MeshBuilder.CreateTube(name, { path, radius, updatable: true }, app.scene);
    }
    
    // Always ensure material is set properly
    if (!tube.material || options.update) {
      const material = new StandardMaterial("bond", app.scene);
      material.diffuseColor = new Color3(0.8, 0.8, 0.8);
      tube.material = material;
    }

    // Minimal metadata for picking/debug
    tube.metadata = {
      name: bond.name,
      order: bond.order,
      itom_name: bond.itom.name,
      jtom_name: bond.jtom.name,
    };

    return tube;
  };

  const dir = end.subtract(start);
  const axis = dir.normalize();
  let perp = Vector3.Cross(axis, Vector3.Up());
  if (perp.lengthSquared() < 1e-6) {
    perp = Vector3.Cross(axis, Vector3.Right());
  }
  perp = perp.normalize().scale(radius * 2);

  const existingTubes: Mesh[] = [];
  for (let i = 0; ; i++) {
    const m = app.scene.getMeshByName(`bond:${bond.name}:${i}`);
    if (m) existingTubes.push(m as Mesh);
    else break;
  }

  const tubes: Mesh[] = [];
  if (order === 1) {
    tubes.push(
      createTube(
        `bond:${bond.name}:0`,
        [start, end],
        existingTubes[0],
      ),
    );
  } else if (order === 2) {
    tubes.push(
      createTube(
        `bond:${bond.name}:0`,
        [start.add(perp), end.add(perp)],
        existingTubes[0],
      ),
    );
    tubes.push(
      createTube(
        `bond:${bond.name}:1`,
        [start.add(perp.scale(-1)), end.add(perp.scale(-1))],
        existingTubes[1],
      ),
    );
  } else if (order >= 3) {
    tubes.push(
      createTube(
        `bond:${bond.name}:0`,
        [start.add(perp), end.add(perp)],
        existingTubes[0],
      ),
    );
    tubes.push(
      createTube(`bond:${bond.name}:1`, [start, end], existingTubes[1]),
    );
    tubes.push(
      createTube(
        `bond:${bond.name}:2`,
        [start.add(perp.scale(-1)), end.add(perp.scale(-1))],
        existingTubes[2],
      ),
    );
  }

  for (let i = order; i < existingTubes.length; i++) {
    existingTubes[i].dispose();
  }

  return tubes;
};

export const draw_box = (
  app: Molvis,
  boxData: { matrix: number[][]; pbc: boolean[]; origin: number[] },
  options: IDrawBoxOptions = {},
) => {
  const { visible = true, color = new Color3(1, 1, 1) } = options;
  
  if (!visible) return [];

  // Clean up existing box meshes
  const meshesToDispose = [];
  for (const mesh of app.scene.meshes) {
    if (mesh.name.startsWith("box:")) {
      meshesToDispose.push(mesh);
    }
  }
  for (const mesh of meshesToDispose) {
    mesh.dispose();
  }

  const { matrix, origin } = boxData;
  
  // Validate matrix structure
  if (!matrix || !Array.isArray(matrix) || matrix.length !== 3) {
    return [];
  }
  
  for (let i = 0; i < matrix.length; i++) {
    if (!Array.isArray(matrix[i]) || matrix[i].length !== 3) {
      return [];
    }
  }
  
  // Validate origin structure
  if (!origin || !Array.isArray(origin) || origin.length !== 3) {
    return [];
  }
  
  // Convert matrix to vectors with safe access
  const a = new Vector3(
    Number(matrix[0][0]) || 0, 
    Number(matrix[0][1]) || 0, 
    Number(matrix[0][2]) || 0
  );
  const b = new Vector3(
    Number(matrix[1][0]) || 0, 
    Number(matrix[1][1]) || 0, 
    Number(matrix[1][2]) || 0
  );
  const c = new Vector3(
    Number(matrix[2][0]) || 0, 
    Number(matrix[2][1]) || 0, 
    Number(matrix[2][2]) || 0
  );
  const o = new Vector3(
    Number(origin[0]) || 0, 
    Number(origin[1]) || 0, 
    Number(origin[2]) || 0
  );

  
  // Calculate the 8 vertices of the box
  const vertices = [
    o,                                // 0: origin
    o.add(a),                         // 1: origin + a
    o.add(b),                         // 2: origin + b
    o.add(a).add(b),                  // 3: origin + a + b
    o.add(c),                         // 4: origin + c
    o.add(a).add(c),                  // 5: origin + a + c
    o.add(b).add(c),                  // 6: origin + b + c
    o.add(a).add(b).add(c),           // 7: origin + a + b + c
  ];

  // Define the 12 edges of the box
  const edges = [
    [0, 1], [1, 3], [3, 2], [2, 0], // bottom face
    [4, 5], [5, 7], [7, 6], [6, 4], // top face
    [0, 4], [1, 5], [2, 6], [3, 7], // vertical edges
  ];

  // Create line meshes for each edge
  const lineMeshes = [];
  for (let i = 0; i < edges.length; i++) {
    const [start, end] = edges[i];
    const points = [vertices[start], vertices[end]];
    
    const line = MeshBuilder.CreateLines(
      `box:edge:${i}`,
      { points },
      app.scene,
    );
    
    line.color = color;
    lineMeshes.push(line);
  }

  return lineMeshes;
};
