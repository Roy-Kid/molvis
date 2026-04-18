"""Chemiscope-style dataset explorer for polymer Tg data.

Loads the first few rows of ``LAMALAB_CURATED_Tg_structured.csv``, converts
each PSMILES entry to a 3D structure with RDKit, and streams the set into
molvis as a 5-frame trajectory plus a per-frame label table. The PCATool
sidebar then reduces the label columns to 2D; clicking a point navigates to
the matching frame (i.e. the corresponding polymer).

Architecture: Python only exposes a WebSocket; the frontend is whatever
MolVis tab you already have open (e.g. ``npm run dev:page`` at
``http://localhost:3000``). The script prints a single
``ws://…?token=…&session=…`` URL. Paste that into the page's Settings
→ Backend dialog and click Connect; Python then pushes the trajectory
and label table.

Run
---
1. In one terminal::

       npm run dev:page         # serves the page at http://localhost:3000

2. Open the dev page in a browser tab.

3. In another terminal::

       python examples/chemiscope_tg.py [n_rows]

   The script prints one URL; paste it into Settings → Backend in the
   browser tab. Python holds the connection open until you hit Ctrl+C.
"""

from __future__ import annotations

import logging
import sys
import threading
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
PSMILES_COL = "PSMILES"
LABEL_COL = "labels.Exp_Tg(K)"
EMBED_SEED = 42
WS_PORT = 8765


def psmiles_to_frame(psmiles: str) -> mp.Frame:
    """Convert a PSMILES string into a molpy Frame with 3D coords.

    Caps wildcard ``[*]`` endpoints with hydrogens, embeds with ETKDG, and
    optimizes with MMFF. Builds ``atoms`` (element, x, y, z) and ``bonds``
    (atomi, atomj) blocks.
    """
    clean = psmiles.replace("[*]", "[H]")
    mol = Chem.MolFromSmiles(clean)
    if mol is None:
        raise ValueError(f"RDKit could not parse: {psmiles!r}")
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


def main(n_rows: int = 5) -> None:
    if not CSV_PATH.exists():
        raise SystemExit(f"CSV not found: {CSV_PATH}")

    df = pd.read_csv(CSV_PATH, nrows=n_rows)
    logger.info("Loaded %d rows, %d columns", len(df), len(df.columns))

    frames: list[mp.Frame] = []
    for i, psmiles in enumerate(df[PSMILES_COL]):
        logger.info("[%d/%d] %s", i + 1, n_rows, psmiles)
        frames.append(psmiles_to_frame(str(psmiles)))

    labels = collect_labels(df)
    logger.info(
        "Built %d frames and %d label columns (e.g. %s=%s)",
        len(frames),
        len(labels),
        LABEL_COL,
        labels.get(LABEL_COL),
    )

    transport = mv.WebSocketTransport(
        port=WS_PORT,
        open_browser=False,
        serve_page=False,
    )
    viewer = mv.Molvis(name="chemiscope-tg", transport=transport)
    transport.start()

    connect_url = transport.connection_url(session=viewer.name)
    logger.info("")
    logger.info("  >>> Paste this into Settings → Backend in the MolVis tab:")
    logger.info("      %s", connect_url)
    logger.info("")
    logger.info("Waiting for browser handshake…")
    transport.wait_for_connection()

    viewer.set_trajectory(frames)
    viewer.set_frame_labels(labels)
    logger.info(
        "Sent %d frames and %d labels. Click Compute in the PCA sidebar.",
        len(frames),
        len(labels),
    )
    logger.info("Ctrl+C to exit.")

    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        pass
    finally:
        viewer.close()


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    main(n)
