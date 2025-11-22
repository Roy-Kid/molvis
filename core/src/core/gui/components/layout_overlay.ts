import { BaseGuiComponent } from "../component";
import { ViewManager, LayoutNode, SplitNode, LeafNode } from "../../../core/view_manager";

export class LayoutOverlay extends BaseGuiComponent {
    private _viewManager: ViewManager;

    constructor(viewManager: ViewManager) {
        super("div", "layout-overlay");
        this._viewManager = viewManager;

        this.applyStyles({
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            position: "absolute",
            top: "0",
            left: "0",
        });

        // Listen to layout changes
        this._viewManager.setOnLayoutChanged(() => {
            this._updateOverlay();
        });

        // Initial update
        this._updateOverlay();
    }

    private _updateOverlay(): void {
        this._element.innerHTML = "";
        this._renderNode(this._viewManager.root);
    }

    private _renderNode(node: LayoutNode): void {
        if (node.type === "leaf") {
            this._renderLeaf(node as LeafNode);
        } else {
            const split = node as SplitNode;
            this._renderNode(split.children[0]);
            this._renderNode(split.children[1]);
        }
    }

    private _renderLeaf(node: LeafNode): void {
        const isActive = node.id === this._viewManager.getActiveLeafId();

        // Create panel container
        const panel = document.createElement("div");
        Object.assign(panel.style, {
            position: "absolute",
            left: `${node.x * 100}%`,
            top: `${node.y * 100}%`,
            width: `${node.width * 100}%`,
            height: `${node.height * 100}%`,
            boxSizing: "border-box",
            border: isActive ? "2px solid #0078d4" : "2px solid #444", // Increased thickness
            pointerEvents: "none",
            zIndex: "10", // Ensure it's on top of other things in center area
        });

        // Create header/tab bar
        const header = document.createElement("div");
        Object.assign(header.style, {
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "24px",
            background: isActive ? "#252526" : "#1e1e1e",
            display: "flex",
            alignItems: "center",
            padding: "0 4px",
            pointerEvents: "auto",
            boxSizing: "border-box",
        });

        // Tab title
        const title = document.createElement("span");
        title.textContent = `View ${node.cameraIndex + 1}`;
        Object.assign(title.style, {
            color: "#ccc",
            fontSize: "12px",
            flex: "1",
            userSelect: "none",
        });

        // Split buttons
        const controls = document.createElement("div");
        Object.assign(controls.style, {
            display: "flex",
            gap: "4px",
        });

        const close = this._createButton("X", "Close Panel", () => {
            this._viewManager.close(node.id);
        });

        controls.appendChild(close);

        header.appendChild(title);
        header.appendChild(controls);
        panel.appendChild(header);

        header.addEventListener("mousedown", () => {
            this._viewManager.setActiveLeaf(node.id);
        });

        this._element.appendChild(panel);
    }

    private _createButton(text: string, title: string, onClick: () => void): HTMLElement {
        const btn = document.createElement("button");
        btn.textContent = text;
        btn.title = title;
        Object.assign(btn.style, {
            background: "transparent",
            border: "none",
            color: "#ccc",
            cursor: "pointer",
            fontSize: "10px",
            padding: "2px 4px",
            borderRadius: "2px",
        });

        btn.onmouseover = () => { btn.style.background = "#3e3e42"; };
        btn.onmouseout = () => { btn.style.background = "transparent"; };
        btn.onclick = (e) => {
            e.stopPropagation();
            onClick();
        };

        return btn;
    }
}
