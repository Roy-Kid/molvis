import {Molvis} from './src/app';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const molvis = new Molvis(canvas);
molvis.render();

// const params: object = {x: 3.0, y: 4.0, z: 1.0}
// molvis.add_atom(...Object.values(params || {}));
// molvis.exec_cmd({jsonrpc: '2.0', method: 'add_atom', params: {x: 3.0, y: 4.0, z: 1.0}}, []);