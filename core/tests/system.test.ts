import { describe, expect, it } from "@rstest/core";
import { Frame } from "molrs-wasm";
import "./setup_wasm";
import { EventEmitter, type MolvisEventMap } from "../src/events";
import { System } from "../src/system";
import { Trajectory } from "../src/system/trajectory";

function makeFrames(n: number): Frame[] {
  const frames: Frame[] = [];
  for (let i = 0; i < n; i++) {
    frames.push(new Frame());
  }
  return frames;
}

describe("System", () => {
  describe("initialization", () => {
    it("should initialize with an empty frame", () => {
      const system = new System();
      expect(system.trajectory.length).toBe(1);
      expect(system.frame).toBeTruthy();
    });
  });

  describe("trajectory setter", () => {
    it("should emit trajectory-change and frame-change events", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      const received: string[] = [];

      events.on("trajectory-change", () => received.push("trajectory-change"));
      events.on("frame-change", () => received.push("frame-change"));

      system.trajectory = new Trajectory(makeFrames(5));
      expect(received).toContain("trajectory-change");
      expect(received).toContain("frame-change");
    });
  });

  describe("setFrame", () => {
    it("should wrap frame in single-frame trajectory", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      system.setFrame(new Frame());
      expect(system.trajectory.length).toBe(1);
      expect(system.trajectory.currentIndex).toBe(0);
    });

    it("should emit frame-change event", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      let frameIdx = -1;
      events.on("frame-change", (idx) => {
        frameIdx = idx;
      });
      system.setFrame(new Frame());
      expect(frameIdx).toBe(0);
    });
  });

  describe("navigation", () => {
    it("nextFrame should advance and emit event", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      system.trajectory = new Trajectory(makeFrames(3));

      let lastIdx = -1;
      events.on("frame-change", (idx) => {
        lastIdx = idx;
      });

      expect(system.nextFrame()).toBe(true);
      expect(lastIdx).toBe(1);
      expect(system.trajectory.currentIndex).toBe(1);
    });

    it("nextFrame should return false at end", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      system.trajectory = new Trajectory(makeFrames(2));

      system.nextFrame();
      expect(system.nextFrame()).toBe(false);
    });

    it("prevFrame should go back and emit event", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      system.trajectory = new Trajectory(makeFrames(3));

      system.nextFrame();
      system.nextFrame();
      expect(system.prevFrame()).toBe(true);
      expect(system.trajectory.currentIndex).toBe(1);
    });

    it("prevFrame should return false at start", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      system.trajectory = new Trajectory(makeFrames(3));

      expect(system.prevFrame()).toBe(false);
    });

    it("seekFrame should jump to specific index", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      system.trajectory = new Trajectory(makeFrames(10));

      let lastIdx = -1;
      events.on("frame-change", (idx) => {
        lastIdx = idx;
      });

      expect(system.seekFrame(5)).toBe(true);
      expect(lastIdx).toBe(5);
    });

    it("seekFrame should return false for same index", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      system.trajectory = new Trajectory(makeFrames(5));

      expect(system.seekFrame(0)).toBe(false);
    });

    it("seekFrame should clamp to valid range", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      system.trajectory = new Trajectory(makeFrames(5));

      system.seekFrame(100);
      expect(system.trajectory.currentIndex).toBe(4);
    });
  });

  describe("updateCurrentFrame", () => {
    it("should replace current frame in-place", () => {
      const events = new EventEmitter<MolvisEventMap>();
      const system = new System(events);
      const frames = makeFrames(3);
      system.trajectory = new Trajectory(frames);

      let emitted = false;
      events.on("frame-change", () => {
        emitted = true;
      });

      const newFrame = new Frame();
      system.updateCurrentFrame(newFrame);
      expect(emitted).toBe(true);
    });
  });
});
