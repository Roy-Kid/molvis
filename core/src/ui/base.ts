export const SHARED_CSS = `
    :host {
        display: block;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        font-size: 11px;
        color: #ddd;
        --bg-color: rgba(20, 20, 20, 0.9);
        --hover-color: rgba(255, 255, 255, 0.1);
        --accent-color: #09f;
        --border-color: rgba(255, 255, 255, 0.1);
    }
    
    * {
        box-sizing: border-box;
    }
`;

export class MolvisElement extends HTMLElement {
  protected root: ShadowRoot;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
  }

  protected render() {
    // Override in subclasses
  }

  protected addEncodedStyles(css: string) {
    const style = document.createElement("style");
    style.textContent = css;
    this.root.appendChild(style);
  }

  protected injectSharedStyles() {
    this.addEncodedStyles(SHARED_CSS);
  }
}
