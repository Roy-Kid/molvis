declare module "kekule" {
  export const Kekule: typeof globalThis.Kekule;
}
declare module "kekule/theme" {}

declare namespace Kekule {
  interface ChemNode {
    getSymbol(): string;
    getCoord2D(): { x: number; y: number } | null;
  }

  interface Connector {
    getConnectedObjAt(index: number): ChemNode;
    getBondOrder(): number;
  }

  class Molecule {
    getNodeCount(): number;
    getNodeAt(index: number): ChemNode;
    getConnectorCount(): number;
    getConnectorAt(index: number): Connector;
    indexOfNode(node: ChemNode): number;
  }

  namespace Editor {
    class Composer {
      constructor(ownerDocument: Document);
      appendToElem(parentElem: HTMLElement): void;
      setDimension(width: string, height: string): void;
      setChemObj(obj: unknown): void;
      getChemObj(): unknown;
      newDoc(): void;
      exportObjs(type: typeof Molecule): Molecule[];
      finalize(): void;
    }
  }
}
