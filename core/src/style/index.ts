import { Color3, type Scene, StandardMaterial } from "@babylonjs/core";
import { ClassicTheme } from "./presets/classic";
import type { AtomStyle, BondStyle, Theme } from "./theme";

export class StyleManager {
  private currentTheme: Theme;
  private scene: Scene;
  private materialCache: Map<string, StandardMaterial> = new Map();

  private globalAtomRadiusScale = 0.6;
  private globalBondRadiusScale = 0.6;

  constructor(scene: Scene) {
    this.scene = scene;
    // Default to ClassicTheme for backward compatibility during init
    this.currentTheme = new ClassicTheme();
    this.applyGlobalStyles();
  }

  public setTheme(theme: Theme) {
    this.currentTheme = theme;
    this.materialCache.clear(); // Invalidate cache on theme change
    this.applyGlobalStyles();
  }

  public setAtomRadiusScale(scale: number) {
    this.globalAtomRadiusScale = scale;
  }

  public setBondRadiusScale(scale: number) {
    this.globalBondRadiusScale = scale;
  }

  public getTheme(): Theme {
    return this.currentTheme;
  }

  public getAtomStyle(element: string): AtomStyle {
    const style = this.currentTheme.getAtomStyle(element);
    return {
      ...style,
      radius: style.radius * this.globalAtomRadiusScale,
    };
  }

  public getTypeStyle(type: string): AtomStyle {
    const style = this.currentTheme.getTypeStyle(type);
    return {
      ...style,
      radius: style.radius * this.globalAtomRadiusScale,
    };
  }

  public getBondStyle(order: number): BondStyle {
    const style = this.currentTheme.getBondStyle(order);
    return {
      ...style,
      radius: style.radius * this.globalBondRadiusScale,
    };
  }

  public getAtomMaterial(element: string): StandardMaterial {
    const key = `atom_${element}_${this.currentTheme.name}`;
    const cached = this.materialCache.get(key);
    if (cached) {
      return cached;
    }

    const style = this.currentTheme.getAtomStyle(element);
    const mat = new StandardMaterial(key, this.scene);
    mat.diffuseColor = Color3.FromHexString(style.color);

    if (style.specularColor) {
      mat.specularColor = Color3.FromHexString(style.specularColor);
    } else {
      mat.specularColor = Color3.FromHexString(
        this.currentTheme.defaultSpecular,
      );
    }

    if (style.emissiveColor) {
      mat.emissiveColor = Color3.FromHexString(style.emissiveColor);
    }

    if (style.alpha !== undefined) {
      mat.alpha = style.alpha;
    }

    this.materialCache.set(key, mat);
    return mat;
  }

  public getBondMaterial(order: number): StandardMaterial {
    const key = `bond_${order}_${this.currentTheme.name}`;
    const cached = this.materialCache.get(key);
    if (cached) {
      return cached;
    }

    const style = this.currentTheme.getBondStyle(order);
    const mat = new StandardMaterial(key, this.scene);
    mat.diffuseColor = Color3.FromHexString(style.color);

    if (style.specularColor) {
      mat.specularColor = Color3.FromHexString(style.specularColor);
    } else {
      mat.specularColor = Color3.FromHexString(
        this.currentTheme.defaultSpecular,
      );
    }

    if (style.alpha !== undefined) {
      mat.alpha = style.alpha;
    }

    this.materialCache.set(key, mat);
    return mat;
  }

  public getBoxMaterial(): StandardMaterial {
    const key = `box_${this.currentTheme.name}`;
    const cached = this.materialCache.get(key);
    if (cached) {
      return cached;
    }

    const mat = new StandardMaterial(key, this.scene);
    // mat.wireframe = true;
    mat.diffuseColor = Color3.FromHexString(this.currentTheme.boxColor); // Re-use selection color for box for now

    this.materialCache.set(key, mat);
    return mat;
  }

  private applyGlobalStyles() {
    // if (this.scene.clearColor) {
    //     const bg = Color3.FromHexString(this.currentTheme.backgroundColor);
    //     this.scene.clearColor = new Color4(bg.r, bg.g, bg.b, 1);
    // }
  }
}
