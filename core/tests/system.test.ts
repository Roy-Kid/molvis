import { System, Frame } from "../src/system";
import { Vector3 } from "@babylonjs/core";

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

  it("handles atoms and bonds", () => {
    const frame = new Frame();
    const sys = new System();
    sys.append_frame(frame);
    const a1 = frame.add_atom("a1", new Vector3(0,0,0), {});
    const a2 = frame.add_atom("a2", new Vector3(1,0,0), {});
    frame.add_bond(a1, a2);
    expect(frame.bonds.length).toBe(1);
    frame.remove_atom(a1);
    expect(frame.atoms.length).toBe(1);
    expect(frame.bonds.length).toBe(0);
  });
