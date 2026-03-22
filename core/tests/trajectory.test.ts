import { describe, expect, it } from "@rstest/core";
import { Frame } from "molrs-wasm";
import "./setup_wasm";
import { Trajectory } from "../src/system/trajectory";

function makeFrames(n: number): Frame[] {
  return Array.from({ length: n }, () => new Frame());
}

describe("Trajectory", () => {
  describe("constructor", () => {
    it("should initialize with frames", () => {
      const traj = new Trajectory(makeFrames(3));
      expect(traj.length).toBe(3);
      expect(traj.currentIndex).toBe(0);
    });

    it("should handle empty trajectory", () => {
      const traj = new Trajectory([]);
      expect(traj.length).toBe(0);
      expect(traj.currentFrame).toBeTruthy(); // returns new Frame()
    });
  });

  describe("next / prev", () => {
    it("next should advance index", () => {
      const traj = new Trajectory(makeFrames(3));
      expect(traj.next()).toBe(true);
      expect(traj.currentIndex).toBe(1);
    });

    it("next should return false at last frame", () => {
      const traj = new Trajectory(makeFrames(2));
      traj.next();
      expect(traj.next()).toBe(false);
      expect(traj.currentIndex).toBe(1);
    });

    it("prev should go backward", () => {
      const traj = new Trajectory(makeFrames(3));
      traj.next();
      traj.next();
      expect(traj.prev()).toBe(true);
      expect(traj.currentIndex).toBe(1);
    });

    it("prev should return false at first frame", () => {
      const traj = new Trajectory(makeFrames(3));
      expect(traj.prev()).toBe(false);
      expect(traj.currentIndex).toBe(0);
    });

    it("next/prev on empty trajectory returns false", () => {
      const traj = new Trajectory([]);
      expect(traj.next()).toBe(false);
      expect(traj.prev()).toBe(false);
    });
  });

  describe("seek", () => {
    it("should jump to index", () => {
      const traj = new Trajectory(makeFrames(10));
      expect(traj.seek(5)).toBe(true);
      expect(traj.currentIndex).toBe(5);
    });

    it("should clamp to last frame", () => {
      const traj = new Trajectory(makeFrames(5));
      traj.seek(100);
      expect(traj.currentIndex).toBe(4);
    });

    it("should clamp negative to 0", () => {
      const traj = new Trajectory(makeFrames(5));
      traj.seek(2);
      traj.seek(-10);
      expect(traj.currentIndex).toBe(0);
    });

    it("should return false if already at target", () => {
      const traj = new Trajectory(makeFrames(5));
      expect(traj.seek(0)).toBe(false);
    });

    it("should return false for empty trajectory", () => {
      const traj = new Trajectory([]);
      expect(traj.seek(0)).toBe(false);
    });
  });

  describe("addFrame", () => {
    it("should grow the trajectory", () => {
      const traj = new Trajectory(makeFrames(2));
      expect(traj.length).toBe(2);
      traj.addFrame(new Frame());
      expect(traj.length).toBe(3);
    });
  });

  describe("replaceFrame", () => {
    it("should replace frame at valid index", () => {
      const traj = new Trajectory(makeFrames(3));
      const newFrame = new Frame();
      expect(traj.replaceFrame(1, newFrame)).toBe(true);
    });

    it("should return false for out-of-range index", () => {
      const traj = new Trajectory(makeFrames(3));
      expect(traj.replaceFrame(10, new Frame())).toBe(false);
      expect(traj.replaceFrame(-1, new Frame())).toBe(false);
    });
  });

  describe("fromProvider (lazy)", () => {
    it("should support lazy frame loading", () => {
      const frames = makeFrames(5);
      const provider = {
        length: frames.length,
        get(index: number) {
          return frames[index];
        },
      };
      const traj = Trajectory.fromProvider(provider);
      expect(traj.length).toBe(5);
      expect(traj.currentIndex).toBe(0);
      traj.seek(3);
      expect(traj.currentIndex).toBe(3);
    });
  });
});
