import React, { useRef } from "react";
import { Molvis } from "@molvis/app";
import { Frame } from "@molvis/system";

const createRandomFrame = () => {
  const frame = new Frame();
  const x_offset = Math.random() * 10;
  const y_offset = Math.random() * 10;
  const z_offset = Math.random() * 10;
  frame.add_atom(new Map([["name", "C"], ["x", `${x_offset}`], ["y", `${y_offset}`], ["z", `${z_offset}`]]));
  frame.add_atom(new Map([["name", "O"], ["x", `${x_offset+3}`], ["y", `${y_offset}`], ["z", `${z_offset}`]]));
  return frame;
};

const Core = () => {

  const canvasRef = useRef<HTMLCanvasElement|null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const style = document.createElement('style');
    style.textContent = `
    html, body, root {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        }
    #molvisCanvas {
        width: 100%;
        height: 100%;
        touch-action: none;
        }
    `;
    document.head.appendChild(style);
    const molvis = new Molvis(canvas);

    molvis.render();

    return () => {
      // ...existing cleanup...
    };
  }, []);

  return (
    <>
      <canvas id="molvisCanvas" ref={canvasRef}/>
    </>
  );
};

export default Core;
