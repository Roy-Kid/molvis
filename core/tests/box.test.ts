import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { Vector3 } from "@babylonjs/core";
import init, { Box } from 'molrs';

await init();

describe("Box", () => {
  describe("Orthogonal Box", () => {
    let box: Box;

    beforeEach(() => {
      // Create a 10x10x10 cubic box
      box = Box.box(new Vector3(10, 10, 10));
    });

    it("should create orthogonal box correctly", () => {
      expect(box).toBeDefined();
      expect(box.isOrtho()).toBe(true);
    });

    it("should have correct volume", () => {
      expect(box.getVolume()).toBeCloseTo(1000, 5);
    });

    it("should have correct bounds", () => {
      const bounds = box.getBounds();
      expect(bounds.x).toBeCloseTo(10, 5);
      expect(bounds.y).toBeCloseTo(10, 5);
      expect(bounds.z).toBeCloseTo(10, 5);
    });

    it("should have correct angles (90 degrees)", () => {
      const angles = box.getAngles();
      expect(angles.x).toBeCloseTo(90, 5);
      expect(angles.y).toBeCloseTo(90, 5);
      expect(angles.z).toBeCloseTo(90, 5);
    });

    it("should have correct PBC", () => {
      const pbc = box.getPBC();
      expect(pbc).toEqual([true, true, true]);
    });

    it("should have correct origin", () => {
      const origin = box.getOrigin();
      expect(origin.x).toBeCloseTo(0, 5);
      expect(origin.y).toBeCloseTo(0, 5);
      expect(origin.z).toBeCloseTo(0, 5);
    });

    it("should wrap coordinates correctly", () => {
      const pos = new Vector3(15, -5, 10.5);
      const wrapped = box.wrapSingle(pos);
      expect(wrapped.x).toBeCloseTo(5, 5);
      expect(wrapped.y).toBeCloseTo(5, 5);
      expect(wrapped.z).toBeCloseTo(0.5, 5);
    });

    it("should convert to fractional coordinates", () => {
      const pos = new Vector3(5, 5, 5);
      const frac = box.toFrac(pos);
      expect(frac.x).toBeCloseTo(0.5, 5);
      expect(frac.y).toBeCloseTo(0.5, 5);
      expect(frac.z).toBeCloseTo(0.5, 5);
    });

    it("should convert from fractional coordinates", () => {
      const frac = new Vector3(0.5, 0.5, 0.5);
      const cart = box.toCart(frac);
      expect(cart.x).toBeCloseTo(5, 5);
      expect(cart.y).toBeCloseTo(5, 5);
      expect(cart.z).toBeCloseTo(5, 5);
    });

    it("should calculate distance between faces correctly", () => {
      const distX = box.distBetweenFaces(0);
      const distY = box.distBetweenFaces(1);
      const distZ = box.distBetweenFaces(2);
      expect(distX).toBeCloseTo(10, 5);
      expect(distY).toBeCloseTo(10, 5);
      expect(distZ).toBeCloseTo(10, 5);
    });

    it("should calculate center correctly", () => {
      const center = box.getCenter();
      expect(center.x).toBeCloseTo(5, 5);
      expect(center.y).toBeCloseTo(5, 5);
      expect(center.z).toBeCloseTo(5, 5);
    });

    it("should check if position is inside box", () => {
      expect(box.isin(new Vector3(5, 5, 5))).toBe(true);
      expect(box.isin(new Vector3(0, 0, 0))).toBe(true);
      expect(box.isin(new Vector3(9.9, 9.9, 9.9))).toBe(true);
      expect(box.isin(new Vector3(10, 10, 10))).toBe(false);
      expect(box.isin(new Vector3(-1, 5, 5))).toBe(false);
    });

    it("should get lattice vectors correctly", () => {
      const a = box.getLattice(0);
      const b = box.getLattice(1);
      const c = box.getLattice(2);
      expect(a.x).toBeCloseTo(10, 5);
      expect(a.y).toBeCloseTo(0, 5);
      expect(a.z).toBeCloseTo(0, 5);
      expect(b.x).toBeCloseTo(0, 5);
      expect(b.y).toBeCloseTo(10, 5);
      expect(b.z).toBeCloseTo(0, 5);
      expect(c.x).toBeCloseTo(0, 5);
      expect(c.y).toBeCloseTo(0, 5);
      expect(c.z).toBeCloseTo(10, 5);
    });

    it("should get 8 corners", () => {
      const corners = box.get_corners();
      expect(corners).toHaveLength(8);
      // Check first corner (origin)
      expect(corners[0].x).toBeCloseTo(0, 5);
      expect(corners[0].y).toBeCloseTo(0, 5);
      expect(corners[0].z).toBeCloseTo(0, 5);
      // Check last corner (opposite to origin)
      expect(corners[7].x).toBeCloseTo(10, 5);
      expect(corners[7].y).toBeCloseTo(10, 5);
      expect(corners[7].z).toBeCloseTo(10, 5);
    });
  });

  describe("Triclinic Box", () => {
    let box: Box;

    beforeEach(() => {
      // Create a triclinic box with 60-degree angles
      const a = 10;
      const b = 10;
      const c = 10;
      const alpha = 60 * Math.PI / 180;
      const beta = 60 * Math.PI / 180;
      const gamma = 60 * Math.PI / 180;

      // Construct lattice vectors
      const ax = a;
      const ay = 0;
      const az = 0;

      const bx = b * Math.cos(gamma);
      const by = b * Math.sin(gamma);
      const bz = 0;

      const cx = c * Math.cos(beta);
      const cy = c * (Math.cos(alpha) - Math.cos(beta) * Math.cos(gamma)) / Math.sin(gamma);
      const cz = Math.sqrt(c * c - cx * cx - cy * cy);

      box = new Box([
        new Vector3(ax, ay, az),
        new Vector3(bx, by, bz),
        new Vector3(cx, cy, cz),
      ]);
    });

    it("should create triclinic box correctly", () => {
      expect(box).toBeDefined();
      expect(box.isOrtho()).toBe(false);
    });

    it("should have correct angles", () => {
      const angles = box.getAngles();
      expect(angles.x).toBeCloseTo(60, 1);
      expect(angles.y).toBeCloseTo(60, 1);
      expect(angles.z).toBeCloseTo(60, 1);
    });

    it("should wrap coordinates correctly", () => {
      const pos = new Vector3(15, 0, 0);
      const wrapped = box.wrapSingle(pos);
      // Should wrap back into the box
      const frac = box.toFrac(wrapped);
      expect(frac.x).toBeGreaterThanOrEqual(0);
      expect(frac.x).toBeLessThan(1);
    });

    it("should convert between Cartesian and fractional", () => {
      const cart = new Vector3(5, 5, 5);
      const frac = box.toFrac(cart);
      const cartBack = box.toCart(frac);
      expect(cartBack.x).toBeCloseTo(cart.x, 5);
      expect(cartBack.y).toBeCloseTo(cart.y, 5);
      expect(cartBack.z).toBeCloseTo(cart.z, 5);
    });

    it("should have positive volume", () => {
      expect(box.getVolume()).toBeGreaterThan(0);
    });
  });

  describe("Box with custom origin and PBC", () => {
    let box: Box;

    beforeEach(() => {
      box = new Box(
        [
          new Vector3(10, 0, 0),
          new Vector3(0, 10, 0),
          new Vector3(0, 0, 10),
        ],
        new Vector3(5, 5, 5),
        [true, true, false]
      );
    });

    it("should have correct origin", () => {
      const origin = box.getOrigin();
      expect(origin.x).toBeCloseTo(5, 5);
      expect(origin.y).toBeCloseTo(5, 5);
      expect(origin.z).toBeCloseTo(5, 5);
    });

    it("should have correct PBC", () => {
      const pbc = box.getPBC();
      expect(pbc).toEqual([true, true, false]);
    });

    it("should calculate center with offset origin", () => {
      const center = box.getCenter();
      expect(center.x).toBeCloseTo(10, 5);
      expect(center.y).toBeCloseTo(10, 5);
      expect(center.z).toBeCloseTo(10, 5);
    });
  });

  describe("Edge cases", () => {
    it("should throw error for invalid direction in distBetweenFaces", () => {
      const box = Box.box(new Vector3(10, 10, 10));
      expect(() => box.distBetweenFaces(-1)).toThrow();
      expect(() => box.distBetweenFaces(3)).toThrow();
    });

    it("should handle very small boxes", () => {
      const box = Box.box(new Vector3(0.1, 0.1, 0.1));
      expect(box.getVolume()).toBeCloseTo(0.001, 6);
    });

    it("should handle rectangular boxes", () => {
      const box = new Box([
        new Vector3(5, 0, 0),
        new Vector3(0, 10, 0),
        new Vector3(0, 0, 15),
      ]);
      expect(box.isOrtho()).toBe(true);
      const bounds = box.getBounds();
      expect(bounds.x).toBeCloseTo(5, 5);
      expect(bounds.y).toBeCloseTo(10, 5);
      expect(bounds.z).toBeCloseTo(15, 5);
    });
  });
});
