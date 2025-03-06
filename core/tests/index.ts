import { Molvis } from '../src/app';
import { ContextMenu, ContextMenuItem } from '../src/menu';

// Get the canvas element
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;

// Initialize Molvis
const app = new Molvis(canvas);

// Start rendering
app.render();

// Handle window resize
window.addEventListener('resize', () => {
    app.resize();
});
