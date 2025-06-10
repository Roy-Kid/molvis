import { Frame } from './frame';
import { Atom, Bond } from './item';
import { Trajectory } from './trajectory';
import { Box } from './box';
import { IEntity } from './base';
import { Vector3 } from '@babylonjs/core';

class System {
  private _selected: Atom[];
  private _trajectory: Trajectory;

  constructor() {
    this._trajectory = new Trajectory();
    this._selected = [];
  }

  public get trajectory() {
    return this._trajectory;
  }

  public get current_frame() {
    return this._trajectory.currentFrame;
  }

  public set current_frame_index(idx: number) {
    this._trajectory.currentIndex = idx;
  }

  public getFrame(idx: number): Frame | undefined {
    return this._trajectory.getFrame(idx);
  }

  public set_frame(idx: number) {
    this._trajectory.currentIndex = idx;
  }

  public next_frame() {
    return this._trajectory.nextFrame();
  }

  public prev_frame() {
    return this._trajectory.prevFrame();
  }

  public add_atom(name: string, xyz: Vector3, props: Record<string, any>) {
    return this.current_frame.add_atom(name, xyz, props);
  }

  public add_bond(itom: Atom, jtom: Atom, props: Record<string, any> = {}) {
    return this.current_frame.add_bond(itom, jtom, props);
  }

  public get_atom(fn: (atom: Atom) => boolean) {
    return this.current_frame.get_atom(fn);
  }

  public remove_atom(atom: Atom) {
    this.current_frame.remove_atom(atom);
  }

  static random_atom_id(): string {
    const randomNum = Math.floor(Math.random() * 0x10000);
    const hexID = randomNum.toString(16).padStart(4, '0');
    return hexID;
  }

  public select_atom(atom: Atom) {
    this._selected.push(atom);
  }

  public append_frame(frame: Frame) {
    this._trajectory.addFrame(frame);
  }

  get n_frames(): number {
    return this._trajectory.frames.length;
  }
}

export { System, Box, Atom, Bond };
export type { IEntity };
