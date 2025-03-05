import { Frame } from "../src/system";
import { Trajectory } from "../src/system"; // or destructure it if it's exported separately

describe("Trajectory", () => {
  it("starts empty and creates a default frame on get", () => {
    const traj = new Trajectory();
    expect(traj.currentFrame).toBeDefined();
    expect(traj.frames.length).toBe(1);
  });

  it("manages multiple frames", () => {
    const traj = new Trajectory();
    traj.addFrame(new Frame());
    traj.addFrame(new Frame());
    expect(traj.frames.length).toBe(2);
  });

  it("navigates frames correctly", () => {
    const traj = new Trajectory();
    traj.addFrame(new Frame());
    const secondFrame = new Frame();
    traj.addFrame(secondFrame);
    traj.nextFrame();
    expect(traj.currentFrame).toBe(secondFrame);
    traj.prevFrame();
    expect(traj.currentFrame).toBeDefined();
  });
});
