import { MolvisElement } from '../base';

/**
 * MolvisSeparator - Horizontal divider line for menu sections
 */
export class MolvisSeparator extends MolvisElement {
    protected override render(): void {
        this.injectSharedStyles();

        const style = document.createElement('style');
        style.textContent = `
            :host {
                display: block;
                margin: 4px 0;
            }
            
            .separator {
                height: 1px;
                background: var(--border-color);
                margin: 0 8px;
            }
        `;
        this.root.appendChild(style);

        const separator = document.createElement('div');
        separator.className = 'separator';
        this.root.appendChild(separator);
    }
}
