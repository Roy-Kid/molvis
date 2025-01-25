import React from "react";
import { Molvis } from "molvis";

const Core = () => {
  React.useEffect(() => {
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;

    const molvis = new Molvis(canvas);
    molvis.render();

    return () => {
      document.body.removeChild(canvas);
    };
  }, []);

  return <canvas id="canvas"></canvas>;
};

export default Core;
