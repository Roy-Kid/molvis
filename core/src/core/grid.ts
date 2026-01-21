import {
  Color3,
  MeshBuilder,
  type Scene,
  type ArcRotateCamera,
  type Engine,
  LinesMesh,
  VertexData,
  StandardMaterial,
} from "@babylonjs/core";
import {
  GridMaterial,
} from "@babylonjs/materials";

/**
 * GridGround component that creates an adaptive grid ground
 * The grid automatically adjusts its density based on camera distance
 */
export class GridGround {
  private _scene: Scene;
  private _camera: ArcRotateCamera;
  private _engine: Engine;
  private _ground: any;
  private _gridMaterial: GridMaterial;
  private _referenceLines: LinesMesh | null = null;
  private _isEnabled: boolean = false;
  
  // Grid configuration
  private readonly TARGET_PX_PER_MINOR = 64;
  private GRID_SIZE = 10000;
  private readonly GRID_SUBDIVISIONS = 1;
  private readonly MIN_GRID_STEP = 1; // Minimum grid step when camera is close
  private readonly DISTANCE_THRESHOLD = 50; // Distance threshold for locking grid step

  constructor(scene: Scene, camera: ArcRotateCamera, engine: Engine) {
    this._scene = scene;
    this._camera = camera;
    this._engine = engine;
    this._gridMaterial = this._createGridMaterial();
  }

  /**
   * Create the grid material with default settings
   */
  private _createGridMaterial(): GridMaterial {
    const grid = new GridMaterial("grid", this._scene);
    grid.disableDepthWrite = true;
    grid.zOffset = -1;
    grid.mainColor = new Color3(0.53, 0.53, 0.53);
    grid.lineColor = new Color3(0.59, 0.59, 0.59);
    grid.opacity = 0.8;
    grid.majorUnitFrequency = 10;
    grid.minorUnitVisibility = 0.7;
    grid.backFaceCulling = false;
    return grid;
  }

  /**
   * Enable the grid ground
   */
  public enable(): void {
    if (this._isEnabled) return;
    
    this._createGround();
    this._setupAdaptiveGrid();
    this._isEnabled = true;
  }

  /**
   * Disable the grid ground
   */
  public disable(): void {
    if (!this._isEnabled) return;
    
    if (this._ground) {
      this._ground.dispose();
      this._ground = null;
    }
    
    if (this._referenceLines) {
      // Dispose both X and Y reference lines
      const xLine = (this._referenceLines as any)._xLine;
      const yLine = (this._referenceLines as any)._yLine;
      
      if (xLine) {
        xLine.dispose();
      }
      if (yLine) {
        yLine.dispose();
      }
      
      this._referenceLines.dispose();
      this._referenceLines = null;
    }
    
    this._isEnabled = false;
  }

  /**
   * Create the ground mesh
   */
  private _createGround(): void {
    this._ground = MeshBuilder.CreateGround(
      "gridGround",
      { 
        width: this.GRID_SIZE, 
        height: this.GRID_SIZE, 
        subdivisions: this.GRID_SUBDIVISIONS 
      },
      this._scene
    );
    
    this._ground.material = this._gridMaterial;
    this._ground.renderingGroupId = 0; // Render behind other objects
    this._ground.isPickable = false;
    
    // Create reference lines (x=0 and y=0)
    this._createReferenceLines();
  }

  /**
   * Create reference lines for x=0 and y=0
   */
  private _createReferenceLines(): void {
    if (this._referenceLines) {
      this._referenceLines.dispose();
    }

    const halfSize = this.GRID_SIZE / 2;
    
    // Create X=0 line (vertical, red)
    const xLine = new LinesMesh("xReferenceLine", this._scene);
    xLine.color = new Color3(1.0, 0.0, 0.0);
    xLine.isPickable = false;
    const xPositions: number[] = [
      -halfSize, 0, 0,  // Start point
      halfSize, 0, 0,   // End point
    ];
    const xIndices: number[] = [0, 1];
    
    const xVertexData = new VertexData();
    xVertexData.positions = xPositions;
    xVertexData.indices = xIndices;
    xVertexData.applyToMesh(xLine);
    

    // Create Y=0 line (horizontal, blue)
    const yLine = new LinesMesh("yReferenceLine", this._scene);
    yLine.color = new Color3(0.0, 0.0, 1.0);
    yLine.isPickable = false;
    const yPositions: number[] = [
      0, 0, -halfSize,  // Start point
      0, 0, halfSize,   // End point
    ];
    const yIndices: number[] = [0, 1];
    
    const yVertexData = new VertexData();
    yVertexData.positions = yPositions;
    yVertexData.indices = yIndices;
    yVertexData.applyToMesh(yLine);

    // Store both lines for later disposal
    this._referenceLines = xLine; // Keep reference for disposal, but we'll handle both
    (this._referenceLines as any)._xLine = xLine;
    (this._referenceLines as any)._yLine = yLine;
  }

  /**
   * Setup adaptive grid that adjusts based on camera distance
   */
  private _setupAdaptiveGrid(): void {
    this._scene.onAfterRenderObservable.add(() => {
      if (!this._isEnabled || !this._ground) return;
      
      this._updateGridDensity();
    });
  }

  /**
   * Update grid density based on camera position
   */
  private _updateGridDensity(): void {
    const renderHeight = this._engine.getRenderHeight(true);
    
    // Handle both perspective and orthographic cameras
    let worldPerPixel: number;
    
    if (this._camera.mode === 1) { // Orthographic camera
      // For orthographic, use orthoRect to calculate world per pixel
      const orthoRect = (this._camera as any).orthoRect;
      if (orthoRect) {
        const worldWidth = orthoRect.width;
        worldPerPixel = worldWidth / renderHeight;
      } else {
        // Fallback for orthographic camera
        worldPerPixel = 0.1; // Default small value
      }
    } else { // Perspective camera
      const fov = this._camera.fov;
      const z = this._camera.radius;
      
      // Update fog based on camera distance
      this._scene.fogStart = z;
      this._scene.fogEnd = z + 1000;
      
      // Check if camera is close enough to lock grid step
      if (z <= this.DISTANCE_THRESHOLD) {
        // Lock grid step to minimum value when camera is close
        this._gridMaterial.gridRatio = this.MIN_GRID_STEP;
        this._gridMaterial.majorUnitFrequency = 1;
        return;
      }
      
      worldPerPixel = (2 * z * Math.tan(fov / 2)) / renderHeight;
    }
    
    // Calculate optimal grid step size
    const desiredWorldStep = worldPerPixel * this.TARGET_PX_PER_MINOR;
    
    // Find best grid step from available scales
    const scales = [1, 2, 5];
    const pow10 = Math.pow(10, Math.floor(Math.log10(desiredWorldStep)));
    let best = scales[0] * pow10;
    
    for (const s of scales) {
      const candidate = s * pow10;
      if (Math.abs(candidate - desiredWorldStep) < Math.abs(best - desiredWorldStep)) {
        best = candidate;
      }
    }
    
    // Ensure grid step is never smaller than minimum
    best = Math.max(best, this.MIN_GRID_STEP);
    
    // Update grid properties
    this._gridMaterial.gridRatio = best;
    this._gridMaterial.majorUnitFrequency = 10;
    
    // Don't notify observers here - it creates infinite recursion!
    // The grid update is already part of the render loop
  }

  /**
   * Update grid appearance
   */
  public updateAppearance(options: {
    mainColor?: Color3;
    lineColor?: Color3;
    opacity?: number;
    majorUnitFrequency?: number;
    minorUnitVisibility?: number;
    distanceThreshold?: number;
    minGridStep?: number;
  }): void {
    if (options.mainColor) {
      this._gridMaterial.mainColor = options.mainColor;
    }
    if (options.lineColor) {
      this._gridMaterial.lineColor = options.lineColor;
    }
    if (options.opacity !== undefined) {
      this._gridMaterial.opacity = options.opacity;
    }
    if (options.majorUnitFrequency !== undefined) {
      this._gridMaterial.majorUnitFrequency = options.majorUnitFrequency;
    }
    if (options.minorUnitVisibility !== undefined) {
      this._gridMaterial.minorUnitVisibility = options.minorUnitVisibility;
    }
    if (options.distanceThreshold !== undefined) {
      (this as any).DISTANCE_THRESHOLD = options.distanceThreshold;
    }
    if (options.minGridStep !== undefined) {
      (this as any).MIN_GRID_STEP = options.minGridStep;
    }
  }

  /**
   * Set grid size
   */
  public setSize(width: number, height: number): void {
    if (this._ground) {
      this._ground.dispose();
    }
    
    this.GRID_SIZE = Math.max(width, height);
    this._createGround();
  }

  /**
   * Check if grid is enabled
   */
  public get isEnabled(): boolean {
    return this._isEnabled;
  }

  /**
   * Dispose of the grid ground
   */
  public dispose(): void {
    this.disable();
    if (this._gridMaterial) {
      this._gridMaterial.dispose();
    }
    if (this._referenceLines) {
      // Dispose both X and Y reference lines
      const xLine = (this._referenceLines as any)._xLine;
      const yLine = (this._referenceLines as any)._yLine;
      
      if (xLine) {
        xLine.dispose();
      }
      if (yLine) {
        yLine.dispose();
      }
      
      this._referenceLines.dispose();
      this._referenceLines = null;
    }
  }
}
