import {Molvis} from './src/app';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const molvis = new Molvis(canvas);
molvis.render();


const atom1 = molvis.add_atom("1", 0, 0, 0, new Map());
const atom2 = molvis.add_atom("2", 2, 0, 0, new Map());
const atom3 = molvis.add_atom("3", 0, 2, 0, new Map());
const atom4 = molvis.add_atom("4", 0, 0, 2, new Map());
const atom5 = molvis.add_atom("5", 2, 2, 2, new Map());
molvis.add_bond(atom1, atom2);
molvis.add_bond(atom1, atom3);
molvis.add_bond(atom1, atom4);
molvis.add_bond(atom1, atom5);