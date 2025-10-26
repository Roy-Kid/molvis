import type { Scene } from "@babylonjs/core";
import { registerArtistDecoratedCommands } from "./base";
import type { ArtistBase } from "./base";

export type ArtistCtor = new (scene: Scene, id?: string) => ArtistBase;

export class ArtistRegistry {
  private readonly artists = new Map<string, ArtistCtor>();

  register(name: string, ctor: ArtistCtor): void {
    if (this.artists.has(name)) {
      throw new Error(`Artist "${name}" is already registered.`);
    }
    this.artists.set(name, ctor);
  }

  create(name: string, scene: Scene, id?: string): ArtistBase {
    const artist = this.instantiate(name, scene, id);
    registerArtistDecoratedCommands(artist);
    void artist.init();
    return artist;
  }

  list(): string[] {
    return Array.from(this.artists.keys());
  }

  private instantiate(name: string, scene: Scene, id?: string): ArtistBase {
    const ctor = this.artists.get(name);

    if (!ctor) {
      const available = this.list();
      const hint = available.length > 0 ? ` Registered artists: ${available.join(", ")}` : "";
      throw new Error(`Unknown artist "${name}".${hint}`);
    }

    return new ctor(scene, id);
  }
}
