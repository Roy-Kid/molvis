import type { Frame } from "@molcrafts/molvis-core/molrs";

/** Serializable outline for hosts (VS Code tree, future web outline). */
export type StructureOutlineNode = {
  id: string;
  label: string;
  kind: "chain" | "residue" | "atom" | "source";
  atomIndices?: number[];
  children?: StructureOutlineNode[];
};

export type StructureOutline = {
  roots: StructureOutlineNode[];
};

/**
 * Build a chain → residue → atom tree from an atoms block.
 *
 * Residue grouping uses canonical `res_id` (u32). `res_seq` is a ribbon
 * field (i32) and is not read here. Missing hierarchy columns fall back
 * to a flat atom list (capped).
 */
export function buildStructureOutline(
  frame: Frame,
  options?: { maxAtomsListed?: number },
): StructureOutline {
  const maxAtoms = options?.maxAtomsListed ?? 2000;
  const atoms = frame.getBlock("atoms");
  if (!atoms || atoms.nrows() === 0) {
    return { roots: [] };
  }

  const n = atoms.nrows();
  const chainIds = atoms.hasStr("chain_id")
    ? (atoms.getStr("chain_id") as string[])
    : undefined;
  const resIds = atoms.hasU32("res_id") ? atoms.getU32("res_id") : undefined;
  const resNames = atoms.hasStr("res_name")
    ? (atoms.getStr("res_name") as string[])
    : undefined;
  const names = atoms.hasStr("name")
    ? (atoms.getStr("name") as string[])
    : undefined;
  const elements = atoms.hasStr("element")
    ? (atoms.getStr("element") as string[])
    : undefined;

  if (!chainIds && !resIds) {
    const children: StructureOutlineNode[] = [];
    const limit = Math.min(n, maxAtoms);
    for (let i = 0; i < limit; i++) {
      children.push({
        id: `atom:${i}`,
        label: atomLabel(i, names, elements),
        kind: "atom",
        atomIndices: [i],
      });
    }
    return {
      roots: [
        {
          id: "source:0",
          label:
            n > maxAtoms ? `Atoms (${n}, showing ${maxAtoms})` : `Atoms (${n})`,
          kind: "source",
          atomIndices: Array.from({ length: n }, (_, i) => i),
          children,
        },
      ],
    };
  }

  type ResBucket = {
    label: string;
    atoms: { index: number; label: string }[];
  };
  const chains = new Map<string, Map<string, ResBucket>>();

  for (let i = 0; i < n; i++) {
    const chain = (chainIds?.[i] ?? " ").trim() || "A";
    const seq = resIds ? resIds[i] : 0;
    const rname = (resNames?.[i] ?? "UNK").trim() || "UNK";
    const resKey = `${chain}|${seq}|${rname}`;
    let resMap = chains.get(chain);
    if (!resMap) {
      resMap = new Map();
      chains.set(chain, resMap);
    }
    let bucket = resMap.get(resKey);
    if (!bucket) {
      bucket = { label: `${rname} ${seq}`, atoms: [] };
      resMap.set(resKey, bucket);
    }
    bucket.atoms.push({
      index: i,
      label: atomLabel(i, names, elements),
    });
  }

  const roots: StructureOutlineNode[] = [];
  for (const [chain, resMap] of chains) {
    const residues: StructureOutlineNode[] = [];
    const chainAtomIndices: number[] = [];
    for (const [resKey, bucket] of resMap) {
      const atomNodes: StructureOutlineNode[] = bucket.atoms.map((a) => ({
        id: `atom:${a.index}`,
        label: a.label,
        kind: "atom" as const,
        atomIndices: [a.index],
      }));
      const indices = bucket.atoms.map((a) => a.index);
      chainAtomIndices.push(...indices);
      residues.push({
        id: `res:${resKey}`,
        label: bucket.label,
        kind: "residue",
        atomIndices: indices,
        children: atomNodes.length <= 40 ? atomNodes : undefined,
      });
    }
    roots.push({
      id: `chain:${chain}`,
      label: `Chain ${chain}`,
      kind: "chain",
      atomIndices: chainAtomIndices,
      children: residues,
    });
  }

  return { roots };
}

function atomLabel(
  i: number,
  names: string[] | undefined,
  elements: string[] | undefined,
): string {
  const el = elements?.[i]?.trim() || "?";
  const nm = names?.[i]?.trim();
  return nm ? `${nm} (${el}) #${i}` : `${el} #${i}`;
}
