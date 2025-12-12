import type { MolvisApp as Molvis } from "../core/app";
import type { Frame } from "../structure/frame";
import { command } from "./decorator";

export interface TrajectoryOptions {
    frames: any[];  // Array of frame data (serialized)
    fps?: number;
    loop?: boolean;
    options?: {
        style?: string;
        atoms?: { radius?: number };
        bonds?: { radius?: number };
    };
}

export interface AnimationControlOptions {
    fps?: number;
}

export interface SetFrameOptions {
    frameIndex: number;
}

/**
 * Animation player for trajectory playback
 */
class TrajectoryPlayer {
    private frames: Frame[] = [];
    private currentFrameIndex: number = 0;
    private isPlaying: boolean = false;
    private fps: number = 30;
    private loop: boolean = true;
    private animationHandle: number | null = null;
    private lastFrameTime: number = 0;
    private app: Molvis;

    constructor(app: Molvis) {
        this.app = app;
    }

    loadFrames(frames: any[]) {
        // Convert serialized frame data to Frame objects
        this.frames = frames.map((frameData) => {
            // Assuming Frame.fromDict exists or similar deserialization
            // For now, we'll store the raw data and render it directly
            return frameData as Frame;
        });
        this.currentFrameIndex = 0;
        this.isPlaying = false;
    }

    play(fps?: number) {
        if (fps !== undefined) {
            this.fps = fps;
        }

        if (this.frames.length === 0) {
            throw new Error("No frames loaded. Call loadFrames() first.");
        }

        this.isPlaying = true;
        this.lastFrameTime = performance.now();
        this.animate();
    }

    pause() {
        this.isPlaying = false;
        if (this.animationHandle !== null) {
            cancelAnimationFrame(this.animationHandle);
            this.animationHandle = null;
        }
    }

    setFrame(index: number) {
        if (index < 0 || index >= this.frames.length) {
            throw new Error(`Frame index ${index} out of range [0, ${this.frames.length - 1}]`);
        }
        this.currentFrameIndex = index;
        this.renderCurrentFrame();
    }

    private animate = () => {
        if (!this.isPlaying) return;

        const now = performance.now();
        const elapsed = now - this.lastFrameTime;
        const frameInterval = 1000 / this.fps;

        if (elapsed >= frameInterval) {
            this.lastFrameTime = now - (elapsed % frameInterval);

            // Advance to next frame
            this.currentFrameIndex++;

            if (this.currentFrameIndex >= this.frames.length) {
                if (this.loop) {
                    this.currentFrameIndex = 0;
                } else {
                    this.pause();
                    return;
                }
            }

            this.renderCurrentFrame();
        }

        this.animationHandle = requestAnimationFrame(this.animate);
    };

    private renderCurrentFrame() {
        if (this.currentFrameIndex >= 0 && this.currentFrameIndex < this.frames.length) {
            const frameData = this.frames[this.currentFrameIndex];

            // Clear previous frame
            this.app.execute("clear", {});

            // Render current frame
            this.app.execute("draw_frame", { frameData });
        }
    }

    getStatus() {
        return {
            isPlaying: this.isPlaying,
            currentFrame: this.currentFrameIndex,
            totalFrames: this.frames.length,
            fps: this.fps,
            loop: this.loop,
        };
    }
}

/**
 * Animation commands for trajectory playback
 */
class AnimationCommands {
    private static player: TrajectoryPlayer | null = null;

    private static getPlayer(app: Molvis): TrajectoryPlayer {
        if (!AnimationCommands.player) {
            AnimationCommands.player = new TrajectoryPlayer(app);
        }
        return AnimationCommands.player;
    }

    @command("draw_trajectory")
    static draw_trajectory(app: Molvis, options: TrajectoryOptions) {
        const { frames, fps = 30, loop = true } = options;

        if (!frames || !Array.isArray(frames) || frames.length === 0) {
            throw new Error("draw_trajectory requires a non-empty frames array");
        }

        const player = AnimationCommands.getPlayer(app);
        player.loadFrames(frames);

        // Set FPS and loop settings
        (player as any).fps = fps;
        (player as any).loop = loop;

        return {
            success: true,
            data: {
                frameCount: frames.length,
                fps,
                loop,
            },
            meshes: [],
            entities: [],
        };
    }

    @command("play_animation")
    static play_animation(app: Molvis, options?: AnimationControlOptions) {
        const player = AnimationCommands.getPlayer(app);

        try {
            player.play(options?.fps);
            return {
                success: true,
                data: player.getStatus(),
                meshes: [],
                entities: [],
            };
        } catch (error) {
            throw new Error(`Failed to play animation: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    @command("pause_animation")
    static pause_animation(app: Molvis) {
        const player = AnimationCommands.getPlayer(app);
        player.pause();

        return {
            success: true,
            data: player.getStatus(),
            meshes: [],
            entities: [],
        };
    }

    @command("set_animation_frame")
    static set_animation_frame(app: Molvis, options: SetFrameOptions) {
        const { frameIndex } = options;
        const player = AnimationCommands.getPlayer(app);

        try {
            player.setFrame(frameIndex);
            return {
                success: true,
                data: player.getStatus(),
                meshes: [],
                entities: [],
            };
        } catch (error) {
            throw new Error(`Failed to set frame: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

export const draw_trajectory = AnimationCommands.draw_trajectory;
export const play_animation = AnimationCommands.play_animation;
export const pause_animation = AnimationCommands.pause_animation;
export const set_animation_frame = AnimationCommands.set_animation_frame;
