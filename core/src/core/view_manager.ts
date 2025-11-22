import {
    ArcRotateCamera,
    Color3,
    Engine,
    Scene,
    Vector3,
    Viewport,
} from "@babylonjs/core";
import { createLogger } from "../utils/logger";

const logger = createLogger("view-manager");

export enum SplitDirection {
    Horizontal = "horizontal",
    Vertical = "vertical",
}

export interface LayoutNode {
    id: string;
    type: "split" | "leaf";
    parent?: SplitNode;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SplitNode extends LayoutNode {
    type: "split";
    direction: SplitDirection;
    ratio: number; // 0 to 1, position of the split
    children: [LayoutNode, LayoutNode];
}

export interface LeafNode extends LayoutNode {
    type: "leaf";
    cameraIndex: number;
}

export class ViewManager {
    private _scene: Scene;
    private _engine: Engine;
    private _cameras: ArcRotateCamera[] = [];
    private _root: LayoutNode;
    private _activeLeafId: string | null = null;
    private _nodeMap: Map<string, LayoutNode> = new Map();
    private _onLayoutChanged?: () => void;

    constructor(scene: Scene, engine: Engine) {
        this._scene = scene;
        this._engine = engine;
        this._initCameras();

        // Initial single view
        this._root = {
            id: "root",
            type: "leaf",
            cameraIndex: 0,
            x: 0,
            y: 0,
            width: 1,
            height: 1
        } as LeafNode;
        this._nodeMap.set(this._root.id, this._root);
        this._activeLeafId = this._root.id;

        this._updateViewports();
    }

    private _initCameras() {
        // Create a pool of cameras. 
        // We can dynamically add more if needed, but starting with a fixed pool is easier.
        for (let i = 0; i < 16; i++) {
            const camera = new ArcRotateCamera(
                `Camera_${i}`,
                -Math.PI / 2,
                Math.PI / 6,
                12,
                Vector3.Zero(),
                this._scene
            );
            camera.lowerRadiusLimit = 5;
            camera.inertia = 0;
            // Initially detach control
            camera.detachControl();
            this._cameras.push(camera);
        }
    }

    public get root(): LayoutNode {
        return this._root;
    }

    public get activeCamera(): ArcRotateCamera | null {
        if (!this._activeLeafId) return null;
        const node = this._nodeMap.get(this._activeLeafId) as LeafNode;
        if (!node || node.type !== "leaf") return null;
        return this._cameras[node.cameraIndex];
    }

    public get cameras(): ArcRotateCamera[] {
        return this._cameras;
    }

    public setOnLayoutChanged(callback: () => void) {
        this._onLayoutChanged = callback;
    }

    public split(targetNodeId: string, direction: SplitDirection): void {
        const targetNode = this._nodeMap.get(targetNodeId);
        if (!targetNode) {
            logger.warn(`Cannot split: Node ${targetNodeId} not found`);
            return;
        }

        // We can only split leaf nodes effectively in this simple model, 
        // or we replace a node with a split node containing the original node and a new one.

        // Strategy: Replace targetNode with a SplitNode.
        // The SplitNode will contain the original targetNode (as leaf) and a new LeafNode.

        const parent = targetNode.parent;

        // Create new leaf
        const newCameraIndex = this._findAvailableCameraIndex();
        if (newCameraIndex === -1) {
            logger.warn("Max cameras reached");
            return;
        }

        const newLeaf: LeafNode = {
            id: `leaf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: "leaf",
            cameraIndex: newCameraIndex,
            x: 0, y: 0, width: 0, height: 0 // Will be calculated
        };
        this._nodeMap.set(newLeaf.id, newLeaf);

        // If target is root
        if (targetNode === this._root) {
            const newSplit: SplitNode = {
                id: `split_${Date.now()}`,
                type: "split",
                direction: direction,
                ratio: 0.5,
                children: [targetNode, newLeaf],
                x: 0, y: 0, width: 1, height: 1
            };

            targetNode.parent = newSplit;
            newLeaf.parent = newSplit;

            this._root = newSplit;
            this._nodeMap.set(newSplit.id, newSplit);
        } else if (parent) {
            // Replace targetNode in parent's children
            const index = parent.children.indexOf(targetNode);
            if (index === -1) return; // Should not happen

            const newSplit: SplitNode = {
                id: `split_${Date.now()}`,
                type: "split",
                direction: direction,
                ratio: 0.5,
                children: [targetNode, newLeaf],
                x: targetNode.x,
                y: targetNode.y,
                width: targetNode.width,
                height: targetNode.height,
                parent: parent
            };

            targetNode.parent = newSplit;
            newLeaf.parent = newSplit;

            parent.children[index] = newSplit;
            this._nodeMap.set(newSplit.id, newSplit);
        }

        // Sync camera properties from source to new leaf
        if (targetNode.type === "leaf") {
            const sourceCam = this._cameras[(targetNode as LeafNode).cameraIndex];
            const destCam = this._cameras[newLeaf.cameraIndex];
            destCam.position.copyFrom(sourceCam.position);
            destCam.alpha = sourceCam.alpha;
            destCam.beta = sourceCam.beta;
            destCam.radius = sourceCam.radius;
            destCam.target.copyFrom(sourceCam.target);
        }

        this._activeLeafId = newLeaf.id;
        this._updateViewports();
        this._notifyLayoutChanged();
    }

    public close(nodeId: string): void {
        const node = this._nodeMap.get(nodeId);
        if (!node) return;
        if (node === this._root) return; // Cannot close root if it's the only one? 
        // Actually if root is leaf, we can't close it (must have at least one view).
        // If root is split, we can technically close one side.

        const parent = node.parent;
        if (!parent) return;

        // Find the sibling
        const sibling = parent.children.find(c => c !== node);
        if (!sibling) return;

        // Grandparent
        const grandParent = parent.parent;

        if (grandParent) {
            // Replace parent with sibling in grandparent
            const index = grandParent.children.indexOf(parent);
            grandParent.children[index] = sibling;
            sibling.parent = grandParent;
        } else {
            // Parent was root, so sibling becomes root
            this._root = sibling;
            sibling.parent = undefined;
        }

        // Cleanup
        this._cleanupNode(node);
        this._cleanupNode(parent); // Parent split node is gone

        // Update active leaf if needed
        if (this._activeLeafId === nodeId || !this._nodeMap.has(this._activeLeafId!)) {
            // Set active to sibling or first leaf in sibling
            this._activeLeafId = this._findFirstLeaf(sibling).id;
        }

        this._updateViewports();
        this._notifyLayoutChanged();
    }

    public setActiveLeaf(leafId: string) {
        if (this._nodeMap.has(leafId) && this._nodeMap.get(leafId)!.type === "leaf") {
            this._activeLeafId = leafId;
            this._updateActiveCameraControl();
            this._notifyLayoutChanged();
        }
    }

    public setActiveCamera(cameraIndex: number) {
        // Find leaf with this camera index
        for (const node of this._nodeMap.values()) {
            if (node.type === "leaf" && (node as LeafNode).cameraIndex === cameraIndex) {
                this.setActiveLeaf(node.id);
                return;
            }
        }
    }

    public getActiveLeafId(): string | null {
        return this._activeLeafId;
    }

    public setSplitRatio(splitNodeId: string, ratio: number) {
        const node = this._nodeMap.get(splitNodeId);
        if (node && node.type === "split") {
            (node as SplitNode).ratio = Math.max(0.1, Math.min(0.9, ratio));
            this._updateViewports();
            this._notifyLayoutChanged();
        }
    }

    public resize() {
        this._engine.resize();
    }

    public pickCamera(x: number, y: number): number {
        const width = this._engine.getRenderWidth();
        const height = this._engine.getRenderHeight();
        const ndcX = x / width;
        const ndcY = 1 - (y / height);

        for (let i = 0; i < this._scene.activeCameras!.length; i++) {
            const cam = this._scene.activeCameras![i] as ArcRotateCamera;
            const vp = cam.viewport;
            if (
                ndcX >= vp.x &&
                ndcX <= vp.x + vp.width &&
                ndcY >= vp.y &&
                ndcY <= vp.y + vp.height
            ) {
                return this._cameras.indexOf(cam);
            }
        }
        return -1;
    }

    private _findAvailableCameraIndex(): number {
        const usedIndices = new Set<number>();
        this._nodeMap.forEach(node => {
            if (node.type === "leaf") {
                usedIndices.add((node as LeafNode).cameraIndex);
            }
        });

        for (let i = 0; i < this._cameras.length; i++) {
            if (!usedIndices.has(i)) return i;
        }
        return -1;
    }

    private _findFirstLeaf(node: LayoutNode): LeafNode {
        if (node.type === "leaf") return node as LeafNode;
        return this._findFirstLeaf((node as SplitNode).children[0]);
    }

    private _cleanupNode(node: LayoutNode) {
        this._nodeMap.delete(node.id);
        if (node.type === "split") {
            // If we are cleaning up a split node recursively? 
            // In close(), we only cleanup the closed branch.
            // But if we remove a split node, we should ensure its children are handled.
            // In the close() logic, we only call this on the node being removed.
            // If the node being removed is a SplitNode (e.g. closing a group), we need to recurse.
            const split = node as SplitNode;
            split.children.forEach(c => this._cleanupNode(c));
        }
    }

    private _updateViewports() {
        // Recalculate geometry for the whole tree
        this._calculateGeometry(this._root, 0, 0, 1, 1);

        // Update cameras
        this._scene.activeCameras = [];
        this._nodeMap.forEach(node => {
            if (node.type === "leaf") {
                const leaf = node as LeafNode;
                const cam = this._cameras[leaf.cameraIndex];

                // Babylon Viewport: x, y, width, height (0-1)
                // Note: Babylon Viewport y is bottom-left. Our geometry calculation usually assumes top-left (0,0).
                // So we need to convert y.
                // If y=0 is top, then babylon_y = 1 - (y + height)

                // Wait, Babylon Viewport(x, y, w, h)
                // x, y is lower-left corner.
                // If our geometry is top-left based:
                // x = leaf.x
                // y = 1 - (leaf.y + leaf.height)

                cam.viewport = new Viewport(
                    leaf.x,
                    1 - (leaf.y + leaf.height),
                    leaf.width,
                    leaf.height
                );

                this._scene.activeCameras!.push(cam);
            }
        });

        this._updateActiveCameraControl();
    }

    private _calculateGeometry(node: LayoutNode, x: number, y: number, w: number, h: number) {
        node.x = x;
        node.y = y;
        node.width = w;
        node.height = h;

        if (node.type === "split") {
            const split = node as SplitNode;
            const child1 = split.children[0];
            const child2 = split.children[1];

            if (split.direction === SplitDirection.Horizontal) {
                // Split horizontally (left/right)
                const w1 = w * split.ratio;
                const w2 = w - w1;
                this._calculateGeometry(child1, x, y, w1, h);
                this._calculateGeometry(child2, x + w1, y, w2, h);
            } else {
                // Split vertically (top/bottom)
                const h1 = h * split.ratio;
                const h2 = h - h1;
                this._calculateGeometry(child1, x, y, w, h1);
                this._calculateGeometry(child2, x, y + h1, w, h2);
            }
        }
    }

    private _updateActiveCameraControl() {
        this._cameras.forEach(cam => cam.detachControl());

        const activeCam = this.activeCamera;
        if (activeCam) {
            const canvas = this._engine.getRenderingCanvas();
            if (canvas) {
                activeCam.attachControl(canvas, false);
            }
        }
    }

    private _notifyLayoutChanged() {
        if (this._onLayoutChanged) {
            this._onLayoutChanged();
        }
    }
}
