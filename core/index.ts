import {Molvis} from './src/app';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const molvis = new Molvis(canvas);
molvis.render();