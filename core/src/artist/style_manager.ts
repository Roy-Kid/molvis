import { Color3, type Scene, StandardMaterial } from "@babylonjs/core";
import { ClassicTheme } from "./presets/classic";
import { BALL_AND_STICK, type RepresentationStyle } from "./representation";
import type { AtomStyle, BondStyle, Theme } from "./theme";

export class StyleManager {
  private currentTheme: Theme;
  private scene: Scene;
  private materialCache: Map<string, StandardMaterial> = new Map();

  private _representation: RepresentationStyle = BALL_AND_STICK;

  constructor(scene: Scene) {
    this.scene = scene;
    this.currentTheme = new ClassicTheme();
  }

  public setTheme(theme: Theme) {
    this.currentTheme = theme;
    this.materialCache.clear();
  }

  public setRepresentation(repr: RepresentationStyle) {
    this._representation = repr;
  }

  public getRepresentation(): RepresentationStyle {
    return this._representation;
  }

  public setAtomRadiusScale(scale: number) {
    this._representation = {
      ...this._representation,
      atomRadiusScale: scale,
      name: "Custom",
    };
  }

  public setBondRadiusScale(scale: number) {
    this._representation = {
      ...this._representation,
      bondRadiusScale: scale,
      name: "Custom",
    };
  }

  public getAtomRadiusScale(): number {
    return this._representation.atomRadiusScale;
  }

  public getBondRadiusScale(): number {
    return this._representation.bondRadiusScale;
  }

  public getTheme(): Theme {
    return this.currentTheme;
  }

  public getAtomStyle(element: string): AtomStyle {
    const style = this.currentTheme.getAtomStyle(element);
    return {
      ...style,
      radius: style.radius * this._representation.atomRadiusScale,
    };
  }

  public getTypeStyle(type: string): AtomStyle {
    const style = this.currentTheme.getTypeStyle(type);
    return {
      ...style,
      radius: style.radius * this._representation.atomRadiusScale,
    };
  }

  public getBondStyle(order: number): BondStyle {
    const style = this.currentTheme.getBondStyle(order);
    return {
      ...style,
      radius: style.radius * this._representation.bondRadiusScale,
    };
  }

  public getAtomMaterial(element: string): StandardMaterial {
    const key = `atom_${element}_${this.currentTheme.name}`;
    const cached = this.materialCache.get(key);
    if (cached) return cached;

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
    if (cached) return cached;

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
    if (cached) return cached;

    const mat = new StandardMaterial(key, this.scene);
    mat.diffuseColor = Color3.FromHexString(this.currentTheme.boxColor);

    this.materialCache.set(key, mat);
    return mat;
  }
}
