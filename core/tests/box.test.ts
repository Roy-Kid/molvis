import { describe, it, expect } from '@jest/globals';
import { Box } from '../src/structure/box';
import { Matrix, Vector3 } from '@babylonjs/core';

describe('Test Box', () => {
  it('constructs from lengths (orthogonal) and reports dimensions/angles', () => {
    const b = new Box([new Vector3(2, 0, 0), new Vector3(0, 3, 0), new Vector3(0, 0, 4)]); // angles default 90,90,90
    const dims = b.getBounds();
    expect(Math.abs(dims.x - 2)).toBeLessThan(1e-6);
    expect(Math.abs(dims.y - 3)).toBeLessThan(1e-6);
    expect(Math.abs(dims.z - 4)).toBeLessThan(1e-6);
    const angs = b.getAngles();
    expect(Math.abs(angs.x - 90)).toBeLessThan(1e-6);
    expect(Math.abs(angs.y - 90)).toBeLessThan(1e-6);
    expect(Math.abs(angs.z - 90)).toBeLessThan(1e-6);
    const pbc = b.getPBC();
    expect(pbc[0]).toBe(true);
    expect(pbc[1]).toBe(true);
    expect(pbc[2]).toBe(true);
  });

  it('fractional/cartesian conversions roundtrip', () => {
    const lengths = new Vector3(2, 3, 4);
    const b = Box.box(lengths);
    const f = new Vector3(0.25, 0.5, 0.75);
    const c = b.toCart(f);
    const back = b.toFrac(c);
    expect(Math.abs(back.x - f.x)).toBeLessThan(1e-6);
    expect(Math.abs(back.y - f.y)).toBeLessThan(1e-6);
    expect(Math.abs(back.z - f.z)).toBeLessThan(1e-6);
  });

  it('wraps positions into the cell', () => {
    const b = Box.box(new Vector3(10, 10, 10));
    const p = new Vector3(11.2, -0.3, 20.9);
    const w = b.wrapSingle(p);
    const f = b.toFrac(w);
    expect(f.x).toBeGreaterThanOrEqual(0);
    expect(f.x).toBeLessThan(1);
    expect(f.y).toBeGreaterThanOrEqual(0);
    expect(f.y).toBeLessThan(1);
    expect(f.z).toBeGreaterThanOrEqual(0);
    expect(f.z).toBeLessThan(1);
  });

  it('returns box vectors and reconstructs Babylon matrix', () => {
    const box1 = Box.box(new Vector3(2, 3, 4));
    const v1 = box1.getLattice(0);
    expect(Math.abs(v1.x - 2)).toBeLessThan(1e-6);
    expect(Math.abs(v1.y)).toBeLessThan(1e-6);
    expect(Math.abs(v1.z)).toBeLessThan(1e-6);
    const v2 = box1.getLattice(1);
    expect(Math.abs(v2.x)).toBeLessThan(1e-6);
    expect(Math.abs(v2.y - 3)).toBeLessThan(1e-6);
    expect(Math.abs(v2.z)).toBeLessThan(1e-6);
    const v3 = box1.getLattice(2);
    expect(Math.abs(v3.x)).toBeLessThan(1e-6);
    expect(Math.abs(v3.y)).toBeLessThan(1e-6);
    expect(Math.abs(v3.z - 4)).toBeLessThan(1e-6);


    const M: Vector3[] = box1.getMatrix();
    console.log(M);
    expect(Math.abs(M[0].x - 2)).toBeLessThan(1e-6);
    expect(Math.abs(M[1].y - 3)).toBeLessThan(1e-6);
    expect(Math.abs(M[2].z - 4)).toBeLessThan(1e-6);
  });

  it('distance_between_faces equals axis length for orthogonal boxes', () => {
    const b = Box.box(new Vector3(2, 3, 4));
    expect(Math.abs(b.distBetweenFaces(0) - 2)).toBeLessThan(1e-6);
    expect(Math.abs(b.distBetweenFaces(1) - 3)).toBeLessThan(1e-6);
    expect(Math.abs(b.distBetweenFaces(2) - 4)).toBeLessThan(1e-6);
  });
});
