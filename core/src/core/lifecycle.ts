import { World } from "../world";
import { ModeManager } from "../mode";
import { Executor } from "../command";
import { GuiManager } from "../gui";
import { InstancedArtist, DynamicArtist } from "../artist";
import type { ArtistBase } from "../artist";
import type { ResolvedMolvisOptions, MolvisOptions } from "../dom/options";
import { DomManager } from "../dom/dom-manager";

export class Lifecycle {
  private _world!: World;
  private _mode!: ModeManager;
  private _executor!: Executor;
  private _gui!: GuiManager;
  private _artists = new Map<string, ArtistBase>();
  private _domManager: DomManager;
  private _options: ResolvedMolvisOptions;

  constructor(domManager: DomManager, options: ResolvedMolvisOptions) {
    this._domManager = domManager;
    this._options = options;
  }

  public init(): void {
    this._world = new World(this._domManager.canvas);
    this._gui = new GuiManager(this as any, this._domManager.uiContainer, this._options.uiComponents);
    this._mode = new ModeManager(this as any);
    this._executor = new Executor(this as any);
    this._initializeArtists();
  }

  private _initializeArtists(): void {
    const instancedArtist = new InstancedArtist(this._world.scene, "instanced");
    this._artists.set("instanced", instancedArtist);
    this._executor.registerArtist("instanced", instancedArtist);

    const dynamicArtist = new DynamicArtist(this._world.scene, "dynamic");
    this._artists.set("dynamic", dynamicArtist);
    this._executor.registerArtist("dynamic", dynamicArtist);

    void instancedArtist.init();
    void dynamicArtist.init();
  }

  public get world(): World {
    return this._world;
  }

  public get mode(): ModeManager {
    return this._mode;
  }

  public get executor(): Executor {
    return this._executor;
  }

  public get artists(): Map<string, ArtistBase> {
    return this._artists;
  }

  public get gui(): GuiManager {
    return this._gui;
  }

  public get canvas(): HTMLCanvasElement {
    return this._domManager.canvas;
  }

  public get scene() {
    return this._world.scene;
  }

  public get options(): MolvisOptions {
    return { ...this._options, uiComponents: { ...this._options.uiComponents } };
  }

  public get displaySize(): { width: number; height: number } {
    return this._domManager.displaySize;
  }

  public get renderResolution(): { width: number; height: number } {
    return this._domManager.renderResolution;
  }

  public get pixelRatio(): number {
    return this._domManager.pixelRatio;
  }

  public get isRunning(): boolean {
    return this._world.isRunning;
  }

  public start(): void {
    if (!this._world.isRunning) {
      this._world.render();
    }
  }

  public stop(): void {
    if (this._world.isRunning) {
      this._world.stop();
    }
  }

  public resize(): void {
    this._world.resize();
  }

  public destroy(): void {
    if (this._world) {
      this._world.stop();
    }

    this._gui?.dispose();

    this._domManager.destroy();
  }
}