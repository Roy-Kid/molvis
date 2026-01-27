import { Scene, StandardMaterial, Color3 } from "@babylonjs/core";
import { Theme, AtomStyle, BondStyle } from "./theme";
import { ClassicTheme } from "./presets/classic";

export class StyleManager {
    private currentTheme: Theme;
    private scene: Scene;
    private materialCache: Map<string, StandardMaterial> = new Map();

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

    public getTheme(): Theme {
        return this.currentTheme;
    }

    public getAtomStyle(element: string): AtomStyle {
        return this.currentTheme.getAtomStyle(element);
    }

    public getBondStyle(order: number): BondStyle {
        return this.currentTheme.getBondStyle(order);
    }

    public getAtomMaterial(element: string): StandardMaterial {
        const key = `atom_${element}_${this.currentTheme.name}`;
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key)!;
        }

        const style = this.currentTheme.getAtomStyle(element);
        const mat = new StandardMaterial(key, this.scene);
        mat.diffuseColor = Color3.FromHexString(style.color);

        if (style.specularColor) {
            mat.specularColor = Color3.FromHexString(style.specularColor);
        } else {
            mat.specularColor = Color3.FromHexString(this.currentTheme.defaultSpecular);
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
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key)!;
        }

        const style = this.currentTheme.getBondStyle(order);
        const mat = new StandardMaterial(key, this.scene);
        mat.diffuseColor = Color3.FromHexString(style.color);

        if (style.specularColor) {
            mat.specularColor = Color3.FromHexString(style.specularColor);
        } else {
            mat.specularColor = Color3.FromHexString(this.currentTheme.defaultSpecular);
        }

        if (style.alpha !== undefined) {
            mat.alpha = style.alpha;
        }

        this.materialCache.set(key, mat);
        return mat;
    }

    public getBoxMaterial(): StandardMaterial {
        const key = `box_${this.currentTheme.name}`;
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key)!;
        }

        const mat = new StandardMaterial(key, this.scene);
        mat.wireframe = true;
        mat.diffuseColor = Color3.FromHexString(this.currentTheme.selectionColor); // Re-use selection color for box for now

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
