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

// Start rendering
app.render();

console.log('Molvis initialized');

// Handle window resize
window.addEventListener('resize', () => {
    app.resize();
});
