import { Molvis } from "../src/app";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

const molvis = new Molvis(canvas);
molvis.render();

const O = molvis.draw_atom(new Map<string, any>([
  ["name", "Oxygen"],
  ["x", 0.5],
  ["y", 0.5],
  ["z", 0.5],
  ["element", "O"],
  ["id", 0],
]));
const H1 = molvis.draw_atom(new Map<string, any>([
  ["name", "Hydrogen1"],
  ["x", 0.953],
  ["y", 0.205],
  ["z", 0.216],
  ["element", "H"],
  ["id", 1],
]));
const H2 = molvis.draw_atom(new Map<string, any>([
  ["name", "Hydrogen2"],
  ["x", 0.205],
  ["y", 0.953],
  ["z", 0.216],
  ["element", "H"],
  ["id", 2],
]));

molvis.draw_bond(O, H1);
molvis.draw_bond(O, H2);

molvis.label_atom("name");

