import { Vector3 } from "@babylonjs/core";

type Prop = number | string | Vector3 | boolean;

interface IEntity {
    get(key: string): Prop;
}

export type { IEntity, Prop };