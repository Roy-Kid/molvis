import { Molvis } from '../src/app';

document.documentElement.lang = 'en';
document.head.insertAdjacentHTML('afterbegin', `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
`);
const canvas = document.createElement('canvas') as HTMLCanvasElement;
canvas.id = 'molvisCanvas';
const style = document.createElement('style');
style.textContent = `
html, body {
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
document.body.appendChild(canvas);
document.head.appendChild(style);


// Initialize Molvis
const app = new Molvis(canvas);

// app.execute("draw_frame", {
//     x: [0.00000, 0.75695, -0.75695],
//     y: [-0.06556, 0.52032, 0.52032],
//     z: [0.00000, 0.00000, 0.00000],
//     name: ["O", "H", "H"],
//     element: ["O", "H", "H"],
//     bond_i: [0, 0],
//     bond_j: [1, 2],
// })
app.execute("draw_atom", {
    x: 0.00000,
    y: -0.06556,
    z: 0.00000,
    name: "O",
    element: "O",
});

app.render();

console.log('Molvis initialized');

// Handle window resize
window.addEventListener('resize', () => {
    app.resize();
});
