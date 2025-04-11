import type { AbstractMesh } from '@babylonjs/core';
import { Molvis } from '..';
import { Pipeline } from '../pipeline';
import { IEntity } from '../system/base';

const artistRegistry = new Map<string, ArtistConstructor>();
const registerArtist = (name: string) => {
    return (target: ArtistConstructor) => {
        artistRegistry.set(name, target);
    };
}
interface IArtist {
    draw(item: any): AbstractMesh[];
    undraw(item: any): AbstractMesh[];
}
interface ArtistConstructor {
    new(entity: IEntity[]): IArtist;
}

class ArtistGuild {

    private _app: Molvis;
    private _artists: IArtist[] = [];
    private _pipeline: Pipeline;

    constructor(app: Molvis) {
        this._app = app;
        this._pipeline = new Pipeline();
    }

    private get _scene() {
        return this._app.world.scene;
    }

    public do(name: string, entity: IEntity[]): AbstractMesh[] {
        const artist = artistRegistry.get(name);
        if (!artist) {
            throw new Error(`Artist ${name} not found`);
        }
        const instance = new artist(entity);
        const meshes = instance.draw(this._scene);
        this._pipeline.modify(meshes, entity);

        return meshes;

    }
}

export { registerArtist, artistRegistry, ArtistGuild };
export type { IArtist, ArtistConstructor };