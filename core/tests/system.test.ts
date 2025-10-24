import { Scene, Atom } from "@molvis/core";
import { Vector3 } from "@babylonjs/core";

describe("Scene basic CRUD", () => {
	test("add/remove atoms and bonds", () => {
		const scene = Scene.instance();
		// clear any previous state
		for (const a of scene.getAtoms()) scene.removeAtom(a);

		const a = scene.addAtom(new Vector3(0, 0, 0));
		const b = scene.addAtom(new Vector3(1, 0, 0));

		expect(scene.getAtoms().length).toBe(2);

		const bond = scene.addBond(a, b, { order: 1 });
		expect(scene.getBonds().length).toBe(1);
		expect(scene.hasBond(a, b)).toBe(true);

		scene.removeBond(bond);
		expect(scene.getBonds().length).toBe(0);

		scene.removeAtom(a);
		expect(scene.getAtoms().length).toBe(1);
	});
});

