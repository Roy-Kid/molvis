import { Molvis } from "../src/app";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

const molvis = new Molvis(canvas);
molvis.render();

const O = molvis.draw_atom("Oxygen", 0.6, 1.0, 1.631);
const H1 = molvis.draw_atom("Hydrogen1", 0.903, 0.913, 0.703);
const H2 = molvis.draw_atom("Hydrogen2", 0.047, 0.205, 1.784);
molvis.draw_bond(O, H1);
molvis.draw_bond(O, H2);

molvis.label_atom("name");