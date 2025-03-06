import React from "react";
import { Molvis } from "molvis";
import { Frame } from "molvis/src/system";

const Core = () => {
  React.useEffect(() => {
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;

    const molvis = new Molvis(canvas);
    molvis.append_frame(new Frame());
    molvis.append_frame(new Frame());
    molvis.append_frame(new Frame());

    molvis.render();

    return () => {
      document.body.removeChild(canvas);
    };
  }, []);

  return <canvas id="canvas"></canvas>;
};

export default Core;
