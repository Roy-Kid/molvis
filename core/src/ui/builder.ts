
import type { MenuItem } from '../mode/types';

export function createControl(item: MenuItem): HTMLElement | null {
    let el: HTMLElement | null = null;

    switch (item.type) {
        case 'button':
            el = document.createElement('molvis-button');
            (el as any).data = item;
            break;
        case 'separator':
            el = document.createElement('molvis-separator');
            break;
        case 'folder':
            el = document.createElement('molvis-folder');
            (el as any).data = item;
            break;
        case 'binding':
            el = document.createElement('molvis-slider');
            (el as any).data = item;
            break;
    }

    return el;
}
