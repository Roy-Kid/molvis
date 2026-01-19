import { MolvisElement } from '../base';
import type { MenuItem } from '../../mode/types';
import { createControl } from '../builder';

/**
 * MolvisFolder - Collapsible folder menu item with nested items
 */
export class MolvisFolder extends MolvisElement {
    private _data: MenuItem | null = null;
    private _rendered: boolean = false;

    set data(item: MenuItem) {
        this._data = item;
        if (!this._rendered) {
            this.render();
            this._rendered = true;
        }
    }

    connectedCallback() {
        // Don't render if already rendered via data setter
        if (!this._rendered) {
            this.render();
            this._rendered = true;
        }
    }

    protected override render(): void {
        // Clear previous content to prevent duplication
        this.root.innerHTML = '';

        this.injectSharedStyles();

        const style = document.createElement('style');
        style.textContent = `
            :host {
                display: block;
            }
            
            .folder-title {
                padding: 6px 12px;
                font-weight: 600;
                color: #aaa;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .folder-items {
                padding-left: 8px;
            }
        `;
        this.root.appendChild(style);

        const title = document.createElement('div');
        title.className = 'folder-title';
        title.textContent = this._data?.title || '';
        this.root.appendChild(title);

        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'folder-items';
        this.root.appendChild(itemsContainer);

        if (this._data?.items) {
            this._data.items.forEach(item => {
                const control = createControl(item);
                if (control) {
                    itemsContainer.appendChild(control);
                }
            });
        }
    }
}
