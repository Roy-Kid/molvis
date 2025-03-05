import { System, Frame } from "../src/system";

describe("System", () => {
  it("creates a trajectory and adds frames", () => {
    const sys = new System();
    sys.append_frame(new Frame());
    expect(sys.trajectory.frames.length).toBe(1);
  });

  it("advances frames in the trajectory", () => {
    const sys = new System();
    sys.append_frame(new Frame());
    sys.append_frame(new Frame());
    sys.trajectory.nextFrame();
    expect(sys.trajectory.currentFrame).toBe(sys.trajectory.frames[1]);
  });
});
