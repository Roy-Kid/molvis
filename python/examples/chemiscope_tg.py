"""Chemiscope-style dataset explorer for polymer Tg data.

Loads ``LAMALAB_CURATED_Tg_structured.csv`` (all rows by default), converts
each PSMILES entry to a 3D structure with RDKit, and streams the set into
molvis as a trajectory plus a per-frame label table. The PCATool sidebar
then reduces the label columns to 2D; clicking a point navigates to the
matching frame (i.e. the corresponding polymer).

PSMILES wildcards ``[*]`` are capped directly with hydrogen. Rows whose
wildcard carries a multi-order bond (``[*]=C``, ``[*]#C``) fail RDKit
sanitization under H-cap and are exported to a sibling ``*_h_cap_failures.csv``
instead of aborting the run.

Run
---
1. In one terminal::

       npm run dev:page         # serves the page at http://localhost:3000

2. Open that tab in a browser.

3. In another terminal::

       python examples/chemiscope_tg.py [n_rows]

   ``n_rows`` is optional; omit it to process the whole CSV. The script
   logs one ``ws://…?token=…&session=…`` URL. Paste it into the browser
   tab's Settings → Backend dialog; Python then pushes the trajectory +
   labels. Ctrl+C to exit.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import molpy as mp
import numpy as np
import pandas as pd
from rdkit import Chem
from rdkit.Chem import AllChem

import molvis as mv

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("chemiscope_tg")

CSV_PATH = Path("/Users/roykid/work/molcrafts/LAMALAB_CURATED_Tg_structured.csv")
FAIL_CSV_PATH = CSV_PATH.parent / f"{CSV_PATH.stem}_h_cap_failures.csv"
PSMILES_COL = "PSMILES"
LABEL_COL = "labels.Exp_Tg(K)"
EMBED_SEED = 42
END_GROUP_COL = "is_end_group"
# Private atom-map-num marker used only inside psmiles_to_frame. Any
# value not clashing with real PSMILES map numbers works; real PSMILES
# typically use 0.
_END_GROUP_MAP_NUM = 777


def psmiles_to_frame(psmiles: str) -> mp.Frame:
    """Convert a PSMILES into a molpy Frame.

    PSMILES marks monomer connection points with wildcard ``[*]`` atoms.
    We cap each ``[*]`` directly with hydrogen, then AddHs + ETKDG + MMFF.
    Sanitization raises ``AtomValenceException`` when a wildcard carries
    a multi-order bond like ``[*]=C`` or ``[*]#C`` (H can't satisfy that
    valence) — the caller is expected to catch and record such failures.

    End-group heavy atoms (neighbors of the original ``[*]``) are tagged
    with an RDKit atom-map-num *before* any mol edits, and surface in the
    output Frame as an ``is_end_group`` bool column on the atoms block.
    Using map-nums means we never have to reason about index shifts
    through ``RWMol`` / ``SanitizeMol`` / ``AddHs``; looking up the
    column also means downstream code can mark end groups without a
    parallel side-channel list.
    """
    mol = Chem.MolFromSmiles(psmiles)
    if mol is None:
        raise ValueError(f"RDKit could not parse: {psmiles!r}")

    # Tag end-group heavy atoms. RDKit preserves atom-map-nums through
    # atomic-number edits, Sanitize, and AddHs — new H's appended by
    # AddHs default to map-num 0, so they never false-positive.
    for atom in mol.GetAtoms():
        if atom.GetAtomicNum() != 0:
            continue
        for nbr in atom.GetNeighbors():
            if nbr.GetAtomicNum() != 0:
                nbr.SetAtomMapNum(_END_GROUP_MAP_NUM)

    # Cap wildcards as hydrogen. NoImplicit + 0 explicit Hs keeps AddHs
    # below from hanging any further hydrogens off the cap itself.
    rwmol = Chem.RWMol(mol)
    for atom in rwmol.GetAtoms():
        if atom.GetAtomicNum() == 0:
            atom.SetAtomicNum(1)
            atom.SetNoImplicit(True)
            atom.SetNumExplicitHs(0)
    mol = rwmol.GetMol()
    Chem.SanitizeMol(mol)

    mol = Chem.AddHs(mol)
    if AllChem.EmbedMolecule(mol, randomSeed=EMBED_SEED) != 0:
        raise RuntimeError(f"Embedding failed for {psmiles!r}")
    try:
        AllChem.MMFFOptimizeMolecule(mol, maxIters=400)
    except Exception:
        logger.warning("MMFF failed for %s; keeping unrelaxed coords", psmiles)

    conf = mol.GetConformer()
    n_atoms = mol.GetNumAtoms()
    elements = np.array([a.GetSymbol() for a in mol.GetAtoms()])
    is_end_group = np.array(
        [a.GetAtomMapNum() == _END_GROUP_MAP_NUM for a in mol.GetAtoms()],
        dtype=bool,
    )
    xyz = np.zeros((n_atoms, 3), dtype=np.float64)
    for i in range(n_atoms):
        p = conf.GetAtomPosition(i)
        xyz[i] = (p.x, p.y, p.z)

    atomi = np.array([b.GetBeginAtomIdx() for b in mol.GetBonds()], dtype=np.uint32)
    atomj = np.array([b.GetEndAtomIdx() for b in mol.GetBonds()], dtype=np.uint32)

    return mp.Frame(
        blocks={
            "atoms": {
                "element": elements,
                "x": xyz[:, 0],
                "y": xyz[:, 1],
                "z": xyz[:, 2],
                END_GROUP_COL: is_end_group,
            },
            "bonds": {"atomi": atomi, "atomj": atomj},
        }
    )


def collect_labels(df: pd.DataFrame) -> dict[str, np.ndarray]:
    """Pull every numeric column (Tg + featurizer outputs) into a label map."""
    labels: dict[str, np.ndarray] = {}
    for col in df.columns:
        if col == PSMILES_COL:
            continue
        series = pd.to_numeric(df[col], errors="coerce")
        if series.notna().sum() < 2:
            continue
        if series.nunique(dropna=True) < 2:
            continue
        labels[col] = series.to_numpy(dtype=np.float64)
    return labels


def main(n_rows: int | None = None) -> None:
    if not CSV_PATH.exists():
        raise SystemExit(f"CSV not found: {CSV_PATH}")

    df = pd.read_csv(CSV_PATH, nrows=n_rows)
    total = len(df)
    logger.info("Loaded %d rows, %d columns", total, len(df.columns))

    frames: list[mp.Frame] = []
    ok_row_ixs: list[int] = []
    failures: list[dict] = []

    for i, psmiles in enumerate(df[PSMILES_COL]):
        logger.info("[%d/%d] %s", i + 1, total, psmiles)
        try:
            frame = psmiles_to_frame(str(psmiles))
        except Exception as exc:
            logger.warning("Skip row %d (%s): %s", i, psmiles, exc)
            failures.append(
                {"row": i, "psmiles": psmiles, "error": str(exc)}
            )
            continue
        frames.append(frame)
        ok_row_ixs.append(i)

    if failures:
        pd.DataFrame(failures).to_csv(FAIL_CSV_PATH, index=False)
        logger.warning(
            "Exported %d / %d failures to %s", len(failures), total, FAIL_CSV_PATH
        )

    if not frames:
        raise SystemExit("No frames built — every PSMILES failed. See failure CSV.")

    df_ok = df.iloc[ok_row_ixs].reset_index(drop=True)
    labels = collect_labels(df_ok)
    logger.info(
        "Built %d frames and %d label columns (e.g. %s=%s)",
        len(frames),
        len(labels),
        LABEL_COL,
        labels.get(LABEL_COL),
    )

    scene = mv.Molvis(name="chemiscope-tg", serve_page=False)
    scene.set_trajectory(frames)
    scene.set_frame_labels(labels)

    # Highlight end-group atoms on the first polymer. We read indices
    # straight from the Frame's own `is_end_group` column — the Frame
    # is the single source of truth for what the frontend will render,
    # so mark_atom can't drift out of sync with it.
    frame0_atoms = frames[0]["atoms"]
    end_group_ids = np.flatnonzero(frame0_atoms[END_GROUP_COL]).tolist()
    for atom_id in end_group_ids:
        scene.mark_atom(
            int(atom_id),
            label="*",
            shape_color="#ff4d6d",
            shape_opacity=0.55,
            label_background="#ff4d6d",
            label_offset=(0.0, 0.8, 0.0),
        )
    logger.info(
        "Sent %d frames, %d labels, marked %d end groups on frame 0. "
        "Click Compute in the PCA sidebar. Ctrl+C to exit.",
        len(frames),
        len(labels),
        len(end_group_ids),
    )
    scene.wait()


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else None
    main(n)
