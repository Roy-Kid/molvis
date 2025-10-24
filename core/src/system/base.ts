import { Vector3 } from "@babylonjs/core";

// Flexible metadata property type used across system models
export type IProp = string | number | boolean | Vector3 | null | undefined | Record<string, unknown> | Array<unknown>;
