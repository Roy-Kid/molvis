import { MolvisElement } from '../base';
import type { MenuItem } from '../../mode/types';

/**
 * MolvisSlider - Interactive binding control (dropdown, slider, etc.)
 * Currently implements dropdown list functionality
 */
export class MolvisSlider extends MolvisElement {
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
        // Clear previous content
        this.root.innerHTML = '';

        this.injectSharedStyles();

        const style = document.createElement('style');
        style.textContent = `
            :host {
                display: block;
            }
            
            .binding {
                padding: 6px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .binding-label {
                font-size: 11px;
                color: #ddd;
                margin-right: 12px;
            }
            
            .binding-control {
                display: flex;
                align-items: center;
            }
            
            input[type="checkbox"] {
                cursor: pointer;
                width: 16px;
                height: 16px;
            }
            
            select {
                flex: 1;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid var(--border-color);
                border-radius: 3px;
                color: #ddd;
                padding: 4px 8px;
                font-size: 11px;
                font-family: inherit;
                cursor: pointer;
                outline: none;
            }
            
            select:hover {
                background: rgba(255, 255, 255, 0.08);
            }
            
            select:focus {
                border-color: var(--accent-color);
            }
            
            option {
                background: #1a1a1a;
                color: #ddd;
            }
        `;
        this.root.appendChild(style);

        const container = document.createElement('div');
        container.className = 'binding';

        const config = this._data?.bindingConfig;

        if (config?.label) {
            const label = document.createElement('div');
            label.className = 'binding-label';
            label.textContent = config.label;
            container.appendChild(label);
        }

        const controlContainer = document.createElement('div');
        controlContainer.className = 'binding-control';

        // Checkbox view support
        if (config?.view === 'checkbox') {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = !!config.value;

            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const target = e.target as HTMLInputElement;
                console.log('[MolvisSlider] Checkbox changed:', target.checked);
                if (this._data?.action) {
                    this._data.action({ value: target.checked });
                }
            });

            controlContainer.appendChild(checkbox);
        }
        else if (config?.view === 'list') {
            // Dropdown list
            const select = document.createElement('select');

            if (config.options) {
                config.options.forEach((option: any) => {
                    const optionEl = document.createElement('option');
                    optionEl.value = option.value;
                    optionEl.textContent = option.text;

                    if (option.value === config.value) {
                        optionEl.selected = true;
                    }

                    select.appendChild(optionEl);
                });
            }

            select.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent click-through when opening dropdown
            });

            select.addEventListener('change', (e) => {
                e.stopPropagation();
                const target = e.target as HTMLSelectElement;
                const value = target.value;

                // Try to parse as number if it looks like a number
                const parsedValue = isNaN(Number(value)) ? value : Number(value);

                console.log('[MolvisSlider] Select changed:', parsedValue);
                if (this._data?.action) {
                    this._data.action({ value: parsedValue });
                }
            });

            controlContainer.appendChild(select);
        }

        container.appendChild(controlContainer);
        this.root.appendChild(container);
    }
}
