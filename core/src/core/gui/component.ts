export interface GuiComponent {
    /**
     * The root HTML element of the component.
     */
    readonly element: HTMLElement;

    /**
     * Mount the component to a parent container.
     */
    mount(container: HTMLElement): void;

    /**
     * Unmount the component from its parent.
     */
    unmount(): void;

    /**
     * Show the component.
     */
    show(): void;

    /**
     * Hide the component.
     */
    hide(): void;

    /**
     * Dispose of the component and clean up resources.
     */
    dispose(): void;
}

export abstract class BaseGuiComponent implements GuiComponent {
    protected _element: HTMLElement;
    protected _container: HTMLElement | null = null;

    constructor(tagName: string = "div", className?: string) {
        this._element = document.createElement(tagName);
        if (className) {
            this._element.className = className;
        }
    }

    get element(): HTMLElement {
        return this._element;
    }

    mount(container: HTMLElement): void {
        this._container = container;
        this._container.appendChild(this._element);
    }

    unmount(): void {
        if (this._element.parentNode) {
            this._element.parentNode.removeChild(this._element);
        }
        this._container = null;
    }

    show(): void {
        this._element.style.display = "";
    }

    hide(): void {
        this._element.style.display = "none";
    }

    dispose(): void {
        this.unmount();
    }

    protected applyStyles(styles: Partial<CSSStyleDeclaration>): void {
        Object.assign(this._element.style, styles);
    }
}
